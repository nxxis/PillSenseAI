import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#9bb0c3', fontWeight: 600 }}>
              {user.name || user.email}
            </span>
            <button
              className="btn btn-muted"
              onClick={handleLogout}
              style={{ padding: '6px 14px', fontSize: 14 }}
            >
              Logout
            </button>
          </div>
        ) : (
          <nav className="nav">
            <NavLink to="/login" className="nav-link">
              Login
            </NavLink>
            <NavLink to="/register" className="nav-link">
              Register
            </NavLink>
          </nav>
        )}
      </div>
    </header>
  );
}
