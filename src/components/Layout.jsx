import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { CLUB_NAME, LOCATION_NAME } from '../config.js';
import Crest from './Crest.jsx';

export function LanguageToggle({ className = '' }) {
  const { lang, setLang, languages, t } = useI18n();
  return (
    <div className={`lang-toggle ${className}`} role="group" aria-label={t('nav.language')}>
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          className={lang === l.code ? 'on' : ''}
          aria-pressed={lang === l.code}
          title={l.name}
          onClick={() => setLang(l.code)}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}

export default function Layout({ children }) {
  const { user, emailVerified, isStaff, isAdmin, logout, profile } = useAuth();
  const { t } = useI18n();
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
          <Link to={signedIn ? '/dashboard' : '/'} className="brand" aria-label={t('brand.home', { name: CLUB_NAME })}>
            <Crest className="brand-crest" label="" />
            <span className="brand-name">{CLUB_NAME}</span>
            <span className="brand-tag">{LOCATION_NAME}</span>
          </Link>
          <nav id="main-nav" className={`nav ${open ? 'open' : ''}`} aria-label={t('common.main')}>
            {signedIn ? (
              <>
                {isStaff && (
                  <>
                    <NavLink to="/staff" end>
                      {t('nav.dashboard')}
                    </NavLink>
                    <NavLink to="/staff/attendance">{t('nav.attendance')}</NavLink>
                    <NavLink to="/staff/activity">{t('nav.activity')}</NavLink>
                  </>
                )}
                {isAdmin && (
                  <>
                    <NavLink to="/admin/users">{t('nav.users')}</NavLink>
                    <NavLink to="/admin/settings">{t('nav.club')}</NavLink>
                  </>
                )}
                <NavLink to="/family">{t('nav.family')}</NavLink>
                <NavLink to="/settings">{t('nav.settings')}</NavLink>
                <button
                  type="button"
                  className="navlink"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  {t('nav.signOut')}
                </button>
              </>
            ) : user ? (
              <button type="button" className="navlink" onClick={() => logout()}>
                {t('nav.signOut')}
              </button>
            ) : (
              <>
                <NavLink to="/login">{t('nav.signIn')}</NavLink>
                <Link to="/signup" className="btn btn-primary btn-sm">
                  {t('nav.createAccount')}
                </Link>
              </>
            )}
          </nav>
          <LanguageToggle className="header-lang" />
          <button
            type="button"
            className={`menu-toggle ${open ? 'open' : ''}`}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={t('common.menu')}
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
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
          <span>{t('footer.private')}</span>
        </div>
      </footer>
    </>
  );
}
