import { useEffect, useState } from 'react';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { saveSettings } from '../../lib/api.js';
import { ABSENCE_POLICIES, centsToInput, parseMoneyToCents } from '../../lib/billing.js';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Field, Spinner } from '../../components/ui.jsx';

const DAYS = [
  [1, 'Mon'],
  [2, 'Tue'],
  [3, 'Wed'],
  [4, 'Thu'],
  [5, 'Fri'],
  [6, 'Sat'],
  [0, 'Sun'],
];

export default function SettingsPage() {
  const { actor } = useAuth();
  const { settings, saved, loaded } = useSettings();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loaded && !form) setForm({ ...settings, fee: centsToInput(settings.monthlyFeeCents) || '0' });
  }, [loaded, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return <Spinner />;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    const monthlyFeeCents = parseMoneyToCents(form.fee);
    const expiringSoonDays = Number(form.expiringSoonDays);
    if (!form.clubName.trim()) return setError('Enter the club name.');
    if (!form.currency.trim()) return setError('Enter a currency symbol, e.g. $ or €.');
    if (!Number.isInteger(monthlyFeeCents) || monthlyFeeCents < 0) return setError('Enter a valid monthly fee (0 or more).');
    if (!Number.isInteger(expiringSoonDays) || expiringSoonDays < 1 || expiringSoonDays > 60) {
      return setError('“Expiring soon” must be between 1 and 60 days.');
    }
    setBusy(true);
    try {
      await saveSettings(db, actor, {
        clubName: form.clubName.trim(),
        currency: form.currency.trim(),
        monthlyFeeCents,
        absencePolicy: form.absencePolicy,
        expiringSoonDays,
        clubDays: form.clubDays,
      });
      toast('Settings saved');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Super admin</div>
          <h1>Club settings</h1>
          <p className="muted">Only you can change these. Every change is recorded in the activity log.</p>
        </div>
      </div>
      {!saved && (
        <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
          Settings have not been saved yet — the defaults below are in use. Review them and press Save.
        </div>
      )}
      <form className="stack" onSubmit={submit}>
        <ErrorAlert error={error} />
        <div className="card form">
          <h2>General</h2>
          <div className="grid grid-2">
            <Field label="Club name" required>
              {(id) => <input id={id} type="text" maxLength={80} value={form.clubName} onChange={set('clubName')} />}
            </Field>
            <Field label="Currency symbol" required hint="Shown next to amounts, e.g. $, €, £.">
              {(id) => <input id={id} type="text" maxLength={5} value={form.currency} onChange={set('currency')} />}
            </Field>
            <Field label="Monthly fee" hint="Pre-fills the amount when recording a payment.">
              {(id) => <input id={id} type="text" inputMode="decimal" value={form.fee} onChange={set('fee')} />}
            </Field>
            <Field label="“Expiring soon” warning" hint="Days before the end of a subscription.">
              {(id) => <input id={id} type="number" min={1} max={60} value={form.expiringSoonDays} onChange={set('expiringSoonDays')} />}
            </Field>
          </div>
          <div className="field">
            <span className="label">Club days</span>
            <div className="chips">
              {DAYS.map(([d, label]) => {
                const on = form.clubDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={`chip ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      setForm((f) => ({ ...f, clubDays: on ? f.clubDays.filter((x) => x !== d) : [...f.clubDays, d] }))
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <span className="hint">Other days are greyed out on the attendance calendar.</span>
          </div>
        </div>

        <div className="card form">
          <div>
            <h2>Absences &amp; payments</h2>
            <p className="muted small" style={{ margin: 0 }}>
              Does skipping a day mean the family does not have to pay for it? Choose how absences affect a paid subscription. A
              credited day only counts while the subscription is active, and changing this setting never removes days that were
              already credited.
            </p>
          </div>
          {Object.entries(ABSENCE_POLICIES).map(([key, p]) => (
            <label key={key} className="option-card">
              <input type="radio" name="absencePolicy" value={key} checked={form.absencePolicy === key} onChange={set('absencePolicy')} />
              <span>
                <strong>{p.label}</strong>
                {key === 'charge' && <span className="badge plain badge-teacher" style={{ marginLeft: '0.5rem' }}>Default</span>}
                <span className="muted small" style={{ display: 'block' }}>
                  {p.help}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
