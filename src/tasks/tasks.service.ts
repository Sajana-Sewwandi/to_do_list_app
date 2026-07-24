import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskDto } from './dto/create-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
  ) {}

  findAll(userId: number) {
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
    });
    const task = this.tasksRepository.create({
      ...taskData,
      dueDate: new Date(dueDate),
      sortOrder: (lastTask?.sortOrder ?? -1) + 1,
      user: { id: userId },
    });

    return this.tasksRepository.save(task);
  }

  async update(userId: number, id: number, updateTaskDto: UpdateTaskDto) {
    const task = await this.findOneForUser(userId, id);
    const { dueDate, ...taskData } = updateTaskDto;
    Object.assign(task, taskData);

    if (dueDate) {
      task.dueDate = new Date(dueDate);
    }

    return this.tasksRepository.save(task);
  }

  async remove(userId: number, id: number) {
    const task = await this.findOneForUser(userId, id);
    await this.tasksRepository.remove(task);
  }

  async reorder(userId: number, reorderTasksDto: ReorderTasksDto) {
    const tasks = await this.findAll(userId);
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

    return this.tasksRepository.save(reorderedTasks);
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
}
