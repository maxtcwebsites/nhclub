import { useState } from 'react';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { recordCorrection, recordPayment } from '../lib/api.js';
import {
  centsToInput,
  effectiveExpiry,
  formatMoney,
  fullName,
  nextPeriodStart,
  parseMoneyToCents,
  PAYMENT_METHOD_KEYS,
  periodEndFor,
} from '../lib/billing.js';
import { formatDate, isDateStr, todayStr } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { ErrorAlert, Field, Modal } from './ui.jsx';

export function PaymentModal({ student, onClose }) {
  const { actor } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const toast = useToast();
  const today = todayStr();
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState(centsToInput(settings.monthlyFeeCents));
  const [amountEdited, setAmountEdited] = useState(false);
  const [method, setMethod] = useState('cash');
  const [start, setStart] = useState(nextPeriodStart(student, today));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cents = parseMoneyToCents(amount);
  const end = isDateStr(start) ? periodEndFor(start, months) : null;
  const currentExpiry = effectiveExpiry(student);
  const overlaps = currentExpiry && isDateStr(start) && start <= currentExpiry;

  function changeMonths(value) {
    const m = Number(value);
    setMonths(m);
    if (!amountEdited && settings.monthlyFeeCents > 0) setAmount(centsToInput(settings.monthlyFeeCents * m));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!Number.isInteger(cents) || cents <= 0) return setError(t('pay.errAmount'));
    if (!isDateStr(start)) return setError(t('pay.errStart'));
    setBusy(true);
    try {
      await recordPayment(db, actor, student.id, {
        amountCents: cents,
        months,
        method,
        periodStart: start,
        note,
        currency: settings.currency,
      });
      toast(t('pay.done', { name: student.firstName }));
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={t('pay.title', { name: fullName(student) })} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorAlert error={error} />
        <p className="small muted" style={{ margin: 0 }}>
          {currentExpiry ? t('pay.currentPaid', { date: formatDate(currentExpiry) }) : t('pay.currentNone')}
        </p>
        <div className="grid grid-2">
          <Field label={t('pay.months')} required>
            {(id) => (
              <select id={id} value={months} onChange={(e) => changeMonths(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {t('pay.monthsOption', { n: m })}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('pay.amount', { currency: settings.currency })} required>
            {(id) => (
              <input
                id={id}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountEdited(true);
                }}
                aria-invalid={amount !== '' && !(cents > 0)}
              />
            )}
          </Field>
          <Field label={t('pay.method')}>
            {(id) => (
              <select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHOD_KEYS.map((m) => (
                  <option key={m} value={m}>
                    {t(`method.${m}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('pay.starts')} required hint={t('pay.startsHint')}>
            {(id) => <input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}
          </Field>
        </div>
        <Field label={t('pay.note')} hint={t('pay.noteHint')}>
          {(id) => <input id={id} type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {end && (
          <div className="preview">
            {t('pay.covers', { from: formatDate(start), to: formatDate(end) })}
            <div className="small muted" style={{ fontWeight: 600 }}>
              {t('pay.newEnd', { date: formatDate(end) })}
              {cents > 0 ? ` · ${formatMoney(cents, settings.currency)}` : ''}
              {student.creditDays > 0 ? ` · ${t('pay.creditFolded', { n: student.creditDays })}` : ''}
            </div>
          </div>
        )}
        {overlaps && <div className="alert alert-warn small">{t('pay.overlap', { date: formatDate(currentExpiry) })}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('pay.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CorrectionModal({ student, onClose }) {
  const { actor } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const toast = useToast();
  const current = effectiveExpiry(student);
  const [paidUntil, setPaidUntil] = useState(current || todayStr());
  const [amount, setAmount] = useState('0');
  const [months, setMonths] = useState('0');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const cents = parseMoneyToCents(amount);
    const m = Number(months);
    if (!Number.isInteger(cents)) return setError(t('fix.errAmount'));
    if (!Number.isInteger(m) || m < -24 || m > 24) return setError(t('fix.errMonths'));
    if (note.trim().length < 3) return setError(t('fix.errReason'));
    if (!isDateStr(paidUntil)) return setError(t('fix.errDate'));
    setBusy(true);
    try {
      await recordCorrection(db, actor, student.id, {
        newPaidUntil: paidUntil,
        amountCents: cents,
        months: m,
        note,
        currency: settings.currency,
      });
      toast(t('fix.done'));
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={t('fix.title', { name: fullName(student) })} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="small muted" style={{ margin: 0 }}>
          {t('fix.intro')}
        </p>
        <ErrorAlert error={error} />
        <Field label={t('fix.newDate')} required hint={t('fix.currently', { date: current ? formatDate(current) : t('fix.notPaid') })}>
          {(id) => <input id={id} type="date" value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />}
        </Field>
        <div className="grid grid-2">
          <Field label={t('fix.amount', { currency: settings.currency })} hint={t('fix.amountHint')}>
            {(id) => <input id={id} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label={t('fix.months')} hint={t('fix.monthsHint')}>
            {(id) => <input id={id} type="number" min={-24} max={24} step={1} value={months} onChange={(e) => setMonths(e.target.value)} />}
          </Field>
        </div>
        <Field label={t('fix.reason')} required>
          {(id) => <textarea id={id} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('fix.submit')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
