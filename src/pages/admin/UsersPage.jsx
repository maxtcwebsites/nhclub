import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { setUserRole } from '../../lib/api.js';
import { formatTimestamp } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { SUPER_ADMIN_EMAIL } from '../../config.js';
import { ErrorAlert, Modal, RoleBadge, Spinner } from '../../components/ui.jsx';

export default function UsersPage() {
  const { actor } = useAuth();
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
      toast(confirm.role === 'teacher' ? `${confirm.user.displayName} is now a teacher` : `${confirm.user.displayName} is now a parent account`);
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
          <div className="eyebrow">Super admin</div>
          <h1>Users &amp; teachers</h1>
          <p className="muted">
            Everyone signs up as a parent. Promote a parent account to <strong>teacher</strong> to give it access to all students,
            payments, attendance and logs.
          </p>
        </div>
      </div>
      <div className="toolbar">
        <div className="chips">
          {[
            ['all', 'Everyone'],
            ['teacher', 'Teachers'],
            ['parent', 'Parents'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={`chip ${role === key ? 'on' : ''}`} onClick={() => setRole(key)}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Search name, email, phone…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
      </div>
      <ErrorAlert error={users.error} />
      {users.loading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table className="stack-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Role</th>
                <th>Children</th>
                <th>Joined</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td className="primary-cell">
                    <strong>{u.displayName}</strong>
                  </td>
                  <td data-label="Contact">
                    {u.email}
                    {u.phone && <span className="sub">{u.phone}</span>}
                  </td>
                  <td data-label="Role">
                    <RoleBadge role={u.shownRole} />
                  </td>
                  <td data-label="Children">{kids[u.id] || 0}</td>
                  <td className="nowrap small" data-label="Joined">
                    {formatTimestamp(u.createdAt)}
                  </td>
                  <td className="right actions-cell">
                    {u.shownRole === 'admin' ? (
                      <span className="muted small">Owner</span>
                    ) : u.role === 'teacher' ? (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm({ user: u, role: 'parent' })}>
                        Remove teacher
                      </button>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirm({ user: u, role: 'teacher' })}>
                        Make teacher
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
        <Modal title={confirm.role === 'teacher' ? 'Make this account a teacher?' : 'Remove teacher access?'} onClose={() => setConfirm(null)}>
          <p>
            <strong>{confirm.user.displayName}</strong> ({confirm.user.email})
          </p>
          <p className="muted">
            {confirm.role === 'teacher'
              ? 'Teachers can see every child and parent, record payments and corrections, take attendance and read the activity log. Only promote people you trust.'
              : 'They will immediately lose access to the staff pages and go back to a normal parent account.'}
          </p>
          <ErrorAlert error={error} />
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button type="button" className={confirm.role === 'teacher' ? 'btn btn-primary' : 'btn btn-danger'} disabled={busy} onClick={apply}>
              {busy ? 'Saving…' : confirm.role === 'teacher' ? 'Make teacher' : 'Remove access'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
