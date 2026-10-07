import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';

export default function ForgotPassword() {
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
        <h1>Reset your password</h1>
        {sent ? (
          <>
            <div className="alert alert-success">
              If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox (and spam folder).
            </div>
            <p style={{ marginTop: '1rem' }}>
              <Link to="/login">Back to sign in</Link>
            </p>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="muted" style={{ margin: 0 }}>
              Enter the email you signed up with and we’ll send you a link to choose a new password.
            </p>
            <ErrorAlert error={error} />
            <Field label="Email">
              {(id) => <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <button className="btn btn-primary btn-block" disabled={busy || !email}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <Link to="/login" className="small">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
