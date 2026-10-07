import { Link, useParams } from 'react-router-dom';
import { collection, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useCollection, useDocument } from '../../lib/useFirestore.js';
import { formatMoney, fullName } from '../../lib/billing.js';
import { ageFrom } from '../../lib/dates.js';
import { Empty, ErrorAlert, initials, Spinner, StatusBadge, SubscriptionHero } from '../../components/ui.jsx';
import { AttendanceCalendar, ChildDetails, PaymentsTable, sortNewestFirst } from '../../components/StudentWidgets.jsx';

export default function ChildDetail() {
  const { studentId } = useParams();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { data: student, loading, error } = useDocument(() => doc(db, 'students', studentId), [studentId]);
  // Parents may only query their own records, so filter by parent first.
  const payments = useCollection(() => query(collection(db, 'payments'), where('parentUid', '==', user.uid)), [user.uid]);
  const attendance = useCollection(() => query(collection(db, 'attendance'), where('parentUid', '==', user.uid)), [user.uid]);

  if (loading) return <Spinner />;
  if (error || !student) {
    return (
      <div className="card">
        <Empty icon="🔍" title="Child not found">
          <p>It may have been removed, or it belongs to another account.</p>
          <Link to="/family">Back to my family</Link>
        </Empty>
      </div>
    );
  }

  const myPayments = sortNewestFirst(payments.data.filter((p) => p.studentId === studentId));
  const myAttendance = attendance.data.filter((a) => a.studentId === studentId);
  const age = ageFrom(student.dateOfBirth);

  return (
    <>
      <Link to="/family" className="back-link">
        ← My family
      </Link>
      <div className="page-head">
        <div className="row">
          <div className="avatar lg">{initials(student.firstName, student.lastName)}</div>
          <div>
            <h1 style={{ marginBottom: '0.2rem' }}>{fullName(student)}</h1>
            <div className="row">
              <StatusBadge student={student} soonDays={settings.expiringSoonDays} />
              {age !== null && <span className="muted small">{age} years old</span>}
            </div>
          </div>
        </div>
        <Link to={`/family/${studentId}/edit`} className="btn btn-secondary">
          Edit details
        </Link>
      </div>

      <SubscriptionHero student={student} soonDays={settings.expiringSoonDays} />

      <div className="split section" style={{ marginTop: '1.25rem' }}>
        <div className="stack">
          <div className="card">
            <div className="card-title">
              <h2>Payment history</h2>
              <span className="muted small">Total paid: {formatMoney(student.totalPaidCents, settings.currency)}</span>
            </div>
            <ErrorAlert error={payments.error} />
            {payments.loading ? <Spinner /> : <PaymentsTable payments={myPayments} currency={settings.currency} />}
          </div>
          <div className="card">
            <div className="card-title">
              <h2>Attendance</h2>
            </div>
            <ErrorAlert error={attendance.error} />
            <AttendanceCalendar records={myAttendance} clubDays={settings.clubDays} />
          </div>
        </div>
        <div className="card">
          <div className="card-title">
            <h2>Details</h2>
          </div>
          <ChildDetails student={student} />
        </div>
      </div>
    </>
  );
}
