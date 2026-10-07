import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Spinner } from '../../components/ui.jsx';
import Crest from '../../components/Crest.jsx';

export default function VerifyEmail() {
  const { user, emailVerified, refreshVerification, logout } = useAuth();
  const navigate = useNavigate();
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
        <div className="eyebrow">Confirm your email</div>
        <h1>Check your inbox</h1>
        <p>
          We sent a confirmation link to <strong>{user.email}</strong>. Open it to activate your account, then come back here.
        </p>
        <p className="muted small">Can’t find it? Look in your spam or promotions folder.</p>
        {message && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{message}</div>}
        <ErrorAlert error={error} />
        <div className="form" style={{ marginTop: '1rem' }}>
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
                else setError('Your email is not confirmed yet. Click the link in the email first.');
              } catch (err) {
                setError(friendlyError(err));
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? 'Checking…' : 'I’ve confirmed my email'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={cooldown > 0}
            onClick={async () => {
              setError('');
              try {
                await sendEmailVerification(auth.currentUser);
                setMessage('A new link is on its way.');
                setCooldown(60);
              } catch (err) {
                setError(friendlyError(err));
              }
            }}
          >
            {cooldown > 0 ? `Resend link (${cooldown}s)` : 'Resend the link'}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => logout()}>
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
}
