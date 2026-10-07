import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { compareByUrgency, formatMoney, fullName, subscriptionInfo } from '../../lib/billing.js';
import { ageFrom, formatDate, formatTimestamp, monthStart, parseDateStr, todayStr } from '../../lib/dates.js';
import { Empty, ErrorAlert, Spinner, StatusBadge } from '../../components/ui.jsx';
import { PaymentModal } from '../../components/PaymentModals.jsx';

const FILTERS = [
  { key: 'enrolled', label: 'All enrolled', test: (s) => s !== 'archived' },
  { key: 'attention', label: 'Needs attention', test: (s) => s === 'expired' || s === 'expiring' || s === 'unpaid' },
  { key: 'expiring', label: 'Expiring soon', test: (s) => s === 'expiring' },
  { key: 'expired', label: 'Expired', test: (s) => s === 'expired' },
  { key: 'unpaid', label: 'Not paid yet', test: (s) => s === 'unpaid' },
  { key: 'active', label: 'Paid up', test: (s) => s === 'active' },
  { key: 'archived', label: 'Archived', test: (s) => s === 'archived' },
];

export default function StaffDashboard() {
  const { settings } = useSettings();
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
    [students.data, today, settings.expiringSoonDays],
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
          <div className="eyebrow">Staff dashboard</div>
          <h1>Students</h1>
          <p className="muted">Sorted by who needs attention first: expired, expiring soon, then not paid yet.</p>
        </div>
        <Link to="/staff/attendance" className="btn btn-primary">
          Take attendance
        </Link>
      </div>

      <div className="grid grid-4 stagger" style={{ marginBottom: 28 }}>
        <div className="card stat accent">
          <div className="label">Enrolled</div>
          <div className="value">{count('enrolled')}</div>
        </div>
        <div className="card stat amber">
          <div className="label">Expiring in {settings.expiringSoonDays} days</div>
          <div className="value">{count('expiring')}</div>
        </div>
        <div className="card stat red">
          <div className="label">Expired / not paid</div>
          <div className="value">
            {count('expired')} <span className="of">/ {count('unpaid')}</span>
          </div>
        </div>
        <div className="card stat green">
          <div className="label">Collected this month</div>
          <div className="value">{formatMoney(collected, settings.currency)}</div>
        </div>
      </div>

      <ErrorAlert error={students.error || users.error} />

      <div className="toolbar">
        <div className="chips" role="tablist" aria-label="Filter students">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`chip ${filter === f.key ? 'on' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="count">{count(f.key)}</span>
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search child or parent…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search" />
      </div>

      {students.loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="card">
          <Empty code={rows.length === 0 ? 'NO STUDENTS' : '0 RESULTS'} title={rows.length === 0 ? 'No students yet' : 'Nobody here'}>
            <p className="small">
              {rows.length === 0 ? 'Students appear here when parents register them.' : 'No students match this filter.'}
            </p>
          </Empty>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th>Status</th>
                <th>Paid until</th>
                <th className="right">Total paid</th>
                <th>
                  <span className="sr-only">Actions</span>
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
                        {age !== null ? `${age} yrs` : ''}
                        {student.allergies ? ' / ALLERGIES' : ''}
                      </span>
                    </td>
                    <td data-label="Parent">
                      {parent?.displayName ?? '—'}
                      <span className="sub">{parent?.phone || parent?.email}</span>
                    </td>
                    <td data-label="Status">
                      <StatusBadge student={student} soonDays={settings.expiringSoonDays} />
                    </td>
                    <td className="nowrap" data-label="Paid until">
                      {info.expiry ? formatDate(info.expiry) : '—'}
                      {info.expiry && <span className="sub">{info.label}</span>}
                    </td>
                    <td className="right" data-label="Total paid">
                      {formatMoney(student.totalPaidCents, settings.currency)}
                    </td>
                    <td className="right actions-cell">
                      {student.status !== 'archived' && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaying(student);
                          }}
                        >
                          + Payment
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
          <h2>Latest payments</h2>
          <Link to="/staff/activity" className="btn btn-sm">
            Full log
          </Link>
        </div>
        {recent.data.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>
            No payments recorded yet.
          </p>
        ) : (
          <ul className="timeline">
            {recent.data.map((p) => {
              const s = studentsById[p.studentId];
              return (
                <li key={p.id}>
                  <span className={`log-tag ${p.kind === 'payment' ? 't-pay' : 't-fix'}`} aria-hidden="true">
                    {p.kind === 'payment' ? 'PAY' : 'FIX'}
                  </span>
                  <div>
                    <div>
                      <strong>{formatMoney(p.amountCents, p.currency || settings.currency)}</strong>{' '}
                      {p.kind === 'payment' ? `for ${p.months} month${p.months === 1 ? '' : 's'}` : 'correction'} —{' '}
                      {s ? <Link to={`/staff/students/${s.id}`}>{fullName(s)}</Link> : 'unknown student'}
                    </div>
                    <div className="meta">
                      {formatTimestamp(p.createdAt)} · by {p.createdByName} · paid until {formatDate(p.periodEnd)}
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
