import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Spinner } from '../../components/ui.jsx';
import Crest from '../../components/Crest.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';

export default function VerifyEmail() {
  const { user, emailVerified, refreshVerification, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);

  // Check quietly every few seconds in case the link was opened elsewhere.
  useEffect(() => {
    if (!user || emailVerified) return undefined;
    const timer = setInterval(() => {
      refreshVerification().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [user, emailVerified, refreshVerification]);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (user === undefined) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (emailVerified) return <Navigate to="/dashboard" replace />;

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Crest className="crest-img" label="" />
        <div className="eyebrow">{t('verify.eyebrow')}</div>
        <h1>{t('verify.title')}</h1>
        <p>
          {t('verify.sentBefore')}
          <strong>{user.email}</strong>
          {t('verify.sentAfter')}
        </p>
        <p className="muted small">{t('verify.spam')}</p>
        {message && (
          <div className="alert alert-success" style={{ marginBottom: 16 }}>
            {message}
          </div>
        )}
        <ErrorAlert error={error} />
        <div className="form" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              setError('');
              try {
                const ok = await refreshVerification();
                if (ok) navigate('/dashboard', { replace: true });
                else setError(t('verify.notYet'));
              } catch (err) {
                setError(friendlyError(err));
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? t('verify.checking') : t('verify.done')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={cooldown > 0}
            onClick={async () => {
              setError('');
              try {
                await sendEmailVerification(auth.currentUser);
                setMessage(t('verify.resent'));
                setCooldown(60);
              } catch (err) {
                setError(friendlyError(err));
              }
            }}
          >
            {cooldown > 0 ? t('verify.resendIn', { s: cooldown }) : t('verify.resend')}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => logout()}>
            {t('verify.other')}
          </button>
        </div>
      </div>
    </div>
  );
}
