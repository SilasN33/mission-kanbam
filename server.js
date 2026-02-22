import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const TASKS_FILE = join(DATA_DIR, 'tasks.json');

// Ensure data dir exists
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

const SEED = [
  { id: 'T-101', title: 'Connect Gateway', owner: 'Friday', description: 'Validate ws://127.0.0.1:18789 connection', status: 'Backlog', squad: 'infra', priority: 'high' },
  { id: 'T-102', title: 'Agent CRUD', owner: 'Atlas', description: 'Form + list for agents', status: 'In Progress', squad: 'core', priority: 'high' },
  { id: 'T-103', title: 'Mission UI', owner: 'Nyx', description: 'Minimal Kanban board', status: 'Review', squad: 'core', priority: 'medium' },
  { id: 'T-104', title: 'LLM Router', owner: 'Silas', description: 'Route prompts to best model', status: 'Backlog', squad: 'research', priority: 'medium' },
  { id: 'T-105', title: 'Docker Compose', owner: 'Atlas', description: 'Multi-service compose setup', status: 'Done', squad: 'infra', priority: 'low' },
  { id: 'T-106', title: 'Cost Tracker', owner: 'Friday', description: 'Token usage per run', status: 'In Progress', squad: 'ops', priority: 'medium' },
];

function readTasks() {
  if (!existsSync(TASKS_FILE)) {
    writeFileSync(TASKS_FILE, JSON.stringify(SEED, null, 2));
    return SEED;
  }
  return JSON.parse(readFileSync(TASKS_FILE, 'utf8'));
}

function writeTasks(tasks) {
  writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data ? JSON.parse(data) : {}));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const path = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') return json(res, 204, {});

  // GET /api/tasks
  if (req.method === 'GET' && path === '/api/tasks') {
    return json(res, 200, readTasks());
  }

  // POST /api/tasks
  if (req.method === 'POST' && path === '/api/tasks') {
    const b = await body(req);
    const tasks = readTasks();
    const task = { ...b, id: `T-${Date.now().toString().slice(-5)}`, status: 'Backlog' };
    tasks.push(task);
    writeTasks(tasks);
    return json(res, 201, task);
  }

  // PUT /api/tasks/:id
  const putMatch = path.match(/^\/api\/tasks\/(.+)$/);
  if (req.method === 'PUT' && putMatch) {
    const b = await body(req);
    let tasks = readTasks();
    tasks = tasks.map(t => t.id === putMatch[1] ? { ...t, ...b } : t);
    writeTasks(tasks);
    const updated = tasks.find(t => t.id === putMatch[1]);
    return updated ? json(res, 200, updated) : json(res, 404, { error: 'Not found' });
  }

  // DELETE /api/tasks/:id
  const delMatch = path.match(/^\/api\/tasks\/(.+)$/);
  if (req.method === 'DELETE' && delMatch) {
    let tasks = readTasks();
    tasks = tasks.filter(t => t.id !== delMatch[1]);
    writeTasks(tasks);
    return json(res, 200, { ok: true });
  }

  json(res, 404, { error: 'Not found' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`API running on http://0.0.0.0:${PORT}`));
