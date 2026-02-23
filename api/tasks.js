import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TASKS_FILE = join(process.cwd(), 'data', 'tasks.json');

const SEED = [
  { id: 'T-01', title: 'Melhorar UI/UX do Mission Control', owner: 'Web Design Expert', description: 'Analisar e implementar melhorias de design', squad: 'core', priority: 'high', status: 'Backlog' },
  { id: 'T-101', title: 'Connect Gateway', owner: 'Friday', description: 'Validate ws://127.0.0.1:18789 connection', squad: 'infra', priority: 'high', status: 'Backlog' },
  { id: 'T-102', title: 'Agent CRUD', owner: 'Atlas', description: 'Form + list for agents', squad: 'core', priority: 'high', status: 'In Progress' },
  { id: 'T-103', title: 'Mission UI', owner: 'Nyx', description: 'Minimal Kanban board', squad: 'core', priority: 'medium', status: 'Review' },
  { id: 'T-104', title: 'LLM Router', owner: 'Silas', description: 'Route prompts to best model', squad: 'research', priority: 'medium', status: 'Backlog' },
  { id: 'T-105', title: 'Docker Compose', owner: 'Atlas', description: 'Multi-service compose setup', squad: 'infra', priority: 'low', status: 'Done' },
  { id: 'T-106', title: 'Cost Tracker', owner: 'Friday', description: 'Token usage per run', squad: 'ops', priority: 'medium', status: 'In Progress' },
];

function readTasks() {
  try {
    if (!existsSync(TASKS_FILE)) {
      writeFileSync(TASKS_FILE, JSON.stringify(SEED, null, 2));
      return SEED;
    }
    return JSON.parse(readFileSync(TASKS_FILE, 'utf8'));
  } catch {
    return SEED;
  }
}

function writeTasks(tasks) {
  try {
    writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
  } catch (e) {
    console.error('Error writing tasks:', e);
  }
}

export default function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET' && !id) {
    return res.status(200).json(readTasks());
  }

  if (req.method === 'POST' && !id) {
    const { title, owner, description, squad, priority } = req.body;
    const tasks = readTasks();
    const task = {
      id: `T-${Date.now().toString().slice(-5)}`,
      title: title.trim(),
      owner: owner.trim() || 'Unassigned',
      description: description || '',
      squad: squad || 'core',
      priority: priority || 'medium',
      status: 'Backlog',
    };
    tasks.push(task);
    writeTasks(tasks);
    return res.status(201).json(task);
  }

  if (req.method === 'PUT' && id) {
    const { status } = req.body;
    let tasks = readTasks();
    tasks = tasks.map(t => t.id === id ? { ...t, ...req.body } : t);
    writeTasks(tasks);
    return res.status(200).json(tasks.find(t => t.id === id));
  }

  if (req.method === 'DELETE' && id) {
    let tasks = readTasks();
    tasks = tasks.filter(t => t.id !== id);
    writeTasks(tasks);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
