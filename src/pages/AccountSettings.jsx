import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { updateOwnProfile } from '../lib/api.js';
import { formatTimestamp } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { ErrorAlert, Field, RoleBadge } from '../components/ui.jsx';

// Account settings: language, profile and password.
export default function AccountSettings() {
  const { user, profile, role } = useAuth();
  const { t, lang, setLang, languages } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(profile.displayName);
  const [phone, setPhone] = useState(profile.phone || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const usesPassword = user.providerData.some((p) => p.providerId === 'password');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError(t('account.nameReq'));
    setBusy(true);
    try {
      await updateOwnProfile(db, user, { displayName: name, phone });
      toast(t('account.saved'));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('account.eyebrow')}</div>
          <h1>{t('account.title')}</h1>
        </div>
        <RoleBadge role={role} />
      </div>

      <div className="stack stagger">
        <section className="card form" aria-labelledby="lang-title">
          <div className="card-title">
            <h2 id="lang-title">{t('account.language')}</h2>
          </div>
          <div className="grid grid-2">
            {languages.map((l) => (
              <label key={l.code} className="option-card" lang={l.code}>
                <input type="radio" name="language" value={l.code} checked={lang === l.code} onChange={() => setLang(l.code)} />
                <span>
                  <strong>{l.name}</strong>
                  <span className="tag">{l.short}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {t('account.languageHint')}
          </p>
        </section>

        <form className="card form" onSubmit={submit}>
          <div className="card-title">
            <h2>{t('account.profile')}</h2>
          </div>
          <ErrorAlert error={error} />
          <Field label={t('account.fullName')} required>
            {(id) => <input id={id} type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
          </Field>
          <Field label={t('account.phone')}>
            {(id) => <input id={id} type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />}
          </Field>
          <Field label={t('auth.email')} hint={t('account.emailHint')}>
            {(id) => <input id={id} type="email" value={user.email} disabled />}
          </Field>
          <div className="row-between">
            <span className="small muted">{t('account.memberSince', { date: formatTimestamp(profile.createdAt) })}</span>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>

        {usesPassword && (
          <section className="card">
            <div className="card-title">
              <h2>{t('account.password')}</h2>
            </div>
            <p className="muted small">{t('account.passwordText')}</p>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await sendPasswordResetEmail(auth, user.email);
                  toast(t('account.passwordSent'));
                } catch (err) {
                  toast(friendlyError(err), 'error');
                }
              }}
            >
              {t('account.passwordBtn')}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
