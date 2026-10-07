import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth, db } from '../../firebase.js';
import { ensureUserProfile, signupInProgress, updateOwnProfile } from '../../lib/api.js';
import { friendlyError, passwordProblems } from '../../lib/errors.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import Crest from '../../components/Crest.jsx';
import GoogleButton from './GoogleButton.jsx';

export default function Signup() {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', consent: false });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const problems = passwordProblems(form.password);
  const errors = {
    name: form.name.trim().length < 2 ? t('signup.nameReq') : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : t('signup.emailInvalid'),
    password: problems.length ? t('signup.passwordNeeds', { list: problems.join(', ') }) : '',
    confirm: form.confirm !== form.password ? t('signup.mismatch') : '',
    consent: form.consent ? '' : t('signup.consentReq'),
  };
  const valid = Object.values(errors).every((v) => !v);

  async function submit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (!valid) return;
    setBusy(true);
    signupInProgress.current = true;
    try {
      const displayName = form.name.trim().slice(0, 80);
      const phone = form.phone.trim().slice(0, 30);
      const { user } = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await updateProfile(user, { displayName });
      await sendEmailVerification(user);
      const created = await ensureUserProfile(db, user, { displayName, phone });
      if (!created) await updateOwnProfile(db, user, { displayName, phone });
      // PublicOnly sends the (unverified) user to /verify-email.
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    } finally {
      signupInProgress.current = false;
    }
  }

  const show = (key) => (touched ? errors[key] : '');

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <Crest className="crest-img" label="" />
        <div className="eyebrow">{t('signup.eyebrow')}</div>
        <h1>{t('signup.title')}</h1>
        <p className="muted">{t('signup.subtitle')}</p>
        <form className="form" onSubmit={submit} noValidate>
          <ErrorAlert error={error} />
          <Field label={t('signup.name')} required error={show('name')}>
            {(id) => <input id={id} type="text" autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} />}
          </Field>
          <Field label={t('auth.email')} required error={show('email')} hint={t('signup.emailHint')}>
            {(id) => <input id={id} type="email" autoComplete="email" maxLength={254} value={form.email} onChange={set('email')} />}
          </Field>
          <Field label={t('signup.phone')} hint={t('signup.phoneHint')}>
            {(id) => <input id={id} type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={set('phone')} />}
          </Field>
          <Field label={t('auth.password')} required error={show('password')} hint={t('signup.passwordHint')}>
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
                aria-invalid={Boolean(show('password'))}
              />
            )}
          </Field>
          <Field label={t('signup.confirm')} required error={show('confirm')}>
            {(id) => <input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />}
          </Field>
          <label className="check small">
            <input type="checkbox" checked={form.consent} onChange={set('consent')} />
            <span>{t('signup.consent')}</span>
          </label>
          {show('consent') && <span className="error-text small">{show('consent')}</span>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? t('signup.submitting') : t('signup.submit')}
          </button>
          <div className="divider">{t('auth.or')}</div>
          <GoogleButton label={t('signup.google')} onError={setError} />
        </form>
        <p className="small muted" style={{ marginTop: 20, marginBottom: 0 }}>
          {t('signup.haveAccount')} <Link to="/login">{t('signup.signInLink')}</Link>
        </p>
      </div>
    </div>
  );
}
