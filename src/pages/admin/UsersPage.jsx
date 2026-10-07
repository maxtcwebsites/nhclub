import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { setUserRole } from '../../lib/api.js';
import { formatTimestamp } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { SUPER_ADMIN_EMAIL } from '../../config.js';
import { ErrorAlert, Modal, RoleBadge, Spinner } from '../../components/ui.jsx';

export default function UsersPage() {
  const { actor } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const users = useCollection(() => collection(db, 'users'), []);
  const students = useCollection(() => collection(db, 'students'), []);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const kids = useMemo(() => {
    const map = {};
    students.data.forEach((s) => {
      map[s.parentUid] = (map[s.parentUid] || 0) + 1;
    });
    return map;
  }, [students.data]);

  const term = search.trim().toLowerCase();
  const list = users.data
    .map((u) => ({ ...u, shownRole: u.email?.toLowerCase() === SUPER_ADMIN_EMAIL ? 'admin' : u.role }))
    .filter((u) => (role === 'all' || u.shownRole === role) && (!term || `${u.displayName} ${u.email} ${u.phone}`.toLowerCase().includes(term)))
    .sort((a, b) => (a.shownRole === b.shownRole ? a.displayName.localeCompare(b.displayName) : a.shownRole < b.shownRole ? -1 : 1));

  async function apply() {
    setBusy(true);
    setError('');
    try {
      await setUserRole(db, actor, confirm.user, confirm.role);
      toast(t(confirm.role === 'teacher' ? 'users.madeTeacher' : 'users.madeParent', { name: confirm.user.displayName }));
      setConfirm(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('users.eyebrow')}</div>
          <h1>{t('users.title')}</h1>
          <p className="muted">
            {t('users.introBefore')}
            <strong>{t('users.introStrong')}</strong>
            {t('users.introAfter')}
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="chips">
          {[
            ['all', t('users.everyone')],
            ['teacher', t('users.teachers')],
            ['parent', t('users.parents')],
          ].map(([key, label]) => (
            <button key={key} type="button" className={`chip ${role === key ? 'on' : ''}`} onClick={() => setRole(key)}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" placeholder={t('users.search')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('users.searchLabel')} />
      </div>
      <ErrorAlert error={users.error} />
      {users.loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>{t('users.name')}</th>
                <th>{t('users.contact')}</th>
                <th>{t('users.role')}</th>
                <th>{t('users.children')}</th>
                <th>{t('users.joined')}</th>
                <th>
                  <span className="sr-only">{t('staff.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td className="primary-cell">
                    <strong>{u.displayName}</strong>
                  </td>
                  <td data-label={t('users.contact')}>
                    {u.email}
                    {u.phone && <span className="sub">{u.phone}</span>}
                  </td>
                  <td data-label={t('users.role')}>
                    <RoleBadge role={u.shownRole} />
                  </td>
                  <td data-label={t('users.children')}>{kids[u.id] || 0}</td>
                  <td className="nowrap small" data-label={t('users.joined')}>
                    {formatTimestamp(u.createdAt)}
                  </td>
                  <td className="right actions-cell">
                    {u.shownRole === 'admin' ? (
                      <span className="muted small">{t('users.owner')}</span>
                    ) : u.role === 'teacher' ? (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm({ user: u, role: 'parent' })}>
                        {t('users.removeTeacher')}
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm" onClick={() => setConfirm({ user: u, role: 'teacher' })}>
                        {t('users.makeTeacher')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <Modal title={confirm.role === 'teacher' ? t('users.confirmMake') : t('users.confirmRemove')} onClose={() => setConfirm(null)}>
          <p>
            <strong>{confirm.user.displayName}</strong> ({confirm.user.email})
          </p>
          <p className="muted">{confirm.role === 'teacher' ? t('users.makeText') : t('users.removeText')}</p>
          <ErrorAlert error={error} />
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className={confirm.role === 'teacher' ? 'btn btn-primary' : 'btn btn-danger'} disabled={busy} onClick={apply}>
              {busy ? t('common.saving') : confirm.role === 'teacher' ? t('users.makeTeacher') : t('users.removeBtn')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
