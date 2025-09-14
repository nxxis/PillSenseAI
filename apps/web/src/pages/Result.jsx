// apps/web/src/pages/Result.jsx
import { useLocation, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import AlertModal from '../components/AlertModal.jsx';

export default function Result() {
  const { state } = useLocation() || {};
  const parsedInput = state?.parsed;
  const imageUrl = state?.imageUrl;
  // Support messages from backend (e.g., duplicate prescription info)
  const messages = parsedInput?.messages || state?.messages || [];

  // Support new backend format: parsedInput.meds (array)
  const meds = useMemo(() => {
    if (!parsedInput) return [];
    if (Array.isArray(parsedInput.meds)) return parsedInput.meds;
    if (Array.isArray(parsedInput)) return parsedInput;
    if (parsedInput.drug) return [parsedInput];
    return [];
  }, [parsedInput]);

  const [addingIdx, setAddingIdx] = useState(null);
  const [addMsg, setAddMsg] = useState('');
  const [alertModal, setAlertModal] = useState({
    open: false,
    title: '',
    message: '',
    addedIdx: null,
  });
  const [addedMedIdxs, setAddedMedIdxs] = useState([]);

  const setReminderDemo = () => {
    setAlertModal({
      open: true,
      title: 'Demo',
      message: 'Reminders are controlled per medicine on the My Meds page.',
    });
  };

  if (!parsedInput) {
    return (
      <section className="card">
        <h2>No result yet</h2>
        <p>Please upload a label first.</p>
        <Link to="/upload" className="btn">
          Go to Upload
        </Link>
      </section>
    );
  }

  if (meds.length === 0) {
    return (
      <section className="card">
        <h2
          style={{
            color: '#222e3a',
            fontWeight: 700,
            textShadow: '0 1px 8px #fff',
          }}
        >
          No medications found
        </h2>
        <p
          style={{
            color: '#222e3a',
            fontWeight: 500,
            textShadow: '0 1px 8px #fff',
          }}
        >
          Sorry, we couldn't recognize any medication from your image. Please
          try a clearer photo or check the label for legibility.
        </p>
        <div
          style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}
        >
          <Link
            to="/upload"
            className="btn"
            style={{
              width: 'auto',
              minWidth: 120,
              padding: '12px 32px',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 16,
              boxShadow: '0 2px 8px rgba(43,179,179,0.08)',
              background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
              color: '#fff',
              textAlign: 'center',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Try Again
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="card">
      <section className="card">
        <h2>Parsed Medications</h2>

        <div className="result-layout">
          {imageUrl && (
            <div className="result-image">
              <img src={imageUrl} alt="Uploaded label" />
            </div>
          )}

          <div className="result-info" style={{ display: 'grid', gap: 12 }}>
            {meds.length === 1 && (!meds[0].drug || meds[0].drug === '—') ? (
              <div
                className="pill"
                style={{
                  background: '#fffbe6',
                  color: '#b45309',
                  fontWeight: 'bold',
                  padding: '14px',
                  borderRadius: 8,
                  border: '1px solid #fde68a',
                  marginBottom: 8,
                }}
              >
                Sorry, we couldn't recognize any medication from your image.
                Please try a clearer photo or check the label for legibility.
              </div>
            ) : (
              meds.map((p, i) => (
                <div key={i} className="pill" style={{ position: 'relative' }}>
                  <div>
                    <strong>Drug:</strong> {p.drug || '—'}
                  </div>
                  <div>
                    <strong>Dose:</strong> {Number(p.doseMg) || 0} mg
                  </div>
                  <div>
                    <strong>Frequency:</strong> {Number(p.frequencyPerDay) || 1}{' '}
                    ×/day
                    {p.timing && (
                      <div>
                        <strong>Timing:</strong> {p.timing}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn"
                    style={{ marginTop: 8, minWidth: 120 }}
                    disabled={addingIdx === i || addedMedIdxs.includes(i)}
                    onClick={async () => {
                      setAddingIdx(i);
                      setAddMsg('');
                      try {
                        const token = localStorage.getItem('ps_token') || '';
                        const res = await fetch(
                          `${import.meta.env.VITE_API_URL || ''}/prescriptions`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token
                                ? { Authorization: `Bearer ${token}` }
                                : {}),
                              timing: p.timing || null,
                            },
                            body: JSON.stringify({
                              drug: p.drug,
                              doseMg: p.doseMg,
                              frequencyPerDay: p.frequencyPerDay || 1,
                            }),
                          }
                        );
                        const data = await res.json();
                        if (res.ok && data.ok) {
                          if (data.duplicate) {
                            setAlertModal({
                              open: true,
                              title: 'Already Added',
                              message: `ℹ️ ${p.drug} is already in your meds.`,
                              addedIdx: i,
                            });
                          } else {
                            setAlertModal({
                              open: true,
                              title: 'Medication Added',
                              message: `✅ Added ${p.drug} to your meds.`,
                              addedIdx: i,
                            });
                          }
                        } else {
                          setAlertModal({
                            open: true,
                            title: 'Error',
                            message: data.error || 'Failed to add medication.',
                            addedIdx: null,
                          });
                        }
                      } catch (e) {
                        setAlertModal({
                          open: true,
                          title: 'Network Error',
                          message:
                            'Could not add medication due to a network error.',
                          addedIdx: null,
                        });
                      } finally {
                        setAddingIdx(null);
                      }
                    }}
                  >
                    {addingIdx === i
                      ? 'Adding…'
                      : addedMedIdxs.includes(i)
                      ? 'Added'
                      : 'Add to My Meds'}
                  </button>
                </div>
              ))
            )}

            {/* Show backend info/warning messages */}
            {/* AlertModal for add to meds feedback */}
            <AlertModal
              open={alertModal.open}
              title={alertModal.title}
              message={alertModal.message}
              confirmText="OK"
              cancelText=""
              onConfirm={() => {
                setAlertModal({
                  open: false,
                  title: '',
                  message: '',
                  addedIdx: null,
                });
                if (
                  alertModal.addedIdx !== null &&
                  !addedMedIdxs.includes(alertModal.addedIdx)
                ) {
                  setAddedMedIdxs((prev) => [...prev, alertModal.addedIdx]);
                }
              }}
              onCancel={() => {
                setAlertModal({
                  open: false,
                  title: '',
                  message: '',
                  addedIdx: null,
                });
              }}
            />
            {Array.isArray(messages) && messages.length > 0 && (
              <div className="ai-messages" style={{ marginBottom: 12 }}>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`ai-msg ai-msg-${msg.severity || 'info'}`}
                    style={{
                      background:
                        msg.severity === 'warning' ? '#ffeaea' : '#e6f7ff',
                      color: msg.severity === 'warning' ? '#b00' : '#0055a5',
                      fontWeight: 'bold',
                      fontSize: '1.1em',
                      border:
                        '1px solid ' +
                        (msg.severity === 'warning' ? '#b00' : '#0055a5'),
                      borderRadius: 6,
                      padding: '8px 12px',
                      marginBottom: 8,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}
                  >
                    <span style={{ marginRight: 6 }}>
                      <strong>
                        {msg.type === 'timing' ? 'Info:' : 'Note:'}
                      </strong>
                    </span>
                    {msg.message}
                  </div>
                ))}
              </div>
            )}

            <div className="ai-note">
              <p>
                <strong>Heads up:</strong> Interaction/overdose checks &
                plain-language explanations show up after saving meds. Manage
                reminders per medicine on the <em>My Meds</em> page.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to="/meds" className="btn">
                Go to My Meds
              </Link>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
