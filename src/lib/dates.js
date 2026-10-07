// Calendar dates are stored as local 'YYYY-MM-DD' strings so that a day means
// the same thing for every user regardless of time zone.

const pad = (n) => String(n).padStart(2, '0');

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isDateStr(value) {
  return typeof value === 'string' && DATE_RE.test(value);
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDateStr(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(value, days) {
  const date = parseDateStr(value);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

// Adds calendar months, clamping to the last day of the target month
// (Jan 31 + 1 month = Feb 28/29).
export function addMonths(value, months) {
  const [y, m, d] = value.split('-').map(Number);
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toDateStr(new Date(year, month, Math.min(d, lastDay)));
}

// Whole days from b to a (positive when a is later).
export function diffDays(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
}

export function formatDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!isDateStr(value)) return '—';
  return parseDateStr(value).toLocaleDateString(undefined, options);
}

export function formatTimestamp(ts) {
  if (!ts) return '…';
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ageFrom(dateOfBirth, today = todayStr()) {
  if (!isDateStr(dateOfBirth)) return null;
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

export function monthStart(value) {
  return `${value.slice(0, 7)}-01`;
}

export function monthEnd(value) {
  return addDays(addMonths(monthStart(value), 1), -1);
}

// Weeks (arrays of 7 date strings or null) covering the month of `value`,
// starting on Monday.
export function monthGrid(value) {
  const first = monthStart(value);
  const last = monthEnd(value);
  const offset = (parseDateStr(first).getDay() + 6) % 7;
  const cells = Array(offset).fill(null);
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function weekdayOf(value) {
  return parseDateStr(value).getDay();
}
