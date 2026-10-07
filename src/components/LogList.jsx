import { Link } from 'react-router-dom';
import { formatTimestamp } from '../lib/dates.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { RoleBadge } from './ui.jsx';

// Colour of each type's tag. Tag text and label are translated: logTypes.<type>
export const LOG_TONES = {
  student_created: 'new',
  student_updated: 'edit',
  status_changed: 'arc',
  payment: 'pay',
  correction: 'fix',
  attendance: 'att',
  attendance_cleared: 'clr',
  role_changed: 'role',
  settings_updated: 'cfg',
};

export default function LogList({ logs, studentNames }) {
  const { t } = useI18n();
  return (
    <ul className="timeline">
      {logs.map((log) => {
        const known = Boolean(LOG_TONES[log.type]);
        const type = known
          ? { tag: t(`logTypes.${log.type}.tag`), tone: LOG_TONES[log.type], label: t(`logTypes.${log.type}.label`) }
          : { tag: 'LOG', tone: 'log', label: log.type };
        return (
          <li key={log.id}>
            <span className={`log-tag t-${type.tone}`} title={type.label}>
              {type.tag}
            </span>
            <div>
              <div style={{ overflowWrap: 'anywhere' }}>{log.message}</div>
              <div className="meta row" style={{ gap: '8px' }}>
                <span>{formatTimestamp(log.createdAt)}</span>
                <span>/</span>
                <span>{log.actorName || t('logTypes.unknown')}</span>
                <RoleBadge role={log.actorRole} />
                {studentNames && log.studentId && studentNames[log.studentId] && (
                  <>
                    <span>/</span>
                    <Link to={`/staff/students/${log.studentId}`}>{studentNames[log.studentId]}</Link>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
