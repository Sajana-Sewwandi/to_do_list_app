import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';
import type { Task, TaskInput } from './types';

type AppState = {
  token: string | null; tasks: Task[]; loading: boolean; error: string | null;
  authenticate: (email: string, password: string, name?: string) => Promise<void>;
  loadTasks: () => Promise<void>; addTask: (task: TaskInput) => Promise<void>;
  updateTask: (id: number, task: Partial<TaskInput>) => Promise<void>; deleteTask: (id: number) => Promise<void>;
  reorderTasks: (fromIndex: number, toIndex: number) => Promise<void>; logout: () => void; clearError: () => void;
};

export const useAppStore = create<AppState>()(persist((set, get) => ({
  token: null, tasks: [], loading: false, error: null,
  clearError: () => set({ error: null }), logout: () => set({ token: null, tasks: [], error: null }),
  authenticate: async (email, password, name) => {
    set({ loading: true, error: null });
    try { if (name) await api.register(name, email, password); const { access_token } = await api.login(email, password); set({ token: access_token }); await get().loadTasks(); }
    catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to sign in.' }); }
    finally { set({ loading: false }); }
  },
  loadTasks: async () => {
    const { token } = get(); if (!token) return; set({ loading: true, error: null });
    try { set({ tasks: await api.tasks(token) }); } catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to load tasks.' }); } finally { set({ loading: false }); }
  },
  addTask: async (task) => { const { token } = get(); if (!token) return; try { set({ tasks: [...get().tasks, await api.createTask(token, task)] }); } catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to create task.' }); } },
  updateTask: async (id, task) => { const { token } = get(); if (!token) return; try { const updated = await api.updateTask(token, id, task); set({ tasks: get().tasks.map((item) => item.id === id ? updated : item) }); } catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to update task.' }); } },
  deleteTask: async (id) => { const { token } = get(); if (!token) return; try { await api.deleteTask(token, id); set({ tasks: get().tasks.filter((task) => task.id !== id) }); } catch (error) { set({ error: error instanceof Error ? error.message : 'Unable to delete task.' }); } },
  reorderTasks: async (fromIndex, toIndex) => {
    const { token, tasks } = get();
    if (!token || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= tasks.length || toIndex >= tasks.length) return;
    const reordered = [...tasks];
    const [movedTask] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedTask);
    set({ tasks: reordered });
    try { await api.reorderTasks(token, reordered.map((task) => task.id)); }
    catch (error) { set({ tasks, error: error instanceof Error ? error.message : 'Unable to reorder tasks.' }); }
  },
}), { name: 'taskflow-session', partialize: (state) => ({ token: state.token }) }));
