// apps/web/src/pages/Result.jsx
import { useLocation, Link } from 'react-router-dom';
import { useMemo } from 'react';

export default function Result() {
  const { state } = useLocation() || {};
  const parsedInput = state?.parsed;
  const imageUrl = state?.imageUrl;

  // normalize to array
  const meds = useMemo(() => {
    if (!parsedInput) return [];
    return Array.isArray(parsedInput) ? parsedInput : [parsedInput];
  }, [parsedInput]);

  const setReminderDemo = () => {
    alert('(Demo) Reminders are controlled per medicine on the My Meds page.');
  };

  if (!parsedInput || meds.length === 0) {
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

  return (
    <section className="card">
      <h2>Parsed Medications</h2>

      <div className="result-layout">
        {imageUrl && (
          <div className="result-image">
            <img src={imageUrl} alt="Uploaded label" />
          </div>
        )}

        <div className="result-info" style={{ display: 'grid', gap: 12 }}>
          {meds.map((p, i) => (
            <div key={i} className="pill">
              <div>
                <strong>Drug:</strong> {p.drug || '—'}
              </div>
              <div>
                <strong>Dose:</strong> {Number(p.doseMg) || 0} mg
              </div>
              <div>
                <strong>Frequency:</strong> {Number(p.frequencyPerDay) || 1}
                ×/day
              </div>
            </div>
          ))}

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
            <button className="btn" onClick={setReminderDemo}>
              Set reminder
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
