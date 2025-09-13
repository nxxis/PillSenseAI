import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../lib/api';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Profile fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('unspecified');

  const [err, setErr] = useState('');
  const { register, loading } = useAuth();
  const nav = useNavigate();

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
    <section className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2>Create account</h2>
      <form
        onSubmit={onSubmit}
        style={{ display: 'grid', gap: 12, marginTop: 12 }}
      >
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Name
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
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
            placeholder="Min 8 characters"
          />
        </label>

        {/* Date of Birth */}
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Date of Birth
          </div>
          <input
            type="date"
            required
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="input"
          />
        </label>

        {/* Gender */}
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Gender
          </div>
          <select
            className="input"
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

        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 12 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
