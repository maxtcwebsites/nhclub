import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Field } from '../../components/ui.jsx';
import Crest from '../../components/Crest.jsx';
import GoogleButton from './GoogleButton.jsx';

export default function Login() {
  const { signOutReason, clearSignOutReason } = useAuth();
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
        <div className="eyebrow">Welcome back</div>
        <h1>Sign in</h1>
        <p className="muted">Parents, teachers and directors all sign in here.</p>
        {signOutReason && <div className="alert alert-info" style={{ marginBottom: '1rem' }}>{signOutReason}</div>}
        <form className="form" onSubmit={submit} noValidate>
          <ErrorAlert error={error} />
          <Field label="Email">
            {(id) => (
              <input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <Field label="Password">
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
            <Link to="/forgot-password">Forgot your password?</Link>
          </div>
          <button className="btn btn-primary btn-block btn-lg" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="divider">or</div>
          <GoogleButton onError={setError} />
        </form>
        <p className="small muted" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
          New to the club? <Link to="/signup">Create a parent account</Link>
        </p>
      </div>
    </div>
  );
}
