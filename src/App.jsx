import { useMemo, useState } from 'react';
import './App.css';

const columns = ['Backlog', 'In Progress', 'Review', 'Done'];

const seedTasks = [
  { id: 'T-101', title: 'Connect Gateway', owner: 'Friday', description: 'Validate ws://127.0.0.1:18789 connection', status: 'Backlog' },
  { id: 'T-102', title: 'Agent CRUD', owner: 'Atlas', description: 'Form + list for agents', status: 'In Progress' },
  { id: 'T-103', title: 'Mission UI', owner: 'Nyx', description: 'Minimal Kanban board', status: 'Review' },
];

export default function App() {
  const [tasks, setTasks] = useState(seedTasks);
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');

  const grouped = useMemo(() => {
    return columns.reduce((acc, col) => {
      acc[col] = tasks.filter((t) => t.status === col);
      return acc;
    }, {});
  }, [tasks]);

  const addTask = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = `T-${Date.now().toString().slice(-5)}`;
    setTasks((prev) => [
      ...prev,
      {
        id,
        title: title.trim(),
        owner: owner.trim() || 'Unassigned',
        description: description.trim(),
        status: 'Backlog',
      },
    ]);
    setTitle('');
    setOwner('');
    setDescription('');
  };

  const moveTask = (taskId, direction) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const currentIndex = columns.indexOf(task.status);
        const nextIndex = Math.min(
          columns.length - 1,
          Math.max(0, currentIndex + direction)
        );
        return { ...task, status: columns[nextIndex] };
      })
    );
  };

  const resetBoard = () => setTasks(seedTasks);

  return (
    <div className="app">
      <header>
        <div>
          <h1>Mission Kanban</h1>
          <p>Operação enxuta para o OpenClaw Mission Control.</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={resetBoard}>Reset</button>
          <a href="https://github.com/SilasN33/mission-kanbam" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </header>

      <section className="board">
        {columns.map((col) => (
          <article key={col} className="column">
            <div className="column-header">
              <h2>{col}</h2>
              <span>{grouped[col].length}</span>
            </div>
            <div className="column-body">
              {grouped[col].map((task) => (
                <div key={task.id} className="card">
                  <div className="card-meta">
                    <span className="task-id">{task.id}</span>
                    <span className="owner">{task.owner}</span>
                  </div>
                  <h3>{task.title}</h3>
                  {task.description && <p>{task.description}</p>}
                  <div className="card-actions">
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, -1)}
                      disabled={task.status === 'Backlog'}
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTask(task.id, 1)}
                      disabled={task.status === 'Done'}
                    >
                      ▶
                    </button>
                  </div>
                </div>
              ))}
              {grouped[col].length === 0 && (
                <p className="empty">Nenhuma tarefa aqui.</p>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="composer">
        <h2>Nova tarefa</h2>
        <form onSubmit={addTask}>
          <div className="form-grid">
            <label>
              Título
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Configurar proxy"
                required
              />
            </label>
            <label>
              Owner
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Responsável"
              />
            </label>
          </div>
          <label>
            Descrição
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes, links, etc."
            />
          </label>
          <button type="submit">Adicionar ao Backlog</button>
        </form>
      </section>
    </div>
  );
}
