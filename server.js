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

const AGENTS_FILE = join(DATA_DIR, 'agents.json');
function readAgents() {
  if (!existsSync(AGENTS_FILE)) return [];
  return JSON.parse(readFileSync(AGENTS_FILE, 'utf8'));
}
function writeAgents(agents) { writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2)); }

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

  // ── Managed Agents CRUD ───────────────────────────────────────────────────
  if (req.method === 'GET' && path === '/api/managed-agents') {
    return json(res, 200, readAgents());
  }
  if (req.method === 'POST' && path === '/api/managed-agents') {
    const b = await body(req);
    const agents = readAgents();
    const agent = { ...b, id: `agent-${Date.now()}`, createdAt: new Date().toISOString() };
    agents.push(agent);
    writeAgents(agents);
    return json(res, 201, agent);
  }
  const agentCrudMatch = path.match(/^\/api\/managed-agents\/(.+)$/);
  if (agentCrudMatch) {
    const id = agentCrudMatch[1];
    if (req.method === 'PUT') {
      const b = await body(req);
      let agents = readAgents();
      agents = agents.map(a => a.id === id ? { ...a, ...b, id } : a);
      writeAgents(agents);
      return json(res, 200, agents.find(a => a.id === id) || {});
    }
    if (req.method === 'DELETE') {
      writeAgents(readAgents().filter(a => a.id !== id));
      return json(res, 200, { ok: true });
    }
  }

  // GET /api/status
  if (req.method === 'GET' && path === '/api/status') {
    return json(res, 200, {
      gateway: { connected: gwState.connected, lastPing: gwState.lastPing },
      agents: gwState.agents,
      sessions: gwState.sessions,
    });
  }

  // GET /api/costs
  if (req.method === 'GET' && path === '/api/costs') {
    const PRICING = {
      'openai/gpt-5-mini': { in: 0.15 / 1000000, out: 0.60 / 1000000 },
      'openai/gpt-4o': { in: 5 / 1000000, out: 15 / 1000000 },
      'openai/gpt-4o-mini': { in: 0.15 / 1000000, out: 0.60 / 1000000 },
      'anthropic/claude-sonnet-4-6': { in: 3 / 1000000, out: 15 / 1000000 },
      'anthropic/claude-3-5-haiku': { in: 0.80 / 1000000, out: 4 / 1000000 },
      'google/gemini-2.0-flash': { in: 0.075 / 1000000, out: 0.30 / 1000000 },
    };

    const costs = gwState.sessions.map(s => {
      const model = s.model || 'unknown';
      const pricing = PRICING[model] || { in: 0, out: 0 };
      const inTokens = s.inputTokens || 0;
      const outTokens = s.outputTokens || 0;
      const inCost = inTokens * pricing.in;
      const outCost = outTokens * pricing.out;
      const totalCost = inCost + outCost;
      
      return {
        key: s.key || s.id,
        displayName: s.label || s.key || s.id,
        model,
        inputTokens: inTokens,
        outputTokens: outTokens,
        inputCost: parseFloat(inCost.toFixed(6)),
        outputCost: parseFloat(outCost.toFixed(6)),
        totalCost: parseFloat(totalCost.toFixed(6)),
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    return json(res, 200, costs);
  }

  // POST /api/agents/:id/run — start a run
  const runMatch = path.match(/^\/api\/agents\/(.+)\/run$/);
  if (req.method === 'POST' && runMatch) {
    const agentId = runMatch[1];
    try {
      const container = process.env.OPENCLAW_CONTAINER || '';
      const prefix = container ? `docker exec ${container} ` : '';
      await execAsync(`${prefix}openclaw gateway call sessions.run --params '{"agentId":"${agentId}"}' 2>/dev/null`, { timeout: 8000 });
      return json(res, 200, { ok: true, agentId });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // DELETE /api/agents/:id/run — stop a run
  const stopMatch = path.match(/^\/api\/agents\/(.+)\/stop$/);
  if (req.method === 'POST' && stopMatch) {
    const agentId = stopMatch[1];
    try {
      const container = process.env.OPENCLAW_CONTAINER || '';
      const prefix = container ? `docker exec ${container} ` : '';
      await execAsync(`${prefix}openclaw gateway call sessions.kill --params '{"key":"${agentId}"}' 2>/dev/null`, { timeout: 8000 });
      return json(res, 200, { ok: true, agentId });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // DELETE /api/agents/:id — unregister agent from OpenClaw gateway
  const deleteAgentMatch = path.match(/^\/api\/agents\/([^/]+)$/);
  if (req.method === 'DELETE' && deleteAgentMatch) {
    const agentId = decodeURIComponent(deleteAgentMatch[1]);
    const container = process.env.OPENCLAW_CONTAINER || '';
    const prefix = container ? `docker exec ${container} ` : '';
    // Try to kill any running session first, then unregister
    try {
      await execAsync(`${prefix}openclaw gateway call sessions.kill --params '{"key":"${agentId}"}' 2>/dev/null`, { timeout: 5000 });
    } catch { /* ignore — may not be running */ }
    try {
      await execAsync(`${prefix}openclaw gateway call agents.unregister --params '{"agentId":"${agentId}"}' --json 2>/dev/null`, { timeout: 8000 });
    } catch { /* best-effort: gateway may not support unregister */ }
    // Remove from local gwState immediately so next broadcast reflects it
    gwState = { ...gwState, agents: gwState.agents.filter(a => a.id !== agentId && a.name !== agentId) };
    broadcastStatus();
    return json(res, 200, { ok: true, agentId });
  }

  // GET /api/logs/:agentId — tail logs for agent/session
  const logsMatch = path.match(/^\/api\/logs\/(.+)$/);
  if (req.method === 'GET' && logsMatch) {
    const agentId = decodeURIComponent(logsMatch[1]);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    try {
      const container = process.env.OPENCLAW_CONTAINER || '';
      const prefix = container ? `docker exec ${container} ` : '';
      const { stdout } = await execAsync(
        `${prefix}openclaw gateway call sessions.history --params '{"sessionKey":"${agentId}","limit":${limit}}' --json 2>/dev/null`,
        { timeout: 8000 }
      );
      const data = JSON.parse(stdout);
      const messages = data?.result?.messages || data?.messages || [];
      const logs = messages.map(m => ({
        ts: m.timestamp || m.ts || null,
        level: m.role === 'assistant' ? 'info' : 'debug',
        message: typeof m.content === 'string' ? m.content : JSON.stringify(m.content).slice(0, 300),
      }));
      return json(res, 200, { logs });
    } catch (e) {
      // Fallback: try docker logs
      try {
        const container = process.env.OPENCLAW_CONTAINER || '';
        if (container) {
          const { stdout } = await execAsync(`docker logs --tail ${limit} ${container} 2>&1`, { timeout: 5000 });
          const logs = stdout.split('\n').filter(Boolean).map(line => ({ ts: null, level: 'info', message: line }));
          return json(res, 200, { logs });
        }
      } catch {}
      return json(res, 200, { logs: [] });
    }
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
