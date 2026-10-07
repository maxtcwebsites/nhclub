import { Navigate, useLocation } from 'react-router-dom';
import { isSuperAdminUser, useAuth } from '../context/AuthContext.jsx';
import { ErrorAlert, Spinner } from './ui.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

// UI routing only. The real protection is in firestore.rules: even if someone
// forces their way to a page, the database refuses to hand over data.

export function RequireAuth({ children }) {
  const { user, emailVerified, loading, profile, profileError } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  if (user === undefined) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!emailVerified) return <Navigate to="/verify-email" replace />;
  if (profileError) {
    const denied = profileError.code === 'permission-denied' || profileError.code === 'firestore/permission-denied';
    return (
      <div className="auth-wrap">
        <div className="card auth-card form">
          <ErrorAlert error={denied ? t('errors.accountDenied') : profileError} />
          {denied && isSuperAdminUser(user) && <div className="alert alert-info small">{t('errors.accountDeniedAdmin')}</div>}
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            {t('errors.reload')}
          </button>
        </div>
      </div>
    );
  }
  if (loading || !profile) return <Spinner label={t('common.loadingAccount')} />;
  return children;
}

export function RequireStaff({ children }) {
  const { isStaff, role } = useAuth();
  return (
    <RequireAuth>
      {role && !isStaff ? <Navigate to="/family" replace /> : children}
    </RequireAuth>
  );
}

export function RequireAdmin({ children }) {
  const { isAdmin, role } = useAuth();
  return (
    <RequireAuth>
      {role && !isAdmin ? <Navigate to="/dashboard" replace /> : children}
    </RequireAuth>
  );
}

// Signed-in users skip the login / signup pages.
export function PublicOnly({ children }) {
  const { user, emailVerified } = useAuth();
  const location = useLocation();
  if (user === undefined) return <Spinner />;
  if (user && !emailVerified) return <Navigate to="/verify-email" replace />;
  if (user) return <Navigate to={safeInternalPath(location.state?.from)} replace />;
  return children;
}

export function DashboardRedirect() {
  const { isStaff } = useAuth();
  return <Navigate to={isStaff ? '/staff' : '/family'} replace />;
}

// Only ever redirect to a path inside this site.
function safeInternalPath(path) {
  return typeof path === 'string' && /^\/(?![/\\])/.test(path) ? path : '/dashboard';
}
