import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { updateOwnProfile } from '../lib/api.js';
import { formatTimestamp } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { ErrorAlert, Field, RoleBadge } from '../components/ui.jsx';

export default function ProfilePage() {
  const { user, profile, role } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const usesPassword = user.providerData.some((p) => p.providerId === 'password');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Please enter your name.');
    setBusy(true);
    try {
      await updateOwnProfile(db, user, { displayName: name, phone });
      toast('Profile saved');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Account</div>
          <h1>Your profile</h1>
        </div>
        <RoleBadge role={role} />
      </div>
      <form className="card form" onSubmit={submit}>
        <ErrorAlert error={error} />
        <Field label="Full name" required>
          {(id) => <input id={id} type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
        </Field>
        <Field label="Phone number">
          {(id) => <input id={id} type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />}
        </Field>
        <Field label="Email" hint="Your sign-in email cannot be changed here.">
          {(id) => <input id={id} type="email" value={user.email} disabled />}
        </Field>
        <p className="small muted" style={{ margin: 0 }}>
          Member since {formatTimestamp(profile.createdAt)}
        </p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
      {usesPassword && (
        <div className="card section">
          <h3>Password</h3>
          <p className="muted small">We’ll email you a secure link to choose a new password.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                await sendPasswordResetEmail(auth, user.email);
                toast('Password reset email sent');
              } catch (err) {
                toast(friendlyError(err), 'error');
              }
            }}
          >
            Send password reset email
          </button>
        </div>
      )}
    </div>
  );
}
