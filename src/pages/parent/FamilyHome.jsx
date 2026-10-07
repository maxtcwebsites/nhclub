import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { formatMoney, fullName, subscriptionInfo } from '../../lib/billing.js';
import { ageFrom, formatDate, todayStr } from '../../lib/dates.js';
import { Empty, ErrorAlert, initials, Spinner, StatusBadge } from '../../components/ui.jsx';

export default function FamilyHome() {
  const { user, profile, isStaff } = useAuth();
  const { settings } = useSettings();
  const { data, loading, error } = useCollection(
    () => query(collection(db, 'students'), where('parentUid', '==', user.uid)),
    [user.uid],
  );
  const children = [...data].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const today = todayStr();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">My family</div>
          <h1>Hi, {profile.displayName.split(' ')[0]}</h1>
          <p className="muted">Your children, their club subscription and attendance — updated live.</p>
        </div>
        <div className="row">
          {isStaff && (
            <Link to="/staff" className="btn btn-secondary">
              Staff dashboard
            </Link>
          )}
          <Link to="/family/add" className="btn btn-primary">
            + Add a child
          </Link>
        </div>
      </div>

      <ErrorAlert error={error} />

      {loading ? (
        <Spinner />
      ) : children.length === 0 ? (
        <div className="card">
          <Empty code="NO CHILDREN" title="No children registered yet">
            <p>Add your first child to enroll them in the club.</p>
            <Link to="/family/add" className="btn btn-primary">
              + Add a child
            </Link>
          </Empty>
        </div>
      ) : (
        <div className="cards stagger">
          {children.map((child) => {
            const info = subscriptionInfo(child, today, settings.expiringSoonDays);
            const age = ageFrom(child.dateOfBirth, today);
            return (
              <Link key={child.id} to={`/family/${child.id}`} className="card child-card">
                <div className="child-card-head">
                  <div className="avatar">{initials(child.firstName, child.lastName)}</div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{fullName(child)}</h3>
                    <div className="muted small mono">
                      {age !== null ? `${age} yrs` : ''}
                      {child.grade ? ` / ${child.grade}` : ''}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <StatusBadge student={child} soonDays={settings.expiringSoonDays} />
                  </div>
                </div>
                <div className="preview">
                  {info.expiry ? (
                    <>
                      Paid until <strong>{formatDate(info.expiry)}</strong>
                      <div className="small muted">{info.label}</div>
                    </>
                  ) : info.state === 'archived' ? (
                    'No longer enrolled'
                  ) : (
                    <>
                      <strong>Waiting for first payment</strong>
                      <div className="small muted">Pay at the club — it shows here once recorded.</div>
                    </>
                  )}
                </div>
                <span className="go">Payments &amp; attendance &gt;&gt;</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="alert alert-info section">
        Pay at the club. Staff record it and it shows up here right away.
        {settings.monthlyFeeCents > 0 && (
          <>
            {' '}
            Monthly fee: <strong>{formatMoney(settings.monthlyFeeCents, settings.currency)}</strong>.
          </>
        )}{' '}
        Paid but not showing? Contact the club with your child’s name and the payment date.
      </div>
    </>
  );
}
