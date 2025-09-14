import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect } from 'react';

import AlertModal from './AlertModal.jsx';
import '../styles/Header.css';

const PillLogo = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 64 64"
    fill="none"
    style={{ marginRight: 16 }}
  >
    <rect x="14" y="28" width="36" height="16" rx="8" fill="#2bb7b3" />
    <rect
      x="14"
      y="28"
      width="36"
      height="16"
      rx="8"
      fill="url(#grad)"
      fillOpacity="0.5"
    />
    <rect
      x="32"
      y="20"
      width="16"
      height="36"
      rx="8"
      transform="rotate(45 40 38)"
      fill="#6ee7b7"
    />
    <rect
      x="32"
      y="20"
      width="16"
      height="36"
      rx="8"
      transform="rotate(45 40 38)"
      fill="url(#grad2)"
      fillOpacity="0.5"
    />
    <defs>
      <linearGradient
        id="grad"
        x1="14"
        y1="28"
        x2="50"
        y2="44"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#2bb7b3" />
        <stop offset="1" stopColor="#6ee7b7" />
      </linearGradient>
      <linearGradient
        id="grad2"
        x1="32"
        y1="20"
        x2="48"
        y2="56"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#6ee7b7" />
        <stop offset="1" stopColor="#2bb7b3" />
      </linearGradient>
    </defs>
  </svg>
);

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!showLogout) return;
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowLogout(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLogout]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;
  return (
    <header className="header">
      <div className="header-inner">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <PillLogo />
        </div>
        <nav className="nav">
          <NavLink to="/upload" className="nav-link">
            Upload
          </NavLink>
          <NavLink to="/meds" className="nav-link">
            Meds
          </NavLink>
          <NavLink to="/profile" className="nav-link">
            Profile
          </NavLink>
        </nav>
        <div
          ref={dropdownRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              color: '#9bb0c3',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 14px',
              borderRadius: 8,
              background: 'rgba(176, 0, 32, 0.04)',
            }}
            onClick={() => setShowLogout((v) => !v)}
          >
            {user.name || user.email}
          </span>
          {showLogout && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: '#fff',
                color: '#222e3a',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 2px 12px rgba(43,179,179,0.10)',
                minWidth: 90,
                zIndex: 100,
                padding: '4px 0',
                textAlign: 'left',
              }}
            >
              <button
                className="btn btn-muted"
                style={{
                  width: '100%',
                  background: 'none',
                  color: '#222e3a',
                  fontWeight: 500,
                  fontSize: 15,
                  border: 'none',
                  borderRadius: 0,
                  padding: '7px 12px',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
