import { Link } from 'react-router-dom';
import { formatTimestamp } from '../lib/dates.js';
import { RoleBadge } from './ui.jsx';

export const LOG_TYPES = {
  student_created: { tag: 'NEW', tone: 'new', label: 'Registered' },
  student_updated: { tag: 'EDIT', tone: 'edit', label: 'Details edited' },
  status_changed: { tag: 'ARC', tone: 'arc', label: 'Archived / re-activated' },
  payment: { tag: 'PAY', tone: 'pay', label: 'Payment' },
  correction: { tag: 'FIX', tone: 'fix', label: 'Correction' },
  attendance: { tag: 'ATT', tone: 'att', label: 'Attendance' },
  attendance_cleared: { tag: 'CLR', tone: 'clr', label: 'Attendance cleared' },
  role_changed: { tag: 'ROLE', tone: 'role', label: 'Role change' },
  settings_updated: { tag: 'CFG', tone: 'cfg', label: 'Settings' },
};

export default function LogList({ logs, studentNames }) {
  return (
    <ul className="timeline">
      {logs.map((log) => {
        const type = LOG_TYPES[log.type] || { tag: 'LOG', tone: 'log', label: log.type };
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
                <span>{log.actorName || 'Unknown'}</span>
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
