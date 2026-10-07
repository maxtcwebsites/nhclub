import { useMemo, useState } from 'react';
import { formatMoney, PAYMENT_METHODS } from '../lib/billing.js';
import { formatDate, formatTimestamp, monthEnd, monthStart, todayStr, weekdayOf } from '../lib/dates.js';
import { ATTENDANCE_LABELS } from '../lib/api.js';
import MonthCalendar from './MonthCalendar.jsx';
import { Empty } from './ui.jsx';

export function sortNewestFirst(list, field = 'createdAt') {
  return [...list].sort((a, b) => (b[field]?.toMillis?.() ?? Infinity) - (a[field]?.toMillis?.() ?? Infinity));
}

export function PaymentsTable({ payments, currency, staff = false }) {
  if (payments.length === 0) {
    return (
      <Empty code="NO PAYMENTS" title="No payments yet">
        <p className="small">Payments appear here as soon as club staff record them.</p>
      </Empty>
    );
  }
  const hasNotes = payments.some((p) => p.note);
  return (
    <div className="table-wrap">
      <table className="stack-table">
        <thead>
          <tr>
            <th>Recorded</th>
            <th>Type</th>
            <th className="right">Amount</th>
            <th>Covers</th>
            <th>Method</th>
            {staff && <th>By</th>}
            {hasNotes && <th>Note</th>}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="nowrap" data-label="Recorded">
                {formatTimestamp(p.createdAt)}
              </td>
              <td data-label="Type">
                {p.kind === 'payment' ? (
                  <span className="badge plain badge-active">Payment</span>
                ) : (
                  <span className="badge plain badge-expiring">Correction</span>
                )}
              </td>
              <td className={`right nowrap ${p.amountCents < 0 ? 'amount-neg' : ''}`} data-label="Amount">
                <strong>{formatMoney(p.amountCents, p.currency || currency)}</strong>
                {p.months !== 0 && (
                  <span className="sub">
                    {p.months > 0 ? '+' : ''}
                    {p.months} month{Math.abs(p.months) === 1 ? '' : 's'}
                  </span>
                )}
              </td>
              <td className="nowrap" data-label="Covers">
                {p.periodStart ? `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}` : `New end: ${formatDate(p.periodEnd)}`}
              </td>
              <td data-label="Method">{PAYMENT_METHODS[p.method] || p.method}</td>
              {staff && <td data-label="By">{p.createdByName}</td>}
              {hasNotes && (
                <td className="small" style={{ maxWidth: 260 }} data-label="Note">
                  {p.note || <span className="muted">—</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AttendanceCalendar({ records, clubDays, initialMonth }) {
  const [month, setMonth] = useState(monthStart(initialMonth || todayStr()));
  const byDate = useMemo(() => Object.fromEntries(records.map((r) => [r.date, r])), [records]);
  const inMonth = records.filter((r) => r.date >= month && r.date <= monthEnd(month));
  const counts = { present: 0, absent: 0, excused: 0 };
  inMonth.forEach((r) => {
    counts[r.status] += 1;
  });
  const noted = inMonth.filter((r) => r.note).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div>
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        small
        renderDay={(date) => {
          const r = byDate[date];
          const off = !clubDays.includes(weekdayOf(date));
          if (!r) return { className: off ? 'off' : '' };
          return {
            className: r.status,
            label: `${ATTENDANCE_LABELS[r.status]}${r.note ? ` — ${r.note}` : ''}`,
            content: <span className="tag">{ATTENDANCE_LABELS[r.status][0]}</span>,
          };
        }}
      />
      <div className="legend">
        <span>
          <i className="c-present" /> Present: {counts.present}
        </span>
        <span>
          <i className="c-absent" /> Absent: {counts.absent}
        </span>
        <span>
          <i className="c-excused" /> Excused: {counts.excused}
        </span>
      </div>
      {noted.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4 className="eyebrow" style={{ marginTop: 18 }}>
            Notes this month
          </h4>
          <ul className="timeline">
            {noted.map((r) => (
              <li key={r.id}>
                <span className={`log-tag t-${r.status}`} aria-hidden="true">
                  {ATTENDANCE_LABELS[r.status].slice(0, 3).toUpperCase()}
                </span>
                <div>
                  <div>{r.note}</div>
                  <div className="meta">
                    {formatDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {ATTENDANCE_LABELS[r.status]}
                    {r.credited ? ' · +1 day added' : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ChildDetails({ student, parent }) {
  const rows = [
    ['Date of birth', formatDate(student.dateOfBirth)],
    ['Grade / class', student.grade],
    ['Allergies', student.allergies],
    ['Medical notes', student.medicalNotes],
    ['Emergency contact', `${student.emergencyName} · ${student.emergencyPhone}`],
    ['Allowed to pick up', student.authorizedPickup],
  ];
  if (parent) {
    rows.unshift(['Parent', `${parent.displayName}\n${parent.email}${parent.phone ? `\n${parent.phone}` : ''}`]);
  }
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v || <span className="muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
