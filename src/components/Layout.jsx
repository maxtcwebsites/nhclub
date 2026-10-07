import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useIntro } from '../intro/IntroContext.jsx';
import { CLUB_NAME, LOCATION_NAME } from '../config.js';
import Crest from './Crest.jsx';

export default function Layout({ children }) {
  const { user, emailVerified, isStaff, isAdmin, logout, profile } = useAuth();
  const { replay } = useIntro();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    document.title = CLUB_NAME;
  }, []);

  const signedIn = Boolean(user && emailVerified && profile);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to={signedIn ? '/dashboard' : '/'} className="brand" aria-label={`${CLUB_NAME} home`}>
            <Crest className="brand-crest" label="" />
            <span className="brand-name">{CLUB_NAME}</span>
            <span className="brand-tag">{LOCATION_NAME}</span>
          </Link>
          <button
            type="button"
            className={`menu-toggle ${open ? 'open' : ''}`}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
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
                  className="navlink"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : user ? (
              <button type="button" className="navlink" onClick={() => logout()}>
                Sign out
              </button>
            ) : (
              <>
                <NavLink to="/login">Sign in</NavLink>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="content" key={location.pathname} className="page">
        {children}
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">
            <strong>{CLUB_NAME}</strong> / {LOCATION_NAME} / {new Date().getFullYear()}
          </span>
          <span>Your family’s information is only visible to you and club staff.</span>
          <button type="button" onClick={replay}>
            Replay intro
          </button>
        </div>
      </footer>
    </>
  );
}
