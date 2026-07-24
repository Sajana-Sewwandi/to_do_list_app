import type { Task, TaskInput } from './types';

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? 'Something went wrong. Please try again.');
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

export const api = {
  login: (email: string, password: string) => request<{ access_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  tasks: (token: string) => request<Task[]>('/tasks', {}, token),
  createTask: (token: string, task: TaskInput) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(task) }, token),
  updateTask: (token: string, id: number, task: Partial<TaskInput>) => request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(task) }, token),
  deleteTask: (token: string, id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }, token),
  reorderTasks: (token: string, taskIds: number[]) => request<Task[]>('/tasks/reorder', { method: 'PUT', body: JSON.stringify({ taskIds }) }, token),
};
