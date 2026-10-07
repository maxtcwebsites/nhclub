import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useCollection, useDocument } from '../../lib/useFirestore.js';
import { ATTENDANCE_LABELS, clearAttendance, setAttendance, setStudentStatus } from '../../lib/api.js';
import { formatMoney, fullName } from '../../lib/billing.js';
import { ageFrom, formatDate, monthStart, todayStr, weekdayOf } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { Empty, ErrorAlert, initials, Modal, Spinner, StatusBadge, SubscriptionHero } from '../../components/ui.jsx';
import { ChildDetails, PaymentsTable, sortNewestFirst } from '../../components/StudentWidgets.jsx';
import { CorrectionModal, PaymentModal } from '../../components/PaymentModals.jsx';
import MonthCalendar from '../../components/MonthCalendar.jsx';
import LogList from '../../components/LogList.jsx';

export default function StudentDetail() {
  const { studentId } = useParams();
  const { settings } = useSettings();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);

  const { data: student, loading, error } = useDocument(() => doc(db, 'students', studentId), [studentId]);
  const parent = useDocument(() => (student ? doc(db, 'users', student.parentUid) : null), [student?.parentUid]);
  const payments = useCollection(() => query(collection(db, 'payments'), where('studentId', '==', studentId)), [studentId]);
  const attendance = useCollection(() => query(collection(db, 'attendance'), where('studentId', '==', studentId)), [studentId]);
  const logs = useCollection(() => query(collection(db, 'logs'), where('studentId', '==', studentId)), [studentId]);

  if (loading) return <Spinner />;
  if (error || !student) {
    return (
      <div className="card">
        <Empty icon="🔍" title="Student not found">
          <Link to="/staff">Back to the dashboard</Link>
        </Empty>
      </div>
    );
  }

  const age = ageFrom(student.dateOfBirth);
  const archived = student.status === 'archived';
  const counts = { present: 0, absent: 0, excused: 0 };
  attendance.data.forEach((a) => {
    counts[a.status] += 1;
  });
  const tabs = [
    ['overview', 'Overview'],
    ['payments', `Payments (${payments.data.length})`],
    ['attendance', 'Attendance'],
    ['log', `Activity log (${logs.data.length})`],
  ];

  return (
    <>
      <Link to="/staff" className="back-link">
        ← All students
      </Link>
      <div className="page-head">
        <div className="row">
          <div className="avatar lg">{initials(student.firstName, student.lastName)}</div>
          <div>
            <h1 style={{ marginBottom: '0.2rem' }}>{fullName(student)}</h1>
            <div className="row">
              <StatusBadge student={student} soonDays={settings.expiringSoonDays} />
              {age !== null && <span className="muted small">{age} years old</span>}
              {student.grade && <span className="muted small">· {student.grade}</span>}
            </div>
          </div>
        </div>
        <div className="row">
          {!archived && (
            <button type="button" className="btn btn-primary" onClick={() => setModal('payment')}>
              + Record payment
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={() => setModal('correction')}>
            Correction
          </button>
          <Link to={`/staff/students/${studentId}/edit`} className="btn btn-ghost">
            Edit
          </Link>
          <button type="button" className={archived ? 'btn btn-secondary' : 'btn btn-danger'} onClick={() => setModal('status')}>
            {archived ? 'Re-activate' : 'Archive'}
          </button>
        </div>
      </div>

      {student.allergies && (
        <div className="alert alert-warn" style={{ marginBottom: '1rem' }}>
          ⚠️ Allergies: {student.allergies}
        </div>
      )}

      <SubscriptionHero student={student} soonDays={settings.expiringSoonDays} />

      <div className="grid grid-4" style={{ margin: '1rem 0 1.5rem' }}>
        <div className="card stat">
          <div className="label">Total paid</div>
          <div className="value" style={{ fontSize: '1.5rem' }}>
            {formatMoney(student.totalPaidCents, settings.currency)}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Months paid</div>
          <div className="value" style={{ fontSize: '1.5rem' }}>
            {student.monthsPaid}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Days present</div>
          <div className="value" style={{ fontSize: '1.5rem' }}>
            {counts.present}
          </div>
        </div>
        <div className="card stat">
          <div className="label">Absent / excused</div>
          <div className="value" style={{ fontSize: '1.5rem' }}>
            {counts.absent} / {counts.excused}
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`tab ${tab === key ? 'on' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">
              <h2>Child &amp; family</h2>
            </div>
            <ChildDetails student={student} parent={parent.data} />
          </div>
          <div className="card">
            <div className="card-title">
              <h2>Recent activity</h2>
              <button type="button" className="link small" onClick={() => setTab('log')}>
                See all
              </button>
            </div>
            <LogList logs={sortNewestFirst(logs.data).slice(0, 6)} />
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card">
          <ErrorAlert error={payments.error} />
          <PaymentsTable payments={sortNewestFirst(payments.data)} currency={settings.currency} staff />
        </div>
      )}

      {tab === 'attendance' && <StudentAttendance student={student} records={attendance.data} />}

      {tab === 'log' && (
        <div className="card">
          <p className="small muted">Every change to this student, who made it and when. Entries can never be edited or deleted.</p>
          <ErrorAlert error={logs.error} />
          {logs.data.length === 0 ? <p className="muted">No activity yet.</p> : <LogList logs={sortNewestFirst(logs.data)} />}
        </div>
      )}

      {modal === 'payment' && <PaymentModal student={student} onClose={() => setModal(null)} />}
      {modal === 'correction' && <CorrectionModal student={student} onClose={() => setModal(null)} />}
      {modal === 'status' && <StatusModal student={student} onClose={() => setModal(null)} />}
    </>
  );
}

function StatusModal({ student, onClose }) {
  const { actor } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const archiving = student.status !== 'archived';
  return (
    <Modal title={archiving ? `Archive ${student.firstName}?` : `Re-activate ${student.firstName}?`} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await setStudentStatus(db, actor, student, archiving ? 'archived' : 'active', reason.trim());
            toast(archiving ? 'Student archived' : 'Student re-activated');
            onClose();
          } catch (err) {
            setError(friendlyError(err));
            setBusy(false);
          }
        }}
      >
        <p className="muted" style={{ margin: 0 }}>
          {archiving
            ? 'Archived students are hidden from attendance and the main list. Their payments and history are kept.'
            : 'The student will show up in the main list and in attendance again.'}
        </p>
        <ErrorAlert error={error} />
        <div className="field">
          <label htmlFor="status-reason">Reason (optional)</label>
          <input id="status-reason" type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={archiving ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy}>
            {busy ? 'Saving…' : archiving ? 'Archive' : 'Re-activate'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StudentAttendance({ student, records }) {
  const { settings } = useSettings();
  const [month, setMonth] = useState(monthStart(todayStr()));
  const [day, setDay] = useState(null);
  const byDate = Object.fromEntries(records.map((r) => [r.date, r]));
  return (
    <div className="card">
      <p className="small muted">Click a day to mark or change attendance for {student.firstName}.</p>
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        renderDay={(date) => {
          const r = byDate[date];
          const off = !settings.clubDays.includes(weekdayOf(date));
          return {
            className: r ? r.status : off ? 'off' : '',
            label: r ? `${ATTENDANCE_LABELS[r.status]}${r.note ? ` — ${r.note}` : ''}` : undefined,
            content: r ? (
              <>
                <span className="tag">{ATTENDANCE_LABELS[r.status]}</span>
                {r.credited && <span className="tag">+1 day</span>}
              </>
            ) : null,
            onClick: () => setDay(date),
          };
        }}
      />
      {day && <AttendanceDayModal student={student} date={day} record={byDate[day]} onClose={() => setDay(null)} />}
    </div>
  );
}

function AttendanceDayModal({ student, date, record, onClose }) {
  const { actor } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const [status, setStatus] = useState(record?.status || 'present');
  const [note, setNote] = useState(record?.note || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      toast('Attendance saved');
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={formatDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => setAttendance(db, actor, student.id, { date, status, note, policy: settings.absencePolicy }));
        }}
      >
        <ErrorAlert error={error} />
        <div className="seg" role="radiogroup" aria-label="Attendance">
          {Object.entries(ATTENDANCE_LABELS).map(([key, label]) => (
            <button key={key} type="button" role="radio" aria-checked={status === key} className={status === key ? `on-${key}` : ''} onClick={() => setStatus(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="att-note">Note (visible to the parent)</label>
          <input id="att-note" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {record?.credited && <p className="small muted">This day added one free day to the subscription.</p>}
        <div className="modal-actions">
          {record && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => clearAttendance(db, actor, student.id, date))}>
              Clear
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
