import { useEffect, useState } from 'react';
import { getJson } from '../lib/api';

export default function Profile() {
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('unspecified');
  const [age, setAge] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getJson('/profile').then((r) => {
      if (r.ok && r.profile) {
        setDob(r.profile.dobISO || '');
        setGender(r.profile.gender || 'unspecified');
        setAge(r.profile.ageYears ?? null);
      }
    });
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const t = localStorage.getItem('ps_token');
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5050/api'}/profile`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify({ dobISO: dob, gender }),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (data.ok) {
      setAge(data.profile?.ageYears ?? null);
      alert('Profile saved.');
    } else {
      alert(data.error || 'Failed to save.');
    }
  };

  return (
    <section className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2>Patient Profile</h2>
      <form onSubmit={save} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Date of Birth
          </div>
          <input
            className="input"
            type="date"
            value={dob || ''}
            onChange={(e) => setDob(e.target.value)}
            required
          />
        </label>
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
        {age != null && <p className="muted">Age: {age}</p>}
        <button className="btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </section>
  );
}
