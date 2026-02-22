import { useMemo, useState } from 'react';
import './App.css';

const COLUMNS = ['Backlog', 'In Progress', 'Review', 'Done'];

const SQUADS = {
  core: { label: 'Core', color: '#7c3aed' },
  research: { label: 'Research', color: '#a855f7' },
  infra: { label: 'Infra', color: '#6d28d9' },
  ops: { label: 'Ops', color: '#4c1d95' },
};

const PRIORITIES = ['low', 'medium', 'high'];

const SEED = [
  { id: 'T-101', title: 'Connect Gateway', owner: 'Friday', description: 'Validate ws://127.0.0.1:18789 connection', status: 'Backlog', squad: 'infra', priority: 'high' },
  { id: 'T-102', title: 'Agent CRUD', owner: 'Atlas', description: 'Form + list for agents', status: 'In Progress', squad: 'core', priority: 'high' },
  { id: 'T-103', title: 'Mission UI', owner: 'Nyx', description: 'Minimal Kanban board', status: 'Review', squad: 'core', priority: 'medium' },
  { id: 'T-104', title: 'LLM Router', owner: 'Silas', description: 'Route prompts to best model', status: 'Backlog', squad: 'research', priority: 'medium' },
  { id: 'T-105', title: 'Docker Compose', owner: 'Atlas', description: 'Multi-service compose setup', status: 'Done', squad: 'infra', priority: 'low' },
  { id: 'T-106', title: 'Cost Tracker', owner: 'Friday', description: 'Token usage per run', status: 'In Progress', squad: 'ops', priority: 'medium' },
];

const PRIORITY_COLOR = { low: '#4ade80', medium: '#facc15', high: '#f87171' };

function newId() {
  return `T-${Date.now().toString().slice(-5)}`;
}

export default function App() {
  const [tasks, setTasks] = useState(SEED);
  const [filterSquad, setFilterSquad] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showSquadMgr, setShowSquadMgr] = useState(false);
  const [form, setForm] = useState({ title: '', owner: '', description: '', squad: 'core', priority: 'medium' });

  const filtered = useMemo(() =>
    filterSquad === 'all' ? tasks : tasks.filter(t => t.squad === filterSquad),
    [tasks, filterSquad]
  );

  const grouped = useMemo(() =>
    COLUMNS.reduce((acc, col) => { acc[col] = filtered.filter(t => t.status === col); return acc; }, {}),
    [filtered]
  );

  const move = (id, dir) => setTasks(prev => prev.map(t => {
    if (t.id !== id) return t;
    const i = COLUMNS.indexOf(t.status);
    return { ...t, status: COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, i + dir))] };
  }));

  const addTask = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setTasks(prev => [...prev, { ...form, id: newId(), status: 'Backlog', title: form.title.trim(), owner: form.owner.trim() || 'Unassigned', description: form.description.trim() }]);
    setForm({ title: '', owner: '', description: '', squad: 'core', priority: 'medium' });
    setShowForm(false);
  };

  const squadStats = useMemo(() =>
    Object.entries(SQUADS).map(([key, s]) => ({
      key, ...s,
      count: tasks.filter(t => t.squad === key).length,
      done: tasks.filter(t => t.squad === key && t.status === 'Done').length,
    })),
    [tasks]
  );

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo">⬡</span>
          <div>
            <h1>Mission Kanban</h1>
            <p>Operação enxuta · OpenClaw Agents</p>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowSquadMgr(s => !s)}>Squads</button>
          <button className="btn-primary" onClick={() => setShowForm(s => !s)}>+ Nova tarefa</button>
        </div>
      </header>

      {/* Squad manager panel */}
      {showSquadMgr && (
        <section className="squad-panel">
          <h2>Grupos de Agentes</h2>
          <div className="squad-grid">
            {squadStats.map(s => (
              <div key={s.key} className="squad-card" style={{ '--squad-color': s.color }}>
                <div className="squad-dot" />
                <div>
                  <strong>{s.label}</strong>
                  <p>{s.count} tasks · {s.done} done</p>
                </div>
                <div className="squad-bar">
                  <div className="squad-fill" style={{ width: s.count ? `${(s.done / s.count) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      <div className="filters">
        <button className={filterSquad === 'all' ? 'active' : ''} onClick={() => setFilterSquad('all')}>Todos</button>
        {Object.entries(SQUADS).map(([key, s]) => (
          <button key={key} className={filterSquad === key ? 'active' : ''} onClick={() => setFilterSquad(key)} style={{ '--squad-color': s.color }}>
            <span className="dot" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Board */}
      <section className="board">
        {COLUMNS.map(col => (
          <article key={col} className="column">
            <div className="col-header">
              <h2>{col}</h2>
              <span className="count">{grouped[col].length}</span>
            </div>
            <div className="col-body">
              {grouped[col].map(task => {
                const squad = SQUADS[task.squad];
                return (
                  <div key={task.id} className="card" style={{ '--squad-color': squad?.color || '#7c3aed' }}>
                    <div className="card-stripe" />
                    <div className="card-meta">
                      <span className="task-id">{task.id}</span>
                      <span className="priority-dot" style={{ background: PRIORITY_COLOR[task.priority] }} title={task.priority} />
                    </div>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                    <div className="card-footer">
                      <span className="squad-badge" style={{ background: squad?.color + '33', color: squad?.color }}>{squad?.label}</span>
                      <span className="owner">{task.owner}</span>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => move(task.id, -1)} disabled={task.status === 'Backlog'}>◀</button>
                      <button onClick={() => move(task.id, 1)} disabled={task.status === 'Done'}>▶</button>
                    </div>
                  </div>
                );
              })}
              {grouped[col].length === 0 && <p className="empty">Vazio</p>}
            </div>
          </article>
        ))}
      </section>

      {/* New task form */}
      {showForm && (
        <section className="composer">
          <h2>Nova Tarefa</h2>
          <form onSubmit={addTask}>
            <div className="form-row">
              <label>Título<input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></label>
              <label>Owner<input value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} /></label>
            </div>
            <label>Descrição<textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
            <div className="form-row">
              <label>Squad
                <select value={form.squad} onChange={e => setForm(f => ({ ...f, squad: e.target.value }))}>
                  {Object.entries(SQUADS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                </select>
              </label>
              <label>Prioridade
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setShowForm(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">Adicionar</button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
