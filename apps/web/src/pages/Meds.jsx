// apps/web/src/pages/Meds.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import '../styles/Meds.css';
import { API_URL } from '../lib/api';
import Spinner from '../components/Spinner.jsx';
import AlertModal from '../components/AlertModal.jsx';
import MedCard from '../components/MedCard.jsx';

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt)) return '—';
  return dt.toLocaleDateString();
}

// --- time helpers ---
function isoToLocalHhmm(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d)) return '08:00';
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '08:00';
  }
}
function todayHhmmToISO(hhmm) {
  const [hh, mm] = (hhmm || '08:00').split(':').map((n) => parseInt(n, 10));
  const now = new Date();
  const dt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hh || 8,
    mm || 0,
    0,
    0
  );
  return dt.toISOString();
}

// tolerant fetch
async function jsonFetch(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, ok: res.ok, data, text };
}

// stable localStorage key per med (drug+dose+freq)
function keyForMed(m) {
  const drug = (m.drug || '').toLowerCase().replace(/\s+/g, '_');
  return `ps_time_${drug}_${m.doseMg}_${m.frequencyPerDay}`;
}

// dedupe helpers for toasts (persist in sessionStorage so reloads don't repeat)
function loadShownSet() {
  try {
    const arr = JSON.parse(sessionStorage.getItem('ps_toast_seen') || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}
function saveShownSet(set) {
  try {
    sessionStorage.setItem('ps_toast_seen', JSON.stringify(Array.from(set)));
  } catch {}
}
// build a per-minute unique key for a due reminder
function toastKey(rem) {
  const id = rem._id || `${rem.drug}-${rem.doseMg}-${rem.frequencyPerDay}`;
  const when = new Date(rem.nextAtISO);
  const minuteIso = isNaN(when) ? '' : when.toISOString().slice(0, 16); // yyyy-mm-ddThh:mm
  return `${id}:${minuteIso}`;
}

export default function Meds() {
  // Success alert modal for enabling reminders
  const [enableAlert, setEnableAlert] = useState({ open: false, text: '' });
  // Success alert modal for disabling reminders
  const [disableAlert, setDisableAlert] = useState({ open: false, text: '' });
  // Modal state for confirmation dialogs
  const [modal, setModal] = useState({ open: false, type: '', med: null });
  // AI safety info bar state
  const [aiSafetyInfo, setAiSafetyInfo] = useState('');
  const [aiSafetyLoading, setAiSafetyLoading] = useState(false);
  const [aiSafetyError, setAiSafetyError] = useState('');

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const [timeById, setTimeById] = useState({}); // { [medId]: "HH:MM" }
  const [busyId, setBusyId] = useState(null);
  const [remOn, setRemOn] = useState({}); // { [medId]: boolean }
  const [reminderIdByMed, setReminderIdByMed] = useState({}); // { [medId]: reminderId }
  const [toasts, setToasts] = useState([]);
  // Store Gemini notes for each medication by id
  const [notesById, setNotesById] = useState({});

  // refs for StrictMode-safe polling & dedupe
  const pollInitRef = useRef(false);
  const shownRef = useRef(loadShownSet());

  const token = localStorage.getItem('ps_token') || '';
  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );
  const headersJSON = useMemo(
    () => ({ 'Content-Type': 'application/json', ...authHeader }),
    [authHeader]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      // Fetch all prescriptions (active and ended)
      const rMeds = await jsonFetch(`${API_URL}/prescriptions/all`, {
        headers: authHeader,
      });
      if (!(rMeds.data && rMeds.data.ok)) {
        setItems([]);
        setLoadErr(
          rMeds.data?.error ||
            `Failed to load prescriptions (HTTP ${rMeds.status})`
        );
        return;
      }
      const meds = rMeds.data.data || [];
      setItems(meds);

      // Fetch Gemini notes for all meds in parallel
      const notePromises = meds.map((m) =>
        fetch(`${API_URL}/prescriptions/note`, {
          method: 'POST',
          headers: headersJSON,
          body: JSON.stringify({ drug: m.drug }),
        })
          .then((res) => res.json())
          .then((data) => ({
            id: m._id,
            note:
              data.ok && data.note
                ? data.note
                : data.error && data.error.includes('quota')
                ? 'No description available due to API limits.'
                : '',
          }))
          .catch(() => ({
            id: m._id,
            note: 'No description available due to API limits.',
          }))
      );
      const notesArr = await Promise.all(notePromises);
      const notesObj = {};
      notesArr.forEach(({ id, note }) => {
        notesObj[id] = note;
      });
      setNotesById(notesObj);

      // ...existing code for reminders...
      // default times
      const seedTimes = {};
      meds.forEach((m) => {
        seedTimes[m._id] = '08:00';
      });
      const rRem = await jsonFetch(`${API_URL}/reminders`, {
        headers: authHeader,
      });
      let onMap = {};
      let idMap = {};
      let timeMap = { ...seedTimes };
      if (rRem.ok && rRem.data?.ok) {
        const reminders = rRem.data.data || [];
        meds.forEach((m) => {
          const matches = reminders.filter(
            (rr) =>
              typeof rr.drug === 'string' &&
              rr.drug.toLowerCase() === (m.drug || '').toLowerCase() &&
              Number(rr.doseMg) === Number(m.doseMg) &&
              Number(rr.frequencyPerDay) === Number(m.frequencyPerDay)
          );
          if (matches.length > 0) {
            const best = matches.reduce((a, b) => {
              const ta = new Date(a.nextAtISO || 0).getTime();
              const tb = new Date(b.nextAtISO || 0).getTime();
              return tb > ta ? b : a;
            });
            onMap[m._id] = true;
            idMap[m._id] = best._id;
            const saved = localStorage.getItem(keyForMed(m));
            timeMap[m._id] =
              saved ||
              (best.nextAtISO ? isoToLocalHhmm(best.nextAtISO) : '08:00');
          } else {
            const saved = localStorage.getItem(keyForMed(m));
            if (saved) timeMap[m._id] = saved;
          }
        });
      } else {
        meds.forEach((m) => {
          const saved = localStorage.getItem(keyForMed(m));
          if (saved) seedTimes[m._id] = saved;
        });
        timeMap = seedTimes;
      }
      setRemOn(onMap);
      setReminderIdByMed(idMap);
      setTimeById(timeMap);
    } catch (e) {
      console.error('Load meds error:', e);
      setLoadErr('Network error while loading.');
    } finally {
      setLoading(false);
    }
  }, [authHeader, headersJSON]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch Gemini AI safety info for active meds
  useEffect(() => {
    const activeMeds = items
      .filter((m) => !m.endsAt)
      .map((m) => ({ drug: m.drug }));
    if (activeMeds.length === 0) {
      setAiSafetyInfo('');
      setAiSafetyError('');
      setAiSafetyLoading(false);
      return;
    }
    setAiSafetyLoading(true);
    setAiSafetyError('');
    fetch(`${API_URL}/interactions/ai-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ meds: activeMeds }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.explanation) {
          setAiSafetyInfo(data.explanation);
        } else if (data.error === 'quota_exceeded') {
          setAiSafetyError(
            'AI safety info temporarily unavailable (quota exceeded).'
          );
        } else if (data.error === 'model_overloaded') {
          setAiSafetyError(
            'AI safety info temporarily unavailable (model overloaded).'
          );
        } else {
          setAiSafetyError('Could not fetch AI safety info.');
        }
      })
      .catch(() => setAiSafetyError('Could not fetch AI safety info.'))
      .finally(() => setAiSafetyLoading(false));
  }, [items, authHeader]);

  // toast util
  function pushToast(text) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      5000
    );
  }

  const enableReminder = async (m) => {
    const medId = m._id;
    const preferred = (timeById[medId] || '08:00').trim();
    const nextAtISO = todayHhmmToISO(preferred); // exact time user chose

    setBusyId(medId);
    try {
      const r = await jsonFetch(`${API_URL}/reminders`, {
        method: 'POST',
        headers: headersJSON,
        body: JSON.stringify({
          drug: m.drug,
          doseMg: m.doseMg,
          frequencyPerDay: m.frequencyPerDay,
          nextAtISO,
        }),
      });
      if (!(r.data && r.data.ok)) {
        console.error('Enable reminder error:', r.status, r.text);
        alert(
          r.data?.error || `Failed to enable reminders (HTTP ${r.status}).`
        );
        return;
      }
      const newRem = r.data.data;

      // Save chosen HH:MM locally for consistent display on reload
      localStorage.setItem(keyForMed(m), preferred);

      setRemOn((prev) => ({ ...prev, [medId]: true }));
      setReminderIdByMed((prev) => ({ ...prev, [medId]: newRem?._id }));
      // reflect what server stored (if it bumped because time was in the past)
      const uiTime =
        localStorage.getItem(keyForMed(m)) ||
        isoToLocalHhmm(newRem?.nextAtISO || nextAtISO);
      setTimeById((prev) => ({ ...prev, [medId]: uiTime }));
      setEnableAlert({
        open: true,
        text: `Reminder enabled for ${m.drug} (${m.doseMg} mg)`,
      });
    } catch (e) {
      console.error(e);
      alert('Network error while enabling reminder.');
    } finally {
      setBusyId(null);
    }
  };

  const disableReminder = async (m) => {
    const medId = m._id;
    const remId = reminderIdByMed[medId];
    if (!remId) {
      alert("Can't find the reminder to disable (reload the page).");
      return;
    }
    setBusyId(medId);
    try {
      const r = await jsonFetch(`${API_URL}/reminders/${remId}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (!(r.data && r.data.ok)) {
        console.error('Disable reminder error:', r.status, r.text);
        alert(
          r.data?.error || `Failed to disable reminders (HTTP ${r.status}).`
        );
        return;
      }
      setRemOn((prev) => ({ ...prev, [medId]: false }));
      setReminderIdByMed((prev) => {
        const c = { ...prev };
        delete c[medId];
        return c;
      });
      setDisableAlert({
        open: true,
        text: `Reminder disabled for ${m.drug} (${m.doseMg} mg)`,
      });
      // Optionally clear the saved time:
      // localStorage.removeItem(keyForMed(m));
    } catch (e) {
      console.error(e);
      alert('Network error while disabling reminder.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="card meds-section"
      style={{
        padding: '48px 48px',
        minWidth: '900px',
        maxWidth: '1200px',
        margin: '40px auto',
        boxSizing: 'border-box',
      }}
    >
      <div className="meds-list">
        <h2>My Meds</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Active prescriptions saved from your scans. Turn on reminders per
          medicine.
        </p>

        {toasts.length > 0 && (
          <div className="meds-toasts">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="pill meds-pill"
                style={{ background: '#0f172a', border: '1px solid #334155' }}
              >
                {t.text}
              </div>
            ))}
          </div>
        )}
        {/* Success alert modal for enabling reminders */}
        {enableAlert.open && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: 32,
                borderRadius: 12,
                boxShadow: '0 2px 16px #0002',
                minWidth: 320,
                textAlign: 'center',
              }}
            >
              <h2 style={{ color: '#222', marginBottom: 16 }}>Success</h2>
              <p style={{ color: '#222', marginBottom: 24 }}>
                {enableAlert.text}
              </p>
              <button
                className="btn"
                onClick={() => setEnableAlert({ open: false, text: '' })}
              >
                OK
              </button>
            </div>
          </div>
        )}
        {/* Success alert modal for disabling reminders */}
        {disableAlert.open && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: 32,
                borderRadius: 12,
                boxShadow: '0 2px 16px #0002',
                minWidth: 320,
                textAlign: 'center',
              }}
            >
              <h2 style={{ color: '#222', marginBottom: 16 }}>Success</h2>
              <p style={{ color: '#222', marginBottom: 24 }}>
                {disableAlert.text}
              </p>
              <button
                className="btn"
                onClick={() => setDisableAlert({ open: false, text: '' })}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {loadErr && (
          <p className="muted" style={{ marginTop: 8, color: '#f87171' }}>
            <div
              style={{
                borderLeft: '1px solid #e3e8ee',
                margin: '16px 0',
                height: 'auto',
              }}
            />
            {loadErr}
          </p>
        )}

        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 24,
            }}
          >
            <Spinner size={32} />
          </div>
        ) : items.length === 0 ? (
          <p style={{ marginTop: 12, color: 'black' }}>No prescriptions yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {items.map((m) => {
              const id = m._id;
              const on = !!remOn[id];
              const busy = busyId === id;
              const messages = Array.isArray(m.messages) ? m.messages : [];
              let statusMsg = '';
              if (m.flags) {
                if (m.flags.endReason) {
                  statusMsg = 'This medication was ended.';
                  if (m.flags.endReason !== 'ended_by_user') {
                    statusMsg += ` Reason: ${m.flags.endReason}`;
                  }
                }
                if (m.flags.reactivateReason) {
                  statusMsg = 'This medication was reactivated.';
                  if (m.flags.reactivateReason !== 'reactivated_by_user') {
                    statusMsg += ` Reason: ${m.flags.reactivateReason}`;
                  }
                }
              }
              return (
                <MedCard
                  key={id}
                  m={m}
                  id={id}
                  on={on}
                  busy={busy}
                  time={timeById[id]}
                  notes={notesById[id]}
                  statusMsg={statusMsg}
                  messages={messages}
                  enableReminder={enableReminder}
                  disableReminder={disableReminder}
                  setModal={setModal}
                  setTimeById={setTimeById}
                  headersJSON={headersJSON}
                  API_URL={API_URL}
                  pushToast={pushToast}
                  load={load}
                  busyId={busyId}
                  setBusyId={setBusyId}
                />
              );
            })}
          </div>
        )}
      </div>
      {/* AI Safety Info Bar (Gemini) */}
      {/* AlertModal for confirmation */}
      <AlertModal
        open={modal.open}
        title={
          modal.type === 'reminder'
            ? 'Disable Reminder?'
            : 'Disable Medication?'
        }
        message={
          modal.type === 'reminder'
            ? `Are you sure you want to disable reminders for ${modal.med?.drug}?`
            : `Are you sure you want to disable ${modal.med?.drug}? This will end the medication.`
        }
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={async () => {
          if (!modal.med) return;
          setBusyId(modal.med._id);
          setModal({ open: false, type: '', med: null });
          if (modal.type === 'reminder') {
            await disableReminder(modal.med);
          } else if (modal.type === 'medication') {
            try {
              const res = await fetch(
                `${API_URL}/prescriptions/${modal.med._id}/end`,
                {
                  method: 'PATCH',
                  headers: headersJSON,
                  body: JSON.stringify({ reason: 'ended_by_user' }),
                }
              );
              const data = await res.json();
              if (res.ok && data.ok) {
                pushToast(`Medication disabled: ${modal.med.drug}`);
                load();
              } else {
                alert(data.error || 'Failed to disable medication.');
              }
            } catch (e) {
              alert('Network error while disabling medication.');
            } finally {
              setBusyId(null);
            }
          }
        }}
        onCancel={() => setModal({ open: false, type: '', med: null })}
      />
      {/* ...existing code... */}
      <aside style={{ minWidth: 320, maxWidth: 400 }}>
        <h2
          style={{
            marginBottom: 8,
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#222',
          }}
        >
          AI Safety Info
        </h2>
        {aiSafetyLoading ? (
          <div style={{ fontSize: '1rem', marginBottom: 12, color: '#222' }}>
            Loading AI safety info…
          </div>
        ) : aiSafetyError ? (
          <div
            style={{
              fontSize: '1rem',
              marginBottom: 12,
              color: '#b00',
              fontWeight: 500,
            }}
          >
            {aiSafetyError}
          </div>
        ) : aiSafetyInfo ? (
          <div
            className="meds-ai-messages"
            style={{ marginBottom: 12, fontSize: '1rem', color: '#222' }}
          >
            {(() => {
              const riskWords =
                /risk|danger|caution|warning|interaction|unsafe|avoid|not recommended/i;
              const isRisk = riskWords.test(aiSafetyInfo);
              return (
                <div
                  className={`meds-ai-safety${
                    isRisk ? '' : ' meds-ai-safety-safe'
                  }`}
                >
                  <span
                    style={{
                      flex: 1,
                      color: isRisk ? '#ff4d4f' : '#222',
                      fontSize: '1rem',
                      fontWeight: 400,
                    }}
                  >
                    {aiSafetyInfo}
                  </span>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ fontSize: '1rem', marginBottom: 12, color: '#222' }}>
            No AI safety info available for your current active medications.
          </div>
        )}
      </aside>
    </section>
  );
}
