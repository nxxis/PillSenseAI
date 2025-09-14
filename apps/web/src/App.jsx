import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Upload from './pages/Upload.jsx';
import Result from './pages/Result.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import Meds from './pages/Meds.jsx'; // <-- add
import PrivateRoute from './components/PrivateRoute.jsx';

export default function App() {
  // Global reminder alert state
  const [reminderAlert, setReminderAlert] = React.useState({
    open: false,
    text: '',
  });
  const audioRef = React.useRef(null);

  function playReminderSound(loop = false) {
    try {
      if (audioRef.current) {
        audioRef.current.loop = loop;
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } catch {}
  }
  function stopReminderSound() {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.loop = false;
      }
    } catch {}
  }

  React.useEffect(() => {
    const ws = new window.WebSocket('ws://localhost:5051');
    ws.onmessage = (event) => {
      console.log('[WS] Message received:', event.data);
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'reminder' && msg.reminder) {
          const r = msg.reminder;
          const t = new Date(r.nextAtISO);
          const hhmm = isNaN(t)
            ? ''
            : ` at ${t.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}`;
          setReminderAlert({
            open: true,
            text: `⏰ Time to take ${r.drug} (${r.doseMg} mg)${hhmm}`,
          });
          playReminderSound(true);
        }
      } catch (err) {
        console.error('[WS] Error parsing message:', err);
      }
    };
    ws.onopen = () => {
      console.log('[WS] Connected for reminders');
    };
    ws.onclose = () => {
      console.log('[WS] Disconnected from reminders');
    };
    ws.onerror = (err) => {
      console.error('[WS] Connection error:', err);
    };
    return () => {
      ws.close();
    };
  }, []);

  return (
    <div className="app">
      <Header />
      <main className="container">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route element={<PrivateRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/result" element={<Result />} />
            <Route path="/meds" element={<Meds />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {/* Global reminder alert modal */}
        {reminderAlert.open && (
          <div
            className="reminder-alert-modal"
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
              }}
            >
              <h2 style={{ color: '#222' }}>Reminder</h2>
              <p style={{ color: '#222' }}>{reminderAlert.text}</p>
              <button
                className="btn"
                onClick={() => {
                  setReminderAlert({ open: false, text: '' });
                  stopReminderSound();
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {/* Always mounted audio element for reminders */}
        <audio ref={audioRef} src="/reminder.mp3" preload="auto" />
      </main>
      <Footer />
    </div>
  );
}
