import { useEffect, useState } from 'react';
import { getJson } from '../lib/api';
import AlertModal from '../components/AlertModal.jsx';

export default function Profile() {
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('unspecified');
  const [age, setAge] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alertModal, setAlertModal] = useState({
    open: false,
    title: '',
    message: '',
    color: '#222',
  });

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
      setAlertModal({
        open: true,
        title: 'Success',
        message: 'Profile saved.',
        color: '#030303ff',
      });
    } else {
      setAlertModal({
        open: true,
        title: 'Error',
        message: data.error || 'Failed to save.',
        color: '',
      });
    }
  };

  return (
    <section className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      <h2 style={{ color: '#222e3a', fontWeight: 700 }}>Patient Profile</h2>
      <form onSubmit={save} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Date of Birth
          </div>
          <input
            type="date"
            required
            value={dob || ''}
            onChange={(e) => setDob(e.target.value)}
            style={{
              background: '#fff',
              color: '#222e3a',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 16,
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
        </label>
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Gender
          </div>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={{
              background: '#fff',
              color: '#222e3a',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 16,
              width: '100%',
              boxSizing: 'border-box',
            }}
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
      <AlertModal
        open={alertModal.open}
        title={alertModal.title}
        message={alertModal.message}
        color={alertModal.color}
        confirmText="OK"
        cancelText=""
        onConfirm={() => setAlertModal({ ...alertModal, open: false })}
        onCancel={() => setAlertModal({ ...alertModal, open: false })}
      />
    </section>
  );
}
