import { useState } from 'react';
import Spinner from '../components/Spinner.jsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Login.css';
import logo from '../assets/pill-logo.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const { login, loading, user } = useAuth();
  // Redirect if already logged in
  if (user) {
    nav('/upload', { replace: true });
    return null;
  }
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
    <div className="login-bg fade-transition">
      <div className="login-container">
        <div className="login-info">
          <img
            src={logo}
            alt="PillSenseAI Logo"
            style={{ width: 64, height: 64, marginBottom: 16 }}
          />
          <h1>PillSenseAI</h1>
          <p>
            Welcome to PillSenseAI! Connect with your health and medication
            reminders, powered by AI. Stay organized and informed about your
            prescriptions and wellness.
          </p>
          <p className="muted">Your health, simplified.</p>
        </div>
        <div className="login-form-section">
          <form className="login-form" onSubmit={onSubmit}>
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>
              Log in
            </h2>
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Email
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                placeholder="••••••••"
              />
            </label>
            {err && (
              <p className="muted" style={{ color: '#f87171' }}>
                {err}
              </p>
            )}
            <button type="submit" disabled={loading}>
              {loading ? <Spinner size={20} /> : 'Sign in'}
            </button>
            <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
              Don’t have an account?{' '}
              <span
                style={{
                  color: '#2bb7b3',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                onClick={() => nav('/register')}
              >
                Create one
              </span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
