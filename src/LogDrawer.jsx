import { useEffect, useRef, useState } from 'react';
import './LogDrawer.css';

export default function LogDrawer({ agentId, agentName, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const intervalRef = useRef(null);

  async function fetchLogs() {
    try {
      const res = await fetch(`/api/logs/${encodeURIComponent(agentId)}?limit=100`);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchLogs();
    intervalRef.current = setInterval(fetchLogs, 3000);
    return () => clearInterval(intervalRef.current);
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="drawer-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <h2>Logs — {agentName}</h2>
            <p>{agentId}</p>
          </div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body">
          {loading && <p className="log-empty">Carregando...</p>}
          {!loading && logs.length === 0 && <p className="log-empty">Nenhum log disponível.</p>}
          {logs.map((line, i) => (
            <div key={i} className={`log-line log-${line.level || 'info'}`}>
              <span className="log-ts">{line.ts ? new Date(line.ts).toLocaleTimeString() : ''}</span>
              <span className="log-lvl">[{line.level || 'info'}]</span>
              <span className="log-msg">{line.message || line.msg || line}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="drawer-footer">
          <span>Auto-refresh 3s</span>
          <button onClick={fetchLogs}>↻ Refresh</button>
        </div>
      </div>
    </div>
  );
}
