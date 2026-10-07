import { Link, useParams } from 'react-router-dom';
import { collection, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useCollection, useDocument } from '../../lib/useFirestore.js';
import { formatMoney, fullName } from '../../lib/billing.js';
import { ageFrom } from '../../lib/dates.js';
import { Empty, ErrorAlert, initials, Spinner, StatusBadge, SubscriptionHero } from '../../components/ui.jsx';
import { AttendanceCalendar, ChildDetails, PaymentsTable, sortNewestFirst } from '../../components/StudentWidgets.jsx';

export default function ChildDetail() {
  const { studentId } = useParams();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const { data: student, loading, error } = useDocument(() => doc(db, 'students', studentId), [studentId]);
  // Parents may only query their own records, so filter by parent first.
  const payments = useCollection(() => query(collection(db, 'payments'), where('parentUid', '==', user.uid)), [user.uid]);
  const attendance = useCollection(() => query(collection(db, 'attendance'), where('parentUid', '==', user.uid)), [user.uid]);

  if (loading) return <Spinner />;
  if (error || !student) {
    return (
      <div className="card">
        <Empty code="404" title={t('child.notFound')}>
          <p>{t('child.notFoundText')}</p>
          <Link to="/family">{t('child.backFamily')}</Link>
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
        {t('child.back')}
      </Link>
      <div className="page-head">
        <div className="row">
          <div className="avatar lg">{initials(student.firstName, student.lastName)}</div>
          <div>
            <h1 style={{ marginBottom: 6 }}>{fullName(student)}</h1>
            <div className="row">
              <StatusBadge student={student} soonDays={settings.expiringSoonDays} />
              {age !== null && <span className="muted small mono">{t('common.years', { n: age })}</span>}
            </div>
          </div>
        </div>
        <Link to={`/family/${studentId}/edit`} className="btn">
          {t('child.edit')}
        </Link>
      </div>

      <SubscriptionHero student={student} soonDays={settings.expiringSoonDays} />

      <div className="split section">
        <div className="stack stagger">
          <div className="card">
            <div className="card-title">
              <h2>{t('child.payments')}</h2>
              <span className="muted small">{t('child.totalPaid', { amount: formatMoney(student.totalPaidCents, settings.currency) })}</span>
            </div>
            <ErrorAlert error={payments.error} />
            {payments.loading ? <Spinner /> : <PaymentsTable payments={myPayments} currency={settings.currency} />}
          </div>
          <div className="card">
            <div className="card-title">
              <h2>{t('child.attendance')}</h2>
            </div>
            <ErrorAlert error={attendance.error} />
            <AttendanceCalendar records={myAttendance} clubDays={settings.clubDays} />
          </div>
        </div>
        <div className="card">
          <div className="card-title">
            <h2>{t('child.details')}</h2>
          </div>
          <ChildDetails student={student} />
        </div>
      </div>
    </>
  );
}
