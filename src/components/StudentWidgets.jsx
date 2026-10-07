import { useMemo, useState } from 'react';
import { formatMoney } from '../lib/billing.js';
import { formatDate, formatTimestamp, monthEnd, monthStart, todayStr, weekdayOf } from '../lib/dates.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import MonthCalendar from './MonthCalendar.jsx';
import { Empty } from './ui.jsx';

export function sortNewestFirst(list, field = 'createdAt') {
  return [...list].sort((a, b) => (b[field]?.toMillis?.() ?? Infinity) - (a[field]?.toMillis?.() ?? Infinity));
}

export function PaymentsTable({ payments, currency, staff = false }) {
  const { t } = useI18n();
  if (payments.length === 0) {
    return (
      <Empty code={t('widgets.noPaymentsCode')} title={t('widgets.noPayments')}>
        <p className="small">{t('widgets.noPaymentsText')}</p>
      </Empty>
    );
  }
  const hasNotes = payments.some((p) => p.note);
  const col = (key) => t(`widgets.${key}`);
  return (
    <div className="table-wrap">
      <table className="stack-table">
        <thead>
          <tr>
            <th>{col('recorded')}</th>
            <th>{col('type')}</th>
            <th className="right">{col('amount')}</th>
            <th>{col('covers')}</th>
            <th>{col('method')}</th>
            {staff && <th>{col('by')}</th>}
            {hasNotes && <th>{col('note')}</th>}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="nowrap" data-label={col('recorded')}>
                {formatTimestamp(p.createdAt)}
              </td>
              <td data-label={col('type')}>
                {p.kind === 'payment' ? (
                  <span className="badge plain badge-active">{col('kindPayment')}</span>
                ) : (
                  <span className="badge plain badge-expiring">{col('kindCorrection')}</span>
                )}
              </td>
              <td className={`right nowrap ${p.amountCents < 0 ? 'amount-neg' : ''}`} data-label={col('amount')}>
                <strong>{formatMoney(p.amountCents, p.currency || currency)}</strong>
                {p.months !== 0 && (
                  <span className="sub">
                    {p.months > 0 ? '+' : ''}
                    {t('time.months', { n: p.months })}
                  </span>
                )}
              </td>
              <td className="nowrap" data-label={col('covers')}>
                {p.periodStart
                  ? `${formatDate(p.periodStart)} – ${formatDate(p.periodEnd)}`
                  : t('widgets.newEnd', { date: formatDate(p.periodEnd) })}
              </td>
              <td data-label={col('method')}>{t(`method.${p.method}`)}</td>
              {staff && <td data-label={col('by')}>{p.createdByName}</td>}
              {hasNotes && (
                <td className="small" style={{ maxWidth: 260 }} data-label={col('note')}>
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
  const { t } = useI18n();
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
          const label = t(`att.${r.status}`);
          return {
            className: r.status,
            label: `${label}${r.note ? ` — ${r.note}` : ''}`,
            content: <span className="tag">{label[0]}</span>,
          };
        }}
      />
      <div className="legend">
        {['present', 'absent', 'excused'].map((k) => (
          <span key={k}>
            <i className={`c-${k}`} /> {t(`att.${k}`)}: {counts[k]}
          </span>
        ))}
      </div>
      {noted.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4 className="eyebrow" style={{ marginTop: 18 }}>
            {t('widgets.notesMonth')}
          </h4>
          <ul className="timeline">
            {noted.map((r) => (
              <li key={r.id}>
                <span className={`log-tag t-${r.status}`} aria-hidden="true">
                  {t(`att.${r.status}`).slice(0, 3).toUpperCase()}
                </span>
                <div>
                  <div>{r.note}</div>
                  <div className="meta">
                    {formatDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' })} · {t(`att.${r.status}`)}
                    {r.credited ? ` · ${t('widgets.dayAdded')}` : ''}
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
  const { t } = useI18n();
  const rows = [
    [t('field.dateOfBirth'), formatDate(student.dateOfBirth)],
    [t('field.grade'), student.grade],
    [t('field.allergies'), student.allergies],
    [t('field.medicalNotes'), student.medicalNotes],
    [t('widgets.emergency'), `${student.emergencyName} · ${student.emergencyPhone}`],
    [t('widgets.pickup'), student.authorizedPickup],
  ];
  if (parent) {
    rows.unshift([t('field.parent'), `${parent.displayName}\n${parent.email}${parent.phone ? `\n${parent.phone}` : ''}`]);
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
