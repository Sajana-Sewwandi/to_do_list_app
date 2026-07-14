import { Repository } from 'typeorm';
import { Task, TaskStatus } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const tasksRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TasksService(tasksRepository as unknown as Repository<Task>);
  });

  it('creates a task for the authenticated user', async () => {
    const task = {
      id: 1,
      title: 'Write tests',
      description: 'Add unit tests for tasks',
      status: TaskStatus.TODO,
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
    } as Task;
    const createTaskDto = {
      title: 'Write tests',
      description: 'Add unit tests for tasks',
      dueDate: '2026-08-01T00:00:00.000Z',
    };

    tasksRepository.create.mockReturnValue(task);
    tasksRepository.save.mockResolvedValue(task);

    await expect(service.create(7, createTaskDto)).resolves.toEqual(task);
    expect(tasksRepository.create).toHaveBeenCalledWith({
      ...createTaskDto,
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
      user: { id: 7 },
    });
    expect(tasksRepository.save).toHaveBeenCalledWith(task);
  });

  it('updates a task belonging to the authenticated user', async () => {
    const task = {
      id: 2,
      title: 'Original title',
      description: 'Original description',
      status: TaskStatus.TODO,
      dueDate: new Date('2026-08-01T00:00:00.000Z'),
    } as Task;

    tasksRepository.findOne.mockResolvedValue(task);
    tasksRepository.save.mockResolvedValue(task);

    await expect(
      service.update(7, 2, {
        title: 'Updated title',
        status: TaskStatus.DONE,
        dueDate: '2026-08-02T00:00:00.000Z',
      }),
    ).resolves.toEqual(task);

    expect(tasksRepository.findOne).toHaveBeenCalledWith({
      where: { id: 2, user: { id: 7 } },
    });
    expect(task).toMatchObject({
      title: 'Updated title',
      status: TaskStatus.DONE,
      dueDate: new Date('2026-08-02T00:00:00.000Z'),
    });
    expect(tasksRepository.save).toHaveBeenCalledWith(task);
  });

  it('deletes a task belonging to the authenticated user', async () => {
    const task = { id: 3 } as Task;
    tasksRepository.findOne.mockResolvedValue(task);
    tasksRepository.remove.mockResolvedValue(task);

    await expect(service.remove(7, 3)).resolves.toBeUndefined();

    expect(tasksRepository.findOne).toHaveBeenCalledWith({
      where: { id: 3, user: { id: 7 } },
    });
    expect(tasksRepository.remove).toHaveBeenCalledWith(task);
  });
});
