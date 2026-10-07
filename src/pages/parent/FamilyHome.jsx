import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { formatMoney, fullName, subscriptionInfo } from '../../lib/billing.js';
import { ageFrom, formatDate, todayStr } from '../../lib/dates.js';
import { Empty, ErrorAlert, initials, Spinner, StatusBadge } from '../../components/ui.jsx';

export default function FamilyHome() {
  const { user, profile, isStaff } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
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
          <div className="eyebrow">{t('family.eyebrow')}</div>
          <h1>{t('family.hi', { name: profile.displayName.split(' ')[0] })}</h1>
          <p className="muted">{t('family.subtitle')}</p>
        </div>
        <div className="row">
          {isStaff && (
            <Link to="/staff" className="btn">
              {t('family.staffDashboard')}
            </Link>
          )}
          <Link to="/family/add" className="btn btn-primary">
            {t('family.addChild')}
          </Link>
        </div>
      </div>

      <ErrorAlert error={error} />

      {loading ? (
        <Spinner />
      ) : children.length === 0 ? (
        <div className="card">
          <Empty code={t('family.emptyCode')} title={t('family.emptyTitle')}>
            <p>{t('family.emptyText')}</p>
            <Link to="/family/add" className="btn btn-primary">
              {t('family.addChild')}
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
                      {age !== null ? t('common.years', { n: age }) : ''}
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
                      {t('family.paidUntil')}
                      <strong>{formatDate(info.expiry)}</strong>
                      <div className="small muted">{info.label}</div>
                    </>
                  ) : info.state === 'archived' ? (
                    t('family.notEnrolled')
                  ) : (
                    <>
                      <strong>{t('family.waiting')}</strong>
                      <div className="small muted">{t('family.payHint')}</div>
                    </>
                  )}
                </div>
                <span className="go">{t('family.go')}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="alert alert-info section">
        {t('family.payNote')}
        {settings.monthlyFeeCents > 0 && (
          <>
            {' '}
            {t('family.fee')} <strong>{formatMoney(settings.monthlyFeeCents, settings.currency)}</strong>.
          </>
        )}{' '}
        {t('family.payMissing')}
      </div>
    </>
  );
}
