import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { friendlyError } from '../../lib/errors.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import Crest from '../../components/Crest.jsx';

export default function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (err) {
      // Do not reveal whether an account exists for this email.
      if (err.code === 'auth/user-not-found') setSent(true);
      else setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Crest className="crest-img" label="" />
        <h1>{t('forgot.title')}</h1>
        {sent ? (
          <>
            <div className="alert alert-success">
              {t('forgot.sentBefore')}
              <strong>{email}</strong>
              {t('forgot.sentAfter')}
            </div>
            <p style={{ marginTop: 16 }}>
              <Link to="/login">{t('forgot.back')}</Link>
            </p>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="muted" style={{ margin: 0 }}>
              {t('forgot.intro')}
            </p>
            <ErrorAlert error={error} />
            <Field label={t('auth.email')}>
              {(id) => <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <button className="btn btn-primary btn-block" disabled={busy || !email}>
              {busy ? t('forgot.sending') : t('forgot.send')}
            </button>
            <Link to="/login" className="small">
              {t('forgot.back')}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
