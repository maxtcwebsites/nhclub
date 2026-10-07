import { useMemo, useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useCollection } from '../../lib/useFirestore.js';
import { fullName } from '../../lib/billing.js';
import { ErrorAlert, Spinner } from '../../components/ui.jsx';
import LogList, { LOG_TYPES } from '../../components/LogList.jsx';

const PAGE = 100;

export default function ActivityPage() {
  const [max, setMax] = useState(PAGE);
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const logs = useCollection(() => query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(max)), [max]);
  const students = useCollection(() => collection(db, 'students'), []);
  const names = useMemo(() => Object.fromEntries(students.data.map((s) => [s.id, fullName(s)])), [students.data]);

  const term = search.trim().toLowerCase();
  const visible = logs.data.filter(
    (l) =>
      (type === 'all' || l.type === type) &&
      (!term || `${l.message} ${l.actorName} ${names[l.studentId] ?? ''}`.toLowerCase().includes(term)),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Audit trail</div>
          <h1>Activity log</h1>
          <p className="muted">Every registration, payment, correction, attendance mark and permission change. Entries cannot be edited or deleted.</p>
        </div>
      </div>
      <div className="toolbar">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type" style={{ maxWidth: 260 }}>
          <option value="all">All activity</option>
          {Object.entries(LOG_TYPES).map(([key, t]) => (
            <option key={key} value={key}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search the log" />
      </div>
      <div className="card">
        <ErrorAlert error={logs.error} />
        {logs.loading && logs.data.length === 0 ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing to show.
          </p>
        ) : (
          <LogList logs={visible} studentNames={names} />
        )}
        {logs.data.length >= max && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setMax((m) => m + PAGE)}>
              Load older entries
            </button>
          </div>
        )}
      </div>
    </>
  );
}
