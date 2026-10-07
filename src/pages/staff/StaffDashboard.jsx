import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { compareByUrgency, formatMoney, fullName, subscriptionInfo } from '../../lib/billing.js';
import { ageFrom, formatDate, formatTimestamp, monthStart, parseDateStr, todayStr } from '../../lib/dates.js';
import { Empty, ErrorAlert, Spinner, StatusBadge } from '../../components/ui.jsx';
import { PaymentModal } from '../../components/PaymentModals.jsx';

const FILTERS = [
  { key: 'enrolled', test: (s) => s !== 'archived' },
  { key: 'attention', test: (s) => s === 'expired' || s === 'expiring' || s === 'unpaid' },
  { key: 'expiring', test: (s) => s === 'expiring' },
  { key: 'expired', test: (s) => s === 'expired' },
  { key: 'unpaid', test: (s) => s === 'unpaid' },
  { key: 'active', test: (s) => s === 'active' },
  { key: 'archived', test: (s) => s === 'archived' },
];

export default function StaffDashboard() {
  const { settings } = useSettings();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('enrolled');
  const [search, setSearch] = useState('');
  const [paying, setPaying] = useState(null);
  const today = todayStr();

  const students = useCollection(() => collection(db, 'students'), []);
  const users = useCollection(() => collection(db, 'users'), []);
  const monthPayments = useCollection(
    () => query(collection(db, 'payments'), where('createdAt', '>=', Timestamp.fromDate(parseDateStr(monthStart(today))))),
    [today.slice(0, 7)],
  );
  const recent = useCollection(() => query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(8)), []);

  const parents = useMemo(() => Object.fromEntries(users.data.map((u) => [u.id, u])), [users.data]);
  const rows = useMemo(
    () =>
      students.data
        .map((student) => ({ student, info: subscriptionInfo(student, today, settings.expiringSoonDays) }))
        .sort(compareByUrgency),
    // lang: the status labels are translated
    [students.data, today, settings.expiringSoonDays, lang], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const studentsById = useMemo(() => Object.fromEntries(students.data.map((s) => [s.id, s])), [students.data]);

  const count = (key) => rows.filter((r) => FILTERS.find((f) => f.key === key).test(r.info.state)).length;
  const active = FILTERS.find((f) => f.key === filter);
  const term = search.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (!active.test(r.info.state)) return false;
    if (!term) return true;
    const parent = parents[r.student.parentUid];
    return `${fullName(r.student)} ${parent?.displayName ?? ''} ${parent?.email ?? ''}`.toLowerCase().includes(term);
  });
  const collected = monthPayments.data.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('staff.eyebrow')}</div>
          <h1>{t('staff.title')}</h1>
          <p className="muted">{t('staff.subtitle')}</p>
        </div>
        <div className="row page-actions">
          <Link to="/staff/attendance" className="btn">
            {t('staff.takeAttendance')}
          </Link>
          <Link to="/staff/students/new" className="btn btn-primary">
            {t('staff.enroll')}
          </Link>
        </div>
      </div>

      <div className="grid grid-4 stagger" style={{ marginBottom: 28 }}>
        <div className="card stat accent">
          <div className="label">{t('staff.enrolled')}</div>
          <div className="value">{count('enrolled')}</div>
        </div>
        <div className="card stat amber">
          <div className="label">{t('staff.expiringIn', { n: settings.expiringSoonDays })}</div>
          <div className="value">{count('expiring')}</div>
        </div>
        <div className="card stat red">
          <div className="label">{t('staff.expiredUnpaid')}</div>
          <div className="value">
            {count('expired')} <span className="of">/ {count('unpaid')}</span>
          </div>
        </div>
        <div className="card stat green">
          <div className="label">{t('staff.collected')}</div>
          <div className="value">{formatMoney(collected, settings.currency)}</div>
        </div>
      </div>

      <ErrorAlert error={students.error || users.error} />

      <div className="toolbar">
        <div className="chips" role="tablist" aria-label={t('staff.filterLabel')}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`chip ${filter === f.key ? 'on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {t(`staff.filters.${f.key}`)}
              <span className="count">{count(f.key)}</span>
            </button>
          ))}
        </div>
        <input type="search" placeholder={t('staff.search')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('staff.search')} />
      </div>

      {students.loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="card">
          <Empty
            code={rows.length === 0 ? t('staff.emptyCode') : t('staff.emptyFilterCode')}
            title={rows.length === 0 ? t('staff.emptyNone') : t('staff.emptyFilter')}
          >
            <p className="small">{rows.length === 0 ? t('staff.emptyNoneText') : t('staff.emptyFilterText')}</p>
          </Empty>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>{t('staff.student')}</th>
                <th>{t('staff.parent')}</th>
                <th>{t('staff.status')}</th>
                <th>{t('staff.paidUntil')}</th>
                <th className="right">{t('staff.total')}</th>
                <th>
                  <span className="sr-only">{t('staff.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ student, info }) => {
                const parent = parents[student.parentUid];
                const age = ageFrom(student.dateOfBirth, today);
                return (
                  <tr key={student.id} className="clickable" onClick={() => navigate(`/staff/students/${student.id}`)}>
                    <td className="primary-cell">
                      <Link to={`/staff/students/${student.id}`} onClick={(e) => e.stopPropagation()}>
                        {fullName(student)}
                      </Link>
                      <span className="sub">
                        {age !== null ? t('common.years', { n: age }) : ''}
                        {student.allergies ? ` / ${t('staff.allergies')}` : ''}
                      </span>
                    </td>
                    <td data-label={t('staff.parent')}>
                      {parent?.displayName ?? '—'}
                      <span className="sub">{parent?.phone || parent?.email}</span>
                    </td>
                    <td data-label={t('staff.status')}>
                      <StatusBadge student={student} soonDays={settings.expiringSoonDays} />
                    </td>
                    <td className="nowrap" data-label={t('staff.paidUntil')}>
                      {info.expiry ? formatDate(info.expiry) : '—'}
                      {info.expiry && <span className="sub">{info.label}</span>}
                    </td>
                    <td className="right" data-label={t('staff.total')}>
                      {formatMoney(student.totalPaidCents, settings.currency)}
                    </td>
                    <td className="right actions-cell">
                      {student.status !== 'archived' && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaying(student);
                          }}
                        >
                          {t('staff.payment')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card section">
        <div className="card-title">
          <h2>{t('staff.latest')}</h2>
          <Link to="/staff/activity" className="btn btn-sm">
            {t('staff.fullLog')}
          </Link>
        </div>
        {recent.data.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            {t('staff.noPayments')}
          </p>
        ) : (
          <ul className="timeline">
            {recent.data.map((p) => {
              const s = studentsById[p.studentId];
              const amount = formatMoney(p.amountCents, p.currency || settings.currency);
              return (
                <li key={p.id}>
                  <span className={`log-tag ${p.kind === 'payment' ? 't-pay' : 't-fix'}`} aria-hidden="true">
                    {t(`logTypes.${p.kind === 'payment' ? 'payment' : 'correction'}.tag`)}
                  </span>
                  <div>
                    <div>
                      <strong>
                        {p.kind === 'payment'
                          ? t('staff.latestPayment', { amount, months: t('time.months', { n: p.months }) })
                          : t('staff.latestCorrection', { amount })}
                      </strong>{' '}
                      — {s ? <Link to={`/staff/students/${s.id}`}>{fullName(s)}</Link> : t('staff.unknownStudent')}
                    </div>
                    <div className="meta">
                      {t('staff.latestMeta', { when: formatTimestamp(p.createdAt), by: p.createdByName, date: formatDate(p.periodEnd) })}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {paying && <PaymentModal student={studentsById[paying.id] || paying} onClose={() => setPaying(null)} />}
    </>
  );
}
