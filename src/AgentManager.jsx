import { useState, useEffect } from 'react';
import './AgentManager.css';

const MODELS = [
  'openai/gpt-5-mini',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-3-5-haiku',
  'google/gemini-2.0-flash',
];

const SQUADS = {
  core: 'Core',
  research: 'Research',
  infra: 'Infra',
  ops: 'Ops',
};

const EMPTY_FORM = {
  name: '',
  model: 'openai/gpt-5-mini',
  systemPrompt: '',
  squad: 'core',
  maxTokens: 4096,
  description: '',
};

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AgentManager({ onClose, gwAgents = [] }) {
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  async function load() {
    try { setAgents(await api('/managed-agents')); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function startEdit(agent) {
    setEditing(agent.id);
    setForm({ name: agent.name, model: agent.model, systemPrompt: agent.systemPrompt || '', squad: agent.squad || 'core', maxTokens: agent.maxTokens || 4096, description: agent.description || '' });
    setShowForm(true);
  }

  function startNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const updated = await api(`/managed-agents/${editing}`, { method: 'PUT', body: JSON.stringify(form) });
        setAgents(prev => prev.map(a => a.id === editing ? updated : a));
      } else {
        const created = await api('/managed-agents', { method: 'POST', body: JSON.stringify(form) });
        setAgents(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!confirm('Remover agente?')) return;
    await api(`/managed-agents/${id}`, { method: 'DELETE' });
    setAgents(prev => prev.filter(a => a.id !== id));
  }

  async function agentAction(agentId, action) {
    setActionLoading(prev => ({ ...prev, [agentId]: action }));
    try { await api(`/agents/${encodeURIComponent(agentId)}/${action}`, { method: 'POST' }); }
    catch (e) { console.error(e); }
    finally { setActionLoading(prev => ({ ...prev, [agentId]: null })); }
  }

  // Find live status for a managed agent
  function liveStatus(agentId) {
    return gwAgents.find(a => a.id === agentId || a.name === agentId)?.status || 'idle';
  }

  const STATUS_COLOR = { idle: '#4ade80', running: '#facc15', error: '#f87171' };

  return (
    <div className="am-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="am-panel">
        <div className="am-header">
          <div>
            <h2>Gerenciar Agentes</h2>
            <p>{agents.length} agente{agents.length !== 1 ? 's' : ''} configurado{agents.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="am-header-actions">
            <button className="btn-primary" onClick={startNew}>+ Novo Agente</button>
            <button onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Agent Form */}
        {showForm && (
          <form className="am-form" onSubmit={save}>
            <h3>{editing ? 'Editar Agente' : 'Novo Agente'}</h3>
            <div className="am-form-grid">
              <label>Nome
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ex.: Researcher-01" />
              </label>
              <label>Modelo
                <select value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label>Squad
                <select value={form.squad} onChange={e => setForm(f => ({ ...f, squad: e.target.value }))}>
                  {Object.entries(SQUADS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>Max Tokens
                <input type="number" value={form.maxTokens} onChange={e => setForm(f => ({ ...f, maxTokens: parseInt(e.target.value) }))} min={256} max={128000} step={256} />
              </label>
            </div>
            <label>Descrição
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Resumo do papel deste agente" />
            </label>
            <label>System Prompt
              <textarea
                value={form.systemPrompt}
                onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                placeholder="Você é um especialista em..."
                rows={5}
              />
            </label>
            <div className="am-form-actions">
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar Agente'}</button>
            </div>
          </form>
        )}

        {/* Agent List */}
        <div className="am-list">
          {loading && <p className="am-empty">Carregando...</p>}
          {!loading && agents.length === 0 && !showForm && (
            <div className="am-empty-state">
              <p>🤖</p>
              <p>Nenhum agente criado ainda.</p>
              <button className="btn-primary" onClick={startNew}>Criar primeiro agente</button>
            </div>
          )}
          {agents.map(agent => {
            const status = liveStatus(agent.id);
            return (
              <div key={agent.id} className="am-card">
                <div className="am-card-left">
                  <div className="am-status-dot" style={{ background: STATUS_COLOR[status] || '#6b7280' }} />
                  <div>
                    <strong>{agent.name}</strong>
                    <p>{agent.model} · {SQUADS[agent.squad] || agent.squad} · {agent.maxTokens?.toLocaleString()} tokens</p>
                    {agent.description && <p className="am-desc">{agent.description}</p>}
                  </div>
                </div>
                <div className="am-card-actions">
                  {status !== 'running' ? (
                    <button className="btn-run" disabled={!!actionLoading[agent.id]} onClick={() => agentAction(agent.id, 'run')}>
                      {actionLoading[agent.id] === 'run' ? '...' : '▶'}
                    </button>
                  ) : (
                    <button className="btn-stop" disabled={!!actionLoading[agent.id]} onClick={() => agentAction(agent.id, 'stop')}>
                      {actionLoading[agent.id] === 'stop' ? '...' : '■'}
                    </button>
                  )}
                  <button onClick={() => startEdit(agent)}>✏️</button>
                  <button className="btn-danger" onClick={() => remove(agent.id)}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
