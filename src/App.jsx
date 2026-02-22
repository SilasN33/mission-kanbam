import { useMemo, useState, useEffect, useCallback } from 'react';
import './App.css';

const COLUMNS = ['Backlog', 'In Progress', 'Review', 'Done'];

const SQUADS = {
  core: { label: 'Core', color: '#7c3aed' },
  research: { label: 'Research', color: '#a855f7' },
  infra: { label: 'Infra', color: '#6d28d9' },
  ops: { label: 'Ops', color: '#4c1d95' },
};

const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_COLOR = { low: '#4ade80', medium: '#facc15', high: '#f87171' };

const API = '/api';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSquad, setFilterSquad] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [showSquadMgr, setShowSquadMgr] = useState(false);
  const [form, setForm] = useState({ title: '', owner: '', description: '', squad: 'core', priority: 'medium' });

  const load = useCallback(async () => {
    try {
      const data = await api('/tasks');
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    filterSquad === 'all' ? tasks : tasks.filter(t => t.squad === filterSquad),
    [tasks, filterSquad]
  );

  const grouped = useMemo(() =>
    COLUMNS.reduce((acc, col) => { acc[col] = filtered.filter(t => t.status === col); return acc; }, {}),
    [filtered]
  );

  const move = async (id, dir) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const i = COLUMNS.indexOf(task.status);
    const newStatus = COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, i + dir))];
    if (newStatus === task.status) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      await api(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
    } catch { load(); }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      const task = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({ ...form, title: form.title.trim(), owner: form.owner.trim() || 'Unassigned' }),
      });
      setTasks(prev => [...prev, task]);
      setForm({ title: '', owner: '', description: '', squad: 'core', priority: 'medium' });
      setShowForm(false);
    } catch (e) { console.error(e); }
  };

  const deleteTask = async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await api(`/tasks/${id}`, { method: 'DELETE' }); } catch { load(); }
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

      <div className="filters">
        <button className={filterSquad === 'all' ? 'active' : ''} onClick={() => setFilterSquad('all')}>Todos</button>
        {Object.entries(SQUADS).map(([key, s]) => (
          <button key={key} className={filterSquad === key ? 'active' : ''} onClick={() => setFilterSquad(key)}>
            <span className="dot" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
        <span className="task-count">{tasks.length} tasks</span>
      </div>

      {loading ? (
        <div className="loading">Carregando tasks...</div>
      ) : (
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
                        <button className="btn-del" onClick={() => deleteTask(task.id)} title="Remover">✕</button>
                      </div>
                    </div>
                  );
                })}
                {grouped[col].length === 0 && <p className="empty">Vazio</p>}
              </div>
            </article>
          ))}
        </section>
      )}

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
