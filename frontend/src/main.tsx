import { DragEvent, FormEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAppStore } from './store';
import type { Task, TaskInput, TaskStatus } from './types';
import './styles.css';

const emptyTask: TaskInput = { title: '', description: '', status: 'todo', dueDate: '' };

function ErrorMessage() {
  const { error, clearError } = useAppStore();
  return error ? <div className="error" role="alert">{error}<button onClick={clearError} aria-label="Dismiss error">x</button></div> : null;
}

function AuthScreen() {
  const { authenticate, loading } = useAppStore();
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const submit = async (event: FormEvent) => { event.preventDefault(); await authenticate(email, password, registering ? name : undefined); };
  return <main className="auth-page"><section className="auth-card"><div className="brand"><span>+</span><h1>TaskFlow</h1></div><p>{registering ? 'Create an account to organise your day.' : 'Welcome back. Sign in to your tasks.'}</p><ErrorMessage /><form onSubmit={submit}>{registering && <label>Name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex" /></label>}<label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label><button className="primary" disabled={loading}>{loading ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}</button></form><button className="link" onClick={() => setRegistering(!registering)}>{registering ? 'Already have an account? Sign in' : 'New here? Create an account'}</button></section></main>;
}

function TaskForm({ task, onSave, onCancel }: { task?: Task; onSave: (task: TaskInput) => Promise<void>; onCancel?: () => void }) {
  const [form, setForm] = useState<TaskInput>(task ? { title: task.title, description: task.description, status: task.status, dueDate: task.dueDate.slice(0, 10) } : emptyTask);
  const submit = async (event: FormEvent) => { event.preventDefault(); await onSave({ ...form, dueDate: new Date(`${form.dueDate}T12:00:00`).toISOString() }); if (!task) setForm(emptyTask); };
  return <form className="task-form" onSubmit={submit}><label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs doing?" /></label><label>Description<textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add a few details" /></label><div className="form-row"><label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}><option value="todo">To do</option><option value="in-progress">In progress</option><option value="done">Done</option></select></label><label>Due date<input required type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label></div><div className="form-actions">{onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}<button className="primary">{task ? 'Save changes' : 'Add task'}</button></div></form>;
}

function TaskCard({ task, index, draggedTaskId, onDragStart, onDrop }: { task: Task; index: number; draggedTaskId: number | null; onDragStart: (event: DragEvent<HTMLElement>, id: number) => void; onDrop: (event: DragEvent<HTMLElement>, index: number) => void }) {
  const { updateTask, deleteTask } = useAppStore(); const [editing, setEditing] = useState(false);
  const status = task.status.replace('-', ' '); const due = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(task.dueDate));
  if (editing) return <article className="task-card editing"><TaskForm task={task} onSave={async (data) => { await updateTask(task.id, data); setEditing(false); }} onCancel={() => setEditing(false)} /></article>;
  return <article className={`task-card draggable ${draggedTaskId === task.id ? 'dragging' : ''}`} draggable onDragStart={(event) => onDragStart(event, task.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, index)}><div className="task-top"><span className={`status ${task.status}`}>{status}</span><span className="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">::</span></div><h3>{task.title}</h3><p>{task.description}</p><footer><span>Due {due}</span><div><button className="text-button" onClick={() => setEditing(true)}>Edit</button><button className="text-button danger" onClick={() => deleteTask(task.id)}>Delete</button></div></footer></article>;
}

function Dashboard() {
  const { tasks, loading, loadTasks, addTask, logout, reorderTasks } = useAppStore(); const [creating, setCreating] = useState(false); const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  useEffect(() => { void loadTasks(); }, [loadTasks]);
  const startDrag = (event: DragEvent<HTMLElement>, taskId: number) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(taskId)); setDraggedTaskId(taskId); };
  const dropTask = (event: DragEvent<HTMLElement>, toIndex: number) => { event.preventDefault(); const taskId = Number(event.dataTransfer.getData('text/plain')); const fromIndex = tasks.findIndex((task) => task.id === taskId); setDraggedTaskId(null); void reorderTasks(fromIndex, toIndex); };
  return <main className="app"><header><div className="brand"><span>+</span><h1>TaskFlow</h1></div><button className="secondary" onClick={logout}>Sign out</button></header><ErrorMessage /><section className="hero"><div><p className="eyebrow">YOUR TASKS</p><h2>Make progress, one task at a time.</h2><p>{tasks.length === 0 ? 'Start by adding your first task.' : `${tasks.length} task${tasks.length === 1 ? '' : 's'} in your personal order. Drag a task tile to reorder it.`}</p></div><button className="primary" onClick={() => setCreating(!creating)}>{creating ? 'Close form' : '+ Add task'}</button></section>{creating && <section className="new-task"><h2>New task</h2><TaskForm onSave={async (task) => { await addTask(task); setCreating(false); }} /></section>}<section className="task-list">{loading ? <p>Loading your tasks...</p> : tasks.map((task, index) => <TaskCard key={task.id} task={task} index={index} draggedTaskId={draggedTaskId} onDragStart={startDrag} onDrop={dropTask} />)}{!loading && tasks.length === 0 && <div className="empty">No tasks yet. Add one to get started.</div>}</section></main>;
}

function App() { const token = useAppStore((state) => state.token); return token ? <Dashboard /> : <AuthScreen />; }
createRoot(document.getElementById('root')!).render(<App />);
