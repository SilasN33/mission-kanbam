import { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        localStorage.setItem('auth_token', password);
        onLogin();
      } else {
        setError('Senha incorreta');
        setPassword('');
      }
    } catch (e) {
      setError('Erro ao conectar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <span className="login-logo">⬡</span>
          <h1>Mission Kanban</h1>
          <p>Acesso restrito</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              disabled={loading}
              autoFocus
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="btn-login"
            disabled={loading || !password}
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>

        <p className="login-footer">🔒 Esta aplicação é privada</p>
      </div>
    </div>
  );
}
