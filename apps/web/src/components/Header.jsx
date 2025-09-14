import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

import AlertModal from './AlertModal.jsx';
import '../styles/Header.css';

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
        <Link to="/" className="brand">
          PillSenseAI
        </Link>
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
