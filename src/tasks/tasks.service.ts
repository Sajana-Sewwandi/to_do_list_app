import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisCacheService } from '../cache/redis-cache.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.entity';

@Injectable()
export class TasksService {
  private static readonly TASK_LIST_TTL_SECONDS = 300;

  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    private readonly cache: RedisCacheService,
  ) {}

  async findAll(userId: number) {
    const cacheKey = this.taskListCacheKey(userId);
    const cachedTasks = await this.cache.get<Task[]>(cacheKey);

    if (cachedTasks) return cachedTasks;

    const tasks = await this.findAllFromDatabase(userId);
    await this.cache.set(cacheKey, tasks, TasksService.TASK_LIST_TTL_SECONDS);
    return tasks;
  }

  private findAllFromDatabase(userId: number) {
    return this.tasksRepository.find({
      where: { user: { id: userId } },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async create(userId: number, createTaskDto: CreateTaskDto) {
    const { dueDate, ...taskData } = createTaskDto;
    const lastTask = await this.tasksRepository.findOne({
      where: { user: { id: userId } },
      order: { sortOrder: 'DESC' },
      select: { sortOrder: true },
    });
    const task = this.tasksRepository.create({
      ...taskData,
      dueDate: new Date(dueDate),
      sortOrder: (lastTask?.sortOrder ?? -1) + 1,
      user: { id: userId },
    });

    const savedTask = await this.tasksRepository.save(task);
    await this.invalidateTaskList(userId);
    return savedTask;
  }

  async update(userId: number, id: number, updateTaskDto: UpdateTaskDto) {
    const task = await this.findOneForUser(userId, id);
    const { dueDate, ...taskData } = updateTaskDto;
    Object.assign(task, taskData);

    if (dueDate) {
      task.dueDate = new Date(dueDate);
    }

    const savedTask = await this.tasksRepository.save(task);
    await this.invalidateTaskList(userId);
    return savedTask;
  }

  async remove(userId: number, id: number) {
    const task = await this.findOneForUser(userId, id);
    await this.tasksRepository.remove(task);
    await this.invalidateTaskList(userId);
  }

  async reorder(userId: number, reorderTasksDto: ReorderTasksDto) {
    const tasks = await this.findAllFromDatabase(userId);
    const taskIds = reorderTasksDto.taskIds;
    const taskIdSet = new Set(taskIds);

    if (
      tasks.length !== taskIds.length ||
      tasks.some((task) => !taskIdSet.has(task.id))
    ) {
      throw new BadRequestException(
        'taskIds must contain every task owned by the authenticated user exactly once',
      );
    }

    const tasksById = new Map(tasks.map((task) => [task.id, task]));
    const reorderedTasks = taskIds.map((taskId, sortOrder) => {
      const task = tasksById.get(taskId)!;
      task.sortOrder = sortOrder;
      return task;
    });

    const savedTasks = await this.tasksRepository.save(reorderedTasks);
    await this.invalidateTaskList(userId);
    return savedTasks;
  }

  private async findOneForUser(userId: number, id: number) {
    const task = await this.tasksRepository.findOne({
      where: { id, user: { id: userId } },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  private taskListCacheKey(userId: number) {
    return `tasks:user:${userId}`;
  }

  private invalidateTaskList(userId: number) {
    return this.cache.del(this.taskListCacheKey(userId));
  }
}
