// apps/web/src/pages/Meds.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { API_URL } from '../lib/api';

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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');

  const [timeById, setTimeById] = useState({}); // { [medId]: "HH:MM" }
  const [busyId, setBusyId] = useState(null);
  const [remOn, setRemOn] = useState({}); // { [medId]: boolean }
  const [reminderIdByMed, setReminderIdByMed] = useState({}); // { [medId]: reminderId }
  const [toasts, setToasts] = useState([]);

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
      // 1) Active prescriptions
      const rMeds = await jsonFetch(`${API_URL}/prescriptions/active`, {
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

      // default times
      const seedTimes = {};
      meds.forEach((m) => {
        seedTimes[m._id] = '08:00';
      });

      // 2) Existing reminders (optional match)
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
            // newest by nextAtISO
            const best = matches.reduce((a, b) => {
              const ta = new Date(a.nextAtISO || 0).getTime();
              const tb = new Date(b.nextAtISO || 0).getTime();
              return tb > ta ? b : a;
            });
            onMap[m._id] = true;
            idMap[m._id] = best._id;

            // Prefer locally saved HH:MM; else use server ISO
            const saved = localStorage.getItem(keyForMed(m));
            timeMap[m._id] =
              saved ||
              (best.nextAtISO ? isoToLocalHhmm(best.nextAtISO) : '08:00');
          } else {
            // no reminder yet: prefer saved time if any
            const saved = localStorage.getItem(keyForMed(m));
            if (saved) timeMap[m._id] = saved;
          }
        });
      } else {
        // if /reminders failed, prefer saved times
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
  }, [authHeader]);

  useEffect(() => {
    load();
  }, [load]);

  // toast util
  function pushToast(text) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      5000
    );
  }

  // Poll due reminders every 30s (STRICT MODE SAFE + DEDUPED)
  useEffect(() => {
    if (pollInitRef.current) return; // prevent double init in StrictMode
    pollInitRef.current = true;

    let timer = null;
    const poll = async () => {
      try {
        const r = await jsonFetch(`${API_URL}/reminders/due?window=1`, {
          headers: authHeader,
        });
        if (r.ok && r.data?.ok) {
          const due = r.data.data || [];
          for (const d of due) {
            const key = toastKey(d);
            if (shownRef.current.has(key)) continue; // already shown in this session
            shownRef.current.add(key);
            saveShownSet(shownRef.current);

            const t = new Date(d.nextAtISO);
            const hhmm = isNaN(t)
              ? ''
              : ` at ${t.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`;
            pushToast(`⏰ Time to take ${d.drug} (${d.doseMg} mg)${hhmm}`);
          }
        }
      } catch {
        // ignore polling errors
      } finally {
        timer = setTimeout(poll, 30000);
      }
    };
    poll();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [authHeader]);

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
      pushToast(`✅ Reminders enabled for ${m.drug} (${m.doseMg} mg)`);
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
      // Optionally clear the saved time:
      // localStorage.removeItem(keyForMed(m));
      pushToast(`🛑 Reminders disabled for ${m.drug}`);
    } catch (e) {
      console.error(e);
      alert('Network error while disabling reminder.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card">
      <h2>My Meds</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        Active prescriptions saved from your scans. Turn on reminders per
        medicine.
      </p>

      {toasts.length > 0 && (
        <div
          style={{
            position: 'sticky',
            top: 8,
            zIndex: 10,
            display: 'grid',
            gap: 8,
            marginBottom: 8,
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="pill"
              style={{ background: '#0f172a', border: '1px solid #334155' }}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}

      {loadErr && (
        <p className="muted" style={{ marginTop: 8, color: '#f87171' }}>
          {loadErr}
        </p>
      )}

      {loading ? (
        <p className="muted" style={{ marginTop: 12 }}>
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p style={{ marginTop: 12 }}>No active prescriptions yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {items.map((m) => {
            const id = m._id;
            const on = !!remOn[id];
            const busy = busyId === id;

            return (
              <div
                key={id}
                className="pill"
                style={{ display: 'grid', gap: 10 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <strong>{m.drug}</strong> — {m.doseMg} mg,{' '}
                    {m.frequencyPerDay}×/day
                    <div className="muted" style={{ fontSize: 12 }}>
                      Started: {fmtDate(m.startedAt)} &nbsp;•&nbsp; Status:{' '}
                      {m.endsAt ? 'Ended' : 'Active'}
                    </div>
                    {m.flags && Object.keys(m.flags).length > 0 && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Flags: {Object.keys(m.flags).join(', ')}
                      </div>
                    )}
                  </div>

                  {!m.endsAt && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <label className="muted" style={{ fontSize: 12 }}>
                        Reminder time
                      </label>
                      <input
                        type="time"
                        className="input"
                        style={{ width: 140, padding: '6px 10px' }}
                        value={timeById[id] || '08:00'}
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
                          onClick={() => enableReminder(m)}
                          disabled={busy}
                        >
                          {busy ? 'Enabling…' : 'Enable reminders'}
                        </button>
                      ) : (
                        <button
                          className="btn"
                          style={{ background: '#374151' }}
                          onClick={() => disableReminder(m)}
                          disabled={busy}
                        >
                          {busy ? 'Disabling…' : 'Disable'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
