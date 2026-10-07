import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { CLUB_NAME } from '../config.js';
import Logo from './Logo.jsx';

export default function Layout({ children }) {
  const { user, emailVerified, isStaff, isAdmin, logout, profile } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const clubName = settings.clubName || CLUB_NAME;

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    document.title = clubName;
  }, [clubName]);

  const signedIn = Boolean(user && emailVerified && profile);

  return (
    <>
      <div className="topbar" />
      <header className="header">
        <div className="header-inner" style={{ position: 'relative' }}>
          <Link to={signedIn ? '/dashboard' : '/'} className="brand">
            <Logo />
            <span>
              {clubName}
              <small>Parents &amp; staff portal</small>
            </span>
          </Link>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '✕' : '☰'} Menu
          </button>
          <nav id="main-nav" className={`nav ${open ? 'open' : ''}`} aria-label="Main">
            {signedIn ? (
              <>
                {isStaff && (
                  <>
                    <NavLink to="/staff" end>
                      Dashboard
                    </NavLink>
                    <NavLink to="/staff/attendance">Attendance</NavLink>
                    <NavLink to="/staff/activity">Activity</NavLink>
                  </>
                )}
                {isAdmin && (
                  <>
                    <NavLink to="/admin/users">Users</NavLink>
                    <NavLink to="/admin/settings">Settings</NavLink>
                  </>
                )}
                <NavLink to="/family">My family</NavLink>
                <NavLink to="/profile">Profile</NavLink>
                <button
                  type="button"
                  className="link"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : user ? (
              <button type="button" className="link" onClick={() => logout()}>
                Sign out
              </button>
            ) : (
              <>
                <NavLink to="/login">Sign in</NavLink>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Create parent account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="content">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <span>
            © {new Date().getFullYear()} {clubName}
          </span>
          <span>Your family’s information is private and only visible to you and club staff.</span>
        </div>
      </footer>
    </>
  );
}
