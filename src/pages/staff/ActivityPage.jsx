import { useMemo, useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { fullName } from '../../lib/billing.js';
import { ErrorAlert, Spinner } from '../../components/ui.jsx';
import LogList, { LOG_TONES } from '../../components/LogList.jsx';

const PAGE = 100;

export default function ActivityPage() {
  const { t } = useI18n();
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
          <div className="eyebrow">{t('activity.eyebrow')}</div>
          <h1>{t('activity.title')}</h1>
          <p className="muted">{t('activity.subtitle')}</p>
        </div>
      </div>
      <div className="toolbar">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label={t('activity.filterLabel')}>
          <option value="all">{t('activity.all')}</option>
          {Object.keys(LOG_TONES).map((key) => (
            <option key={key} value={key}>
              {t(`logTypes.${key}.label`)}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder={t('activity.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('activity.searchLabel')}
        />
      </div>
      <div className="card">
        <ErrorAlert error={logs.error} />
        {logs.loading && logs.data.length === 0 ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            {t('activity.nothing')}
          </p>
        ) : (
          <LogList logs={visible} studentNames={names} />
        )}
        {logs.data.length >= max && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" className="btn" onClick={() => setMax((m) => m + PAGE)}>
              {t('activity.older')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
