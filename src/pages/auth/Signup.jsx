import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { auth, db } from '../../firebase.js';
import { ensureUserProfile, signupInProgress, updateOwnProfile } from '../../lib/api.js';
import { friendlyError, passwordProblems } from '../../lib/errors.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import Crest from '../../components/Crest.jsx';
import GoogleButton from './GoogleButton.jsx';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', consent: false });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const problems = passwordProblems(form.password);
  const errors = {
    name: form.name.trim().length < 2 ? 'Please enter your full name.' : '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : 'Please enter a valid email address.',
    password: problems.length ? `Password needs ${problems.join(', ')}.` : '',
    confirm: form.confirm !== form.password ? 'Passwords do not match.' : '',
    consent: form.consent ? '' : 'Please confirm to continue.',
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
        <div className="eyebrow">New account</div>
        <h1>Create a parent account</h1>
        <p className="muted">Register once, then add each of your children.</p>
        <form className="form" onSubmit={submit} noValidate>
          <ErrorAlert error={error} />
          <Field label="Your full name" required error={show('name')}>
            {(id) => <input id={id} type="text" autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} />}
          </Field>
          <Field label="Email" required error={show('email')} hint="We’ll send a link to confirm it.">
            {(id) => <input id={id} type="email" autoComplete="email" maxLength={254} value={form.email} onChange={set('email')} />}
          </Field>
          <Field label="Phone number" hint="So the club can reach you about your child.">
            {(id) => <input id={id} type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={set('phone')} />}
          </Field>
          <Field label="Password" required error={show('password')} hint="At least 8 characters, with letters and numbers.">
            {(id) => (
              <input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} aria-invalid={Boolean(show('password'))} />
            )}
          </Field>
          <Field label="Confirm password" required error={show('confirm')}>
            {(id) => <input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />}
          </Field>
          <label className="check small">
            <input type="checkbox" checked={form.consent} onChange={set('consent')} />
            <span>
              I am the parent or legal guardian of the children I register, and I agree that the club stores their details to run
              the club.
            </span>
          </label>
          {show('consent') && <span className="error-text small">{show('consent')}</span>}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
          <div className="divider">or</div>
          <GoogleButton label="Sign up with Google" onError={setError} />
        </form>
        <p className="small muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
