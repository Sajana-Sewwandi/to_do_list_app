import { CanActivate, ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest().user = { userId: 7 };
    return true;
  }
}

describe('Task API (e2e)', () => {
  let app: INestApplication;
  const authService = { register: jest.fn(), login: jest.fn() };
  const tasksService = { findAll: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), reorder: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController, TasksController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: TasksService, useValue: tasksService },
      ],
    }).overrideGuard(JwtAuthGuard).useClass(TestJwtGuard).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => app.close());

  it('registers and logs in through HTTP endpoints', async () => {
    authService.register.mockResolvedValue({ id: 7, name: 'Alex', email: 'alex@example.com' });
    authService.login.mockResolvedValue({ access_token: 'test-token' });
    await request(app.getHttpServer()).post('/auth/register').send({ name: 'Alex', email: 'alex@example.com', password: 'password123' }).expect(201).expect({ id: 7, name: 'Alex', email: 'alex@example.com' });
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'alex@example.com', password: 'password123' }).expect(200).expect({ access_token: 'test-token' });
  });

  it('returns the authenticated user task list', async () => {
    tasksService.findAll.mockResolvedValue([{ id: 1, title: 'First task' }]);
    await request(app.getHttpServer()).get('/tasks').set('Authorization', 'Bearer test-token').expect(200).expect([{ id: 1, title: 'First task' }]);
    expect(tasksService.findAll).toHaveBeenCalledWith(7);
  });

  it('validates task input before reaching the service', async () => {
    await request(app.getHttpServer()).post('/tasks').set('Authorization', 'Bearer test-token').send({ title: '', description: 'Missing due date' }).expect(400);
    expect(tasksService.create).not.toHaveBeenCalled();
  });

  it('accepts a drag-and-drop reorder request and sends it to the service', async () => {
    tasksService.reorder.mockResolvedValue([{ id: 3, sortOrder: 0 }, { id: 1, sortOrder: 1 }]);
    await request(app.getHttpServer()).put('/tasks/reorder').set('Authorization', 'Bearer test-token').send({ taskIds: [3, 1] }).expect(200).expect([{ id: 3, sortOrder: 0 }, { id: 1, sortOrder: 1 }]);
    expect(tasksService.reorder).toHaveBeenCalledWith(7, { taskIds: [3, 1] });
  });

  it('rejects an invalid reorder payload before reaching the service', async () => {
    await request(app.getHttpServer()).put('/tasks/reorder').set('Authorization', 'Bearer test-token').send({ taskIds: [1, 1] }).expect(400);
    expect(tasksService.reorder).not.toHaveBeenCalled();
  });
});
