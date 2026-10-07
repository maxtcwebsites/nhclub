import { addDays, addMonths, diffDays } from './dates.js';
import { getLocale, tr } from '../i18n/index.js';

export const DEFAULT_SETTINGS = {
  clubName: 'AClub',
  currency: '$',
  monthlyFeeCents: 0,
  absencePolicy: 'charge',
  expiringSoonDays: 7,
  clubDays: [1, 2, 3, 4, 5],
};

// Labels live in the translation files: policy.<key>.label / .help
export const ABSENCE_POLICY_KEYS = ['charge', 'excused', 'all'];

// Labels: method.<key>
export const PAYMENT_METHOD_KEYS = ['cash', 'card', 'bank_transfer', 'other'];

// Paid-until date including any absence credit days.
export function effectiveExpiry(student) {
  if (!student?.paidUntil) return null;
  return addDays(student.paidUntil, student.creditDays || 0);
}

// One subscription "month" starting on `start` (inclusive).
export function periodEndFor(start, months) {
  return addDays(addMonths(start, months), -1);
}

// Where a new payment should start: the day after the current subscription
// ends, or today if it has already run out.
export function nextPeriodStart(student, today) {
  const expiry = effectiveExpiry(student);
  if (expiry && expiry >= today) return addDays(expiry, 1);
  return today;
}

export function subscriptionInfo(student, today, soonDays = DEFAULT_SETTINGS.expiringSoonDays) {
  const expiry = effectiveExpiry(student);
  if (student?.status === 'archived') {
    return { state: 'archived', label: tr('status.archived'), expiry, daysLeft: null };
  }
  if (!expiry) {
    return { state: 'unpaid', label: tr('status.unpaid'), expiry: null, daysLeft: null };
  }
  const daysLeft = diffDays(expiry, today);
  if (daysLeft < 0) {
    return { state: 'expired', label: tr('time.expiredAgo', { n: -daysLeft }), expiry, daysLeft };
  }
  if (daysLeft === 0) return { state: 'expiring', label: tr('time.lastDayToday'), expiry, daysLeft };
  return { state: daysLeft <= soonDays ? 'expiring' : 'active', label: tr('time.daysLeft', { n: daysLeft }), expiry, daysLeft };
}

const STATE_ORDER = { expired: 0, expiring: 1, unpaid: 2, active: 3, archived: 4 };

// Most urgent first: expired, expiring soon, never paid, active, archived.
export function compareByUrgency(a, b) {
  const s = STATE_ORDER[a.info.state] - STATE_ORDER[b.info.state];
  if (s !== 0) return s;
  if (a.info.expiry && b.info.expiry && a.info.expiry !== b.info.expiry) {
    return a.info.expiry < b.info.expiry ? -1 : 1;
  }
  return fullName(a.student).localeCompare(fullName(b.student));
}

export function fullName(student) {
  return `${student?.firstName ?? ''} ${student?.lastName ?? ''}`.trim();
}

export function isCreditEligible(status, policy) {
  if (status === 'absent') return policy === 'all';
  if (status === 'excused') return policy === 'excused' || policy === 'all';
  return false;
}

// Decide whether an attendance mark should carry an absence credit.
// Existing credits are kept as long as the status does not change, so a later
// policy change never silently removes credit that was already granted.
export function resolveCredit({ status, date, previous, student, policy }) {
  if (previous?.credited && previous.status === status) return true;
  if (!isCreditEligible(status, policy)) return false;
  const expiry = effectiveExpiry(student);
  if (previous?.credited) return true; // credit already counted in expiry
  return Boolean(expiry && date <= expiry);
}

export function formatMoney(cents, currency = DEFAULT_SETTINGS.currency) {
  const value = (cents || 0) / 100;
  const abs = Math.abs(value).toLocaleString(getLocale(), {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? '−' : ''}${currency}${abs}`;
}

// "12.5", "12,50", "1.234,50" or "1,234.50" -> cents. NaN if it is not a
// plain amount. A comma followed by 1-2 digits at the end is a decimal comma.
export function parseMoneyToCents(text) {
  let clean = String(text ?? '').trim().replace(/\s/g, '');
  if (/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(clean)) clean = clean.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d{1,2}$/.test(clean)) clean = clean.replace(',', '.');
  else clean = clean.replace(/,/g, '');
  if (!/^-?\d{1,6}(\.\d{1,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean) * 100);
}

export function centsToInput(cents) {
  if (!cents) return '';
  const text = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return getLocale().startsWith('es') ? text.replace('.', ',') : text;
}
