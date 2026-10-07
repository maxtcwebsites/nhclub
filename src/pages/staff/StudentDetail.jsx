import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useCollection, useDocument } from '../../lib/useFirestore.js';
import { ATTENDANCE_STATUSES, clearAttendance, setAttendance, setStudentStatus } from '../../lib/api.js';
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
  const { t } = useI18n();
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
        <Empty code="404" title={t('student.notFound')}>
          <Link to="/staff">{t('student.backDash')}</Link>
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
    ['overview', t('student.overview')],
    ['payments', t('student.paymentsTab', { n: payments.data.length })],
    ['attendance', t('student.attendanceTab')],
    ['log', t('student.logTab', { n: logs.data.length })],
  ];

  return (
    <>
      <Link to="/staff" className="back-link">
        {t('student.back')}
      </Link>
      <div className="page-head">
        <div className="row">
          <div className="avatar lg">{initials(student.firstName, student.lastName)}</div>
          <div>
            <h1 style={{ marginBottom: 6 }}>{fullName(student)}</h1>
            <div className="row">
              <StatusBadge student={student} soonDays={settings.expiringSoonDays} />
              {age !== null && <span className="muted small mono">{t('common.years', { n: age })}</span>}
              {student.grade && <span className="muted small mono">/ {student.grade}</span>}
            </div>
          </div>
        </div>
        <div className="row">
          {!archived && (
            <button type="button" className="btn btn-primary" onClick={() => setModal('payment')}>
              {t('student.record')}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setModal('correction')}>
            {t('student.correction')}
          </button>
          <Link to={`/staff/students/${studentId}/edit`} className="btn">
            {t('common.edit')}
          </Link>
          <button type="button" className={archived ? 'btn' : 'btn btn-danger'} onClick={() => setModal('status')}>
            {archived ? t('student.reactivate') : t('student.archive')}
          </button>
        </div>
      </div>

      {student.allergies && (
        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          <strong className="mono">{t('student.allergies')}</strong> {student.allergies}
        </div>
      )}

      <SubscriptionHero student={student} soonDays={settings.expiringSoonDays} />

      <div className="grid grid-4 stagger" style={{ margin: '28px 0' }}>
        <div className="card stat">
          <div className="label">{t('student.totalPaid')}</div>
          <div className="value">{formatMoney(student.totalPaidCents, settings.currency)}</div>
        </div>
        <div className="card stat">
          <div className="label">{t('student.monthsPaid')}</div>
          <div className="value">{student.monthsPaid}</div>
        </div>
        <div className="card stat">
          <div className="label">{t('student.daysPresent')}</div>
          <div className="value">{counts.present}</div>
        </div>
        <div className="card stat">
          <div className="label">{t('student.absentExcused')}</div>
          <div className="value">
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
              <h2>{t('student.childFamily')}</h2>
            </div>
            <ChildDetails student={student} parent={parent.data} />
          </div>
          <div className="card">
            <div className="card-title">
              <h2>{t('student.recent')}</h2>
              <button type="button" className="link small" onClick={() => setTab('log')}>
                {t('student.seeAll')}
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
          <p className="small muted">{t('student.logIntro')}</p>
          <ErrorAlert error={logs.error} />
          {logs.data.length === 0 ? <p className="muted">{t('student.noActivity')}</p> : <LogList logs={sortNewestFirst(logs.data)} />}
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
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const archiving = student.status !== 'archived';
  return (
    <Modal
      title={archiving ? t('student.archiveTitle', { name: student.firstName }) : t('student.reactivateTitle', { name: student.firstName })}
      onClose={onClose}
    >
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await setStudentStatus(db, actor, student, archiving ? 'archived' : 'active', reason.trim());
            toast(archiving ? t('student.archived') : t('student.reactivated'));
            onClose();
          } catch (err) {
            setError(friendlyError(err));
            setBusy(false);
          }
        }}
      >
        <p className="muted" style={{ margin: 0 }}>
          {archiving ? t('student.archiveText') : t('student.reactivateText')}
        </p>
        <ErrorAlert error={error} />
        <div className="field">
          <label htmlFor="status-reason">{t('student.reason')}</label>
          <input id="status-reason" type="text" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className={archiving ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy}>
            {busy ? t('common.saving') : archiving ? t('student.archive') : t('student.reactivate')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StudentAttendance({ student, records }) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [month, setMonth] = useState(monthStart(todayStr()));
  const [day, setDay] = useState(null);
  const byDate = Object.fromEntries(records.map((r) => [r.date, r]));
  return (
    <div className="card">
      <p className="small muted">{t('student.attHint', { name: student.firstName })}</p>
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        renderDay={(date) => {
          const r = byDate[date];
          const off = !settings.clubDays.includes(weekdayOf(date));
          return {
            className: r ? r.status : off ? 'off' : '',
            label: r ? `${t(`att.${r.status}`)}${r.note ? ` — ${r.note}` : ''}` : undefined,
            content: r ? (
              <>
                <span className="tag">{t(`att.${r.status}`)}</span>
                {r.credited && <span className="tag">{t('student.plusDay')}</span>}
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
  const { t } = useI18n();
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
      toast(t('student.attSaved'));
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
        <div className="seg" role="radiogroup" aria-label={t('student.attendanceTab')}>
          {ATTENDANCE_STATUSES.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={status === key} className={status === key ? `on-${key}` : ''} onClick={() => setStatus(key)}>
              {t(`att.${key}`)}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="att-note">{t('student.noteLabel')}</label>
          <input id="att-note" type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {record?.credited && <p className="small muted">{t('student.creditedNote')}</p>}
        <div className="modal-actions">
          {record && (
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => clearAttendance(db, actor, student.id, date))}>
              {t('student.clear')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
