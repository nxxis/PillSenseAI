import { useState } from 'react';
import Spinner from '../components/Spinner.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const { login, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = loc.state?.from || '/upload';

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    const out = await login(email, password);
    if (!out.ok) setErr('Invalid email or password.');
    else nav(from, { replace: true });
  };

  return (
    <section className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
      <h2>Log in</h2>
      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: 12, marginTop: 12 }}
      >
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Email
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
          />
        </label>
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Password
          </div>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </label>
        {err && (
          <p className="muted" style={{ color: '#f87171' }}>
            {err}
          </p>
        )}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? <Spinner size={20} /> : 'Sign in'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 12 }}>
        Don’t have an account? <Link to="/register">Create one</Link>
      </p>
    </section>
  );
}
