import { useEffect, useState } from 'react';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { saveSettings } from '../../lib/api.js';
import { ABSENCE_POLICY_KEYS, centsToInput, parseMoneyToCents } from '../../lib/billing.js';
import { weekdayNames } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Field, Spinner } from '../../components/ui.jsx';
import { CLUB_NAME } from '../../config.js';

// Club day numbers in Monday-first order (0 = Sunday).
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 0];

// Club-wide settings (super admin only).
export default function SettingsPage() {
  const { actor } = useAuth();
  const { settings, saved, loaded } = useSettings();
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loaded && !form) setForm({ ...settings, fee: centsToInput(settings.monthlyFeeCents) || '0' });
  }, [loaded, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return <Spinner />;
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const dayNames = weekdayNames('short');

  async function submit(e) {
    e.preventDefault();
    setError('');
    const monthlyFeeCents = parseMoneyToCents(form.fee);
    const expiringSoonDays = Number(form.expiringSoonDays);
    if (!form.currency.trim()) return setError(t('club.errCurrency'));
    if (!Number.isInteger(monthlyFeeCents) || monthlyFeeCents < 0) return setError(t('club.errFee'));
    if (!Number.isInteger(expiringSoonDays) || expiringSoonDays < 1 || expiringSoonDays > 60) return setError(t('club.errSoon'));
    setBusy(true);
    try {
      await saveSettings(db, actor, {
        clubName: CLUB_NAME,
        currency: form.currency.trim(),
        monthlyFeeCents,
        absencePolicy: form.absencePolicy,
        expiringSoonDays,
        clubDays: form.clubDays,
      });
      toast(t('club.saved'));
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
          <div className="eyebrow">{t('club.eyebrow')}</div>
          <h1>{t('club.title')}</h1>
          <p className="muted">{t('club.subtitle')}</p>
        </div>
      </div>
      {!saved && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          {t('club.notSaved')}
        </div>
      )}
      <form className="stack stagger" onSubmit={submit}>
        <ErrorAlert error={error} />
        <div className="card form">
          <div className="card-title">
            <h2>{t('club.general')}</h2>
          </div>
          <div className="grid grid-2">
            <Field label={t('club.currency')} required hint={t('club.currencyHint')}>
              {(id) => <input id={id} type="text" maxLength={5} value={form.currency} onChange={set('currency')} />}
            </Field>
            <Field label={t('club.fee')} hint={t('club.feeHint')}>
              {(id) => <input id={id} type="text" inputMode="decimal" value={form.fee} onChange={set('fee')} />}
            </Field>
            <Field label={t('club.soon')} hint={t('club.soonHint')}>
              {(id) => <input id={id} type="number" min={1} max={60} value={form.expiringSoonDays} onChange={set('expiringSoonDays')} />}
            </Field>
          </div>
          <div className="field">
            <span className="label">{t('club.clubDays')}</span>
            <div className="chips">
              {DAY_NUMBERS.map((d, i) => {
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
                    {dayNames[i]}
                  </button>
                );
              })}
            </div>
            <span className="hint">{t('club.clubDaysHint')}</span>
          </div>
        </div>

        <div className="card form">
          <div className="card-title">
            <h2>{t('club.absences')}</h2>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {t('club.absencesIntro')}
          </p>
          {ABSENCE_POLICY_KEYS.map((key) => (
            <label key={key} className="option-card">
              <input type="radio" name="absencePolicy" value={key} checked={form.absencePolicy === key} onChange={set('absencePolicy')} />
              <span>
                <strong>{t(`policy.${key}.label`)}</strong>
                {key === 'charge' && <span className="tag">{t('club.default')}</span>}
                <span className="muted small" style={{ display: 'block' }}>
                  {t(`policy.${key}.help`)}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? t('common.saving') : t('club.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
