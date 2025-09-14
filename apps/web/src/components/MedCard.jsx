import React from 'react';
import Spinner from './Spinner.jsx';

export default function MedCard({
  m,
  id,
  on,
  busy,
  time,
  notes,
  statusMsg,
  messages,
  enableReminder,
  disableReminder,
  setModal,
  setTimeById,
  headersJSON,
  API_URL,
  pushToast,
  load,
  busyId,
  setBusyId,
  setEnableMedAlert,
}) {
  return (
    <div
      key={id}
      className={`pill meds-pill${m.endsAt ? ' meds-pill-ended' : ''}`}
    >
      <div className="meds-pill-header">
        <div>
          <strong>{m.drug}</strong>
          <span style={{ color: '#222e3a', fontWeight: 500, marginLeft: 6 }}>
            {m.doseMg} mg, {m.frequencyPerDay}×/day
          </span>
          <div className="muted" style={{ fontSize: 12 }}>
            Started:{' '}
            {m.startedAt ? new Date(m.startedAt).toLocaleDateString() : '—'}
            &nbsp;•&nbsp; Status: {m.endsAt ? 'Ended' : 'Active'}
          </div>
          {notes && (
            <div className="muted" style={{ fontSize: 12, margin: '6px 0' }}>
              <span style={{ color: '#2563eb' }}>Note:</span>{' '}
              {notes || 'No description available.'}
            </div>
          )}
          {m.timing && (
            <div className="muted" style={{ fontSize: 12 }}>
              Timing: {m.timing}
            </div>
          )}
          {statusMsg && (
            <div className="muted" style={{ fontSize: 12 }}>
              {statusMsg}
            </div>
          )}
          {messages.length > 0 && (
            <div className="meds-ai-messages">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`meds-ai-msg meds-ai-msg-${
                    msg.severity || 'info'
                  }`}
                >
                  <span style={{ marginRight: 6 }}>
                    <strong>{msg.type === 'timing' ? 'Info:' : 'Note:'}</strong>
                  </span>
                  {msg.message}
                </div>
              ))}
            </div>
          )}
        </div>
        {!m.endsAt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <label
              className="muted"
              style={{ fontSize: 12, marginBottom: 0, lineHeight: 1.1 }}
            >
              Reminder time
            </label>
            <div className="meds-reminder-controls">
              <input
                type="time"
                className="input"
                style={{
                  width: 140,
                  color: 'var(--text)',
                  fontWeight: 500,
                  textShadow: 'none',
                  WebkitTextFillColor: 'var(--text)',
                  MozTextFillColor: 'var(--text)',
                }}
                value={time || '08:00'}
                onChange={(e) =>
                  setTimeById((prev) => ({
                    ...prev,
                    [id]: e.target.value,
                  }))
                }
                disabled={on || busy}
              />
              {!on ? (
                <button
                  className="btn"
                  style={{
                    background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(43,179,179,0.12)',
                  }}
                  onClick={() => enableReminder(m)}
                  disabled={busy}
                >
                  {busy ? 'Enabling…' : 'Enable reminders'}
                </button>
              ) : (
                <button
                  className="btn"
                  style={{
                    background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(43,179,179,0.12)',
                  }}
                  onClick={() =>
                    setModal({ open: true, type: 'reminder', med: m })
                  }
                  disabled={busy}
                >
                  {busy ? 'Disabling…' : 'Disable'}
                </button>
              )}
              <button
                className="btn"
                style={{ background: '#ffe29a', color: '#222' }}
                onClick={() =>
                  setModal({ open: true, type: 'medication', med: m })
                }
                disabled={busy}
              >
                {busy ? 'Disabling…' : 'Disable medication'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              fontSize: 12,
              marginTop: 8,
              color: '#222e3a',
              background: '#fff',
              borderRadius: 12,
              boxShadow: '0 2px 16px #0002',
              padding: 24,
              minWidth: 320,
              textAlign: 'left',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>This medication is ended.</span>
            </div>
            <span
              style={{ color: '#f59e42', display: 'block', marginBottom: 8 }}
            >
              You can reactivate this medication if you need to resume it.
            </span>
            <button
              className="btn"
              style={{ background: '#38bdf8', color: '#222', marginTop: 8 }}
              onClick={async () => {
                setBusyId(id);
                try {
                  const res = await fetch(
                    `${API_URL}/prescriptions/${id}/reactivate`,
                    {
                      method: 'PATCH',
                      headers: headersJSON,
                      body: JSON.stringify({ reason: 'reactivated_by_user' }),
                    }
                  );
                  const data = await res.json();
                  if (res.ok && data.ok) {
                    load();
                    if (setEnableMedAlert) {
                      setEnableMedAlert({
                        open: true,
                        text: 'Medication reactivated successfully.',
                      });
                    }
                  } else {
                    alert(data.error || 'Failed to reactivate medication.');
                  }
                } catch (e) {
                  alert('Network error while reactivating medication.');
                } finally {
                  setBusyId(null);
                }
              }}
              disabled={busy}
            >
              {busy ? 'Reactivating…' : 'Reactivate medication'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
