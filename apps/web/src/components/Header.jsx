import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout, token } = useAuth();
  const nav = useNavigate();

  const onLogout = () => {
    logout();
    nav('/login');
  };

  return (
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
  );
}
