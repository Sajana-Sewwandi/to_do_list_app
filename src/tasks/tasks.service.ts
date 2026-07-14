import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTaskDto } from './dto/create-task.dto';
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
      order: { dueDate: 'ASC' },
    });
  }

  async create(userId: number, createTaskDto: CreateTaskDto) {
    const { dueDate, ...taskData } = createTaskDto;
    const task = this.tasksRepository.create({
      ...taskData,
      dueDate: new Date(dueDate),
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
