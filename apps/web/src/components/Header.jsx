import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import AlertModal from './AlertModal.jsx';

export default function Header() {
  const { user, logout, token } = useAuth();
  const nav = useNavigate();

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const onLogout = () => {
    setShowLogoutModal(true);
  };

  return (
    <>
      <div>
        <header className="header">
          <div className="container header-inner">
            <Link to="/" className="brand">
              PillSenseAI
            </Link>
            <nav
              className="nav"
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <NavLink to="/" className="nav-link">
                Home
              </NavLink>
              {token ? (
                <>
                  <NavLink to="/upload" className="nav-link">
                    Upload
                  </NavLink>
                  <NavLink to="/meds" className="nav-link">
                    My Meds
                  </NavLink>{' '}
                  <NavLink to="/profile" className="nav-link">
                    Profile
                  </NavLink>
                  <button
                    className="btn"
                    onClick={onLogout}
                    style={{ padding: '6px 10px' }}
                  >
                    Logout
                  </button>
                  {user?.name && (
                    <span className="muted" style={{ marginLeft: 6 }}>
                      Hi, {user.name}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <NavLink to="/login" className="nav-link">
                    Login
                  </NavLink>
                  <NavLink to="/register" className="nav-link">
                    Register
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        </header>
        <AlertModal
          open={showLogoutModal}
          title="Confirm Logout"
          message="Are you sure you want to log out?"
          confirmText="Logout"
          cancelText="Cancel"
          onConfirm={() => {
            logout();
            nav('/login');
            setShowLogoutModal(false);
          }}
          onCancel={() => setShowLogoutModal(false)}
        />
      </div>
      <AlertModal
        open={showLogoutModal}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={() => {
          logout();
          nav('/login');
          setShowLogoutModal(false);
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </>
  );
}
