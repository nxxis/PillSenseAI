import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';
import '../styles/Register.css';
import logo from '../assets/pill-logo.svg';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Profile fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('unspecified');

  const [err, setErr] = useState('');
  const { register, loading, user } = useAuth();
  const nav = useNavigate();
  if (user) {
    nav('/upload', { replace: true });
    return null;
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr('');

    // 1) Create account (AuthContext now returns token & user and writes to localStorage immediately)
    const out = await register(name, email, password);
    if (!out.ok) {
      setErr(
        out.error === 'email_in_use'
          ? 'Email already in use.'
          : 'Could not create account.'
      );
      return;
    }

    // 2) Save DOB/Gender using the returned token (avoid relying on localStorage timing)
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${out.token}`,
        },
        body: JSON.stringify({ dobISO: dob, gender }),
      });
      const data = await res.json();
      if (!data.ok) {
        console.warn('Profile save failed:', data.error);
        alert(
          `Account created, but saving DOB/Gender failed: ${
            data.error || 'unknown error'
          }. You can update it later on the Profile page.`
        );
      }
    } catch (e2) {
      console.warn('Profile save error:', e2);
      alert(
        'Account created, but saving DOB/Gender failed. You can update it later on the Profile page.'
      );
    }

    // 3) Go to Upload
    nav('/upload', { replace: true });
  };

  return (
    <div className="login-bg fade-transition">
      <div className="register-container">
        <div className="register-info">
          <img
            src={logo}
            alt="PillSenseAI Logo"
            style={{ width: 64, height: 64, marginBottom: 16 }}
          />
          <h1>PillSenseAI</h1>
          <p>
            Create your PillSenseAI account to get started with smart medication
            reminders and health management.
          </p>
          <p className="muted">Your health, simplified.</p>
        </div>
        <div className="register-form-section">
          <form className="register-form" onSubmit={onSubmit}>
            <h2>Create account</h2>
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Name
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
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
                placeholder="Min 8 characters"
              />
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Date of Birth
              </div>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </label>
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                Gender
              </div>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="unspecified">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </label>
            {err && (
              <p className="muted" style={{ color: '#f87171' }}>
                {err}
              </p>
            )}
            <button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
            <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
              Already have an account?{' '}
              <span
                style={{
                  color: '#2bb7b3',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                onClick={() => nav('/login')}
              >
                Sign in
              </span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
