import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import Crest from '../../components/Crest.jsx';
import GoogleButton from './GoogleButton.jsx';

export default function Login() {
  const { signOutReason, clearSignOutReason } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    clearSignOutReason();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // PublicOnly redirects once the auth state changes.
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Crest className="crest-img" label="" />
        <div className="eyebrow">{t('login.eyebrow')}</div>
        <h1>{t('login.title')}</h1>
        <p className="muted">{t('login.subtitle')}</p>
        {signOutReason && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            {signOutReason}
          </div>
        )}
        <form className="form" onSubmit={submit} noValidate>
          <ErrorAlert error={error} />
          <Field label={t('auth.email')}>
            {(id) => <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label={t('auth.password')}>
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
          <div className="row-between small">
            <Link to="/forgot-password">{t('login.forgot')}</Link>
          </div>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy || !email || !password}>
            {busy ? t('login.submitting') : t('login.submit')}
          </button>
          <div className="divider">{t('auth.or')}</div>
          <GoogleButton onError={setError} />
        </form>
        <p className="small muted" style={{ marginTop: 20, marginBottom: 0 }}>
          {t('login.newHere')} <Link to="/signup">{t('login.createLink')}</Link>
        </p>
      </div>
    </div>
  );
}
