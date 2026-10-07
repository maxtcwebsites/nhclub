import { useState } from 'react';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { recordCorrection, recordPayment } from '../lib/api.js';
import {
  centsToInput,
  effectiveExpiry,
  formatMoney,
  fullName,
  nextPeriodStart,
  parseMoneyToCents,
  PAYMENT_METHODS,
  periodEndFor,
} from '../lib/billing.js';
import { formatDate, isDateStr, todayStr } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { ErrorAlert, Field, Modal } from './ui.jsx';

export function PaymentModal({ student, onClose }) {
  const { actor } = useAuth();
  const { settings } = useSettings();
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
    if (!Number.isInteger(cents) || cents <= 0) return setError('Enter the amount received (more than 0).');
    if (!isDateStr(start)) return setError('Pick the date the paid period starts.');
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
      toast(`Payment recorded for ${student.firstName}`);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Record payment — ${fullName(student)}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <ErrorAlert error={error} />
        <p className="small muted" style={{ margin: 0 }}>
          Currently: {currentExpiry ? `paid until ${formatDate(currentExpiry)}` : 'no payment recorded yet'}.
        </p>
        <div className="grid grid-2">
          <Field label="Months paid" required>
            {(id) => (
              <select id={id} value={months} onChange={(e) => changeMonths(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} month{m === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={`Amount received (${settings.currency})`} required>
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
          <Field label="Method">
            {(id) => (
              <select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
                {['cash', 'card', 'bank_transfer', 'other'].map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHODS[m]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Starts on" required hint="Defaults to the day after the current period.">
            {(id) => <input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}
          </Field>
        </div>
        <Field label="Note" hint="Optional — e.g. receipt number.">
          {(id) => <input id={id} type="text" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {end && (
          <div className="preview">
            Covers {formatDate(start)} – {formatDate(end)}
            <div className="small muted" style={{ fontWeight: 600 }}>
              New paid-until date: {formatDate(end)}
              {cents > 0 ? ` · ${formatMoney(cents, settings.currency)}` : ''}
              {student.creditDays > 0 ? ` · the ${student.creditDays} absence day(s) are already counted in the start date` : ''}
            </div>
          </div>
        )}
        {overlaps && (
          <div className="alert alert-warn small">
            This start date overlaps the period that is already paid (until {formatDate(currentExpiry)}).
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CorrectionModal({ student, onClose }) {
  const { actor } = useAuth();
  const { settings } = useSettings();
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
    if (!Number.isInteger(cents)) return setError('Enter an amount like 0, 25 or -25.');
    if (!Number.isInteger(m) || m < -24 || m > 24) return setError('Months must be a whole number between -24 and 24.');
    if (note.trim().length < 3) return setError('Please write the reason for this correction.');
    if (!isDateStr(paidUntil)) return setError('Pick the new paid-until date.');
    setBusy(true);
    try {
      await recordCorrection(db, actor, student.id, {
        newPaidUntil: paidUntil,
        amountCents: cents,
        months: m,
        note,
        currency: settings.currency,
      });
      toast('Correction saved');
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Correction — ${fullName(student)}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="small muted" style={{ margin: 0 }}>
          Use this to fix a mistake, give free days or record a refund. Nothing is deleted: the correction is added to the history
          with your name and reason.
        </p>
        <ErrorAlert error={error} />
        <Field label="New paid-until date" required hint={`Currently ${current ? formatDate(current) : 'not paid'}.`}>
          {(id) => <input id={id} type="date" value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />}
        </Field>
        <div className="grid grid-2">
          <Field label={`Amount change (${settings.currency})`} hint="Negative for a refund, 0 for none.">
            {(id) => <input id={id} type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Months change" hint="e.g. -1 if a month was entered twice.">
            {(id) => <input id={id} type="number" min={-24} max={24} step={1} value={months} onChange={(e) => setMonths(e.target.value)} />}
          </Field>
        </div>
        <Field label="Reason" required>
          {(id) => <textarea id={id} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save correction'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
