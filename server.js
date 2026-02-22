import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const TASKS_FILE = join(DATA_DIR, 'tasks.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);

const SEED = [
  { id: 'T-101', title: 'Connect Gateway', owner: 'Friday', description: 'Validate ws://127.0.0.1:18789 connection', status: 'Backlog', squad: 'infra', priority: 'high' },
  { id: 'T-102', title: 'Agent CRUD', owner: 'Atlas', description: 'Form + list for agents', status: 'In Progress', squad: 'core', priority: 'high' },
  { id: 'T-103', title: 'Mission UI', owner: 'Nyx', description: 'Minimal Kanban board', status: 'Review', squad: 'core', priority: 'medium' },
  { id: 'T-104', title: 'LLM Router', owner: 'Silas', description: 'Route prompts to best model', status: 'Backlog', squad: 'research', priority: 'medium' },
  { id: 'T-105', title: 'Docker Compose', owner: 'Atlas', description: 'Multi-service compose setup', status: 'Done', squad: 'infra', priority: 'low' },
  { id: 'T-106', title: 'Cost Tracker', owner: 'Friday', description: 'Token usage per run', status: 'In Progress', squad: 'ops', priority: 'medium' },
];

// ─── Tasks persistence ───────────────────────────────────────────────────────
function readTasks() {
  if (!existsSync(TASKS_FILE)) { writeFileSync(TASKS_FILE, JSON.stringify(SEED, null, 2)); return SEED; }
  return JSON.parse(readFileSync(TASKS_FILE, 'utf8'));
}
function writeTasks(tasks) { writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2)); }

// ─── OpenClaw status via CLI ─────────────────────────────────────────────────
let gwState = { connected: false, agents: [], sessions: [], lastPing: null };

async function pollGateway() {
  try {
    // Use openclaw CLI to fetch sessions (already authenticated)
    const { stdout } = await execAsync('openclaw gateway call sessions.list --params \'{}\' --json 2>/dev/null', { timeout: 8000 });
    const data = JSON.parse(stdout);
    const sessions = data?.result?.sessions || data?.sessions || [];
    gwState = {
      connected: true,
      agents: sessions.map(s => ({
        id: s.key || s.id,
        name: s.label || s.key || s.id,
        status: s.status === 'active' ? 'running' : (s.status || 'idle'),
        model: s.model || '—',
      })),
      sessions,
      lastPing: new Date().toISOString(),
    };
  } catch {
    // Try docker exec fallback if openclaw CLI not in PATH
    try {
      const container = process.env.OPENCLAW_CONTAINER || 'openclaw-r2gm-openclaw-1';
      const { stdout } = await execAsync(
        `docker exec ${container} openclaw gateway call sessions.list --params '{}' --json 2>/dev/null`,
        { timeout: 8000 }
      );
      const data = JSON.parse(stdout);
      const sessions = data?.result?.sessions || data?.sessions || [];
      gwState = {
        connected: true,
        agents: sessions.map(s => ({
          id: s.key || s.id,
          name: s.label || s.key || s.id,
          status: s.status === 'active' ? 'running' : (s.status || 'idle'),
          model: s.model || '—',
        })),
        sessions,
        lastPing: new Date().toISOString(),
      };
    } catch {
      gwState = { ...gwState, connected: false };
    }
  }
  broadcastStatus();
}

// Poll every 15s
pollGateway();
setInterval(pollGateway, 15000);

// ─── HTTP helpers ────────────────────────────────────────────────────────────
const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
function json(res, status, data) { res.writeHead(status, CORS); res.end(JSON.stringify(data)); }
function body(req) {
  return new Promise(resolve => {
    let d = ''; req.on('data', c => (d += c)); req.on('end', () => resolve(d ? JSON.parse(d) : {}));
  });
}

// ─── HTTP server ─────────────────────────────────────────────────────────────
const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  if (req.method === 'OPTIONS') return json(res, 204, {});

  // GET /api/tasks
  if (req.method === 'GET' && path === '/api/tasks') return json(res, 200, readTasks());

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
  const match = path.match(/^\/api\/tasks\/(.+)$/);
  if (match) {
    if (req.method === 'PUT') {
      const b = await body(req);
      let tasks = readTasks();
      tasks = tasks.map(t => t.id === match[1] ? { ...t, ...b } : t);
      writeTasks(tasks);
      return json(res, 200, tasks.find(t => t.id === match[1]) || {});
    }
    if (req.method === 'DELETE') {
      let tasks = readTasks();
      tasks = tasks.filter(t => t.id !== match[1]);
      writeTasks(tasks);
      return json(res, 200, { ok: true });
    }
  }

  // GET /api/status — gateway status + agents
  if (req.method === 'GET' && path === '/api/status') {
    return json(res, 200, {
      gateway: { connected: gwState.connected, lastPing: gwState.lastPing, url: GW_URL },
      agents: gwState.agents,
      sessions: gwState.sessions,
    });
  }

  json(res, 404, { error: 'Not found' });
});

// ─── WebSocket server (push updates to browser) ──────────────────────────────
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();

wss.on('connection', ws => {
  clients.add(ws);
  // Send current state immediately on connect
  ws.send(JSON.stringify({ type: 'status', data: gwState }));
  ws.on('close', () => clients.delete(ws));
});

function broadcastStatus() {
  const msg = JSON.stringify({ type: 'status', data: gwState });
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`API+WS running on http://0.0.0.0:${PORT}`));
