import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

describe('TasksController', () => {
  const tasksService = {
    findAll: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), reorder: jest.fn(),
  };
  const controller = new TasksController(tasksService as unknown as TasksService);
  const request = { user: { userId: 7 } };

  beforeEach(() => jest.clearAllMocks());

  it('passes the authenticated user ID to task listing', async () => {
    tasksService.findAll.mockResolvedValue([{ id: 1 }]);
    await expect(controller.findAll(request)).resolves.toEqual([{ id: 1 }]);
    expect(tasksService.findAll).toHaveBeenCalledWith(7);
  });

  it('delegates task creation to the service for the authenticated user', async () => {
    const dto = { title: 'Write tests', description: 'Cover task routes', dueDate: '2026-08-01T00:00:00.000Z' };
    tasksService.create.mockResolvedValue({ id: 1, ...dto });
    await expect(controller.create(request, dto)).resolves.toEqual({ id: 1, ...dto });
    expect(tasksService.create).toHaveBeenCalledWith(7, dto);
  });

  it('delegates a full ordered ID list to the reorder service', async () => {
    tasksService.reorder.mockResolvedValue([{ id: 3 }, { id: 1 }]);
    await expect(controller.reorder(request, { taskIds: [3, 1] })).resolves.toEqual([{ id: 3 }, { id: 1 }]);
    expect(tasksService.reorder).toHaveBeenCalledWith(7, { taskIds: [3, 1] });
  });
});
