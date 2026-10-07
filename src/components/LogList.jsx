import { Link } from 'react-router-dom';
import { formatTimestamp } from '../lib/dates.js';
import { RoleBadge } from './ui.jsx';

export const LOG_TYPES = {
  student_created: { icon: '🧒', label: 'Registered' },
  student_updated: { icon: '✏️', label: 'Details edited' },
  status_changed: { icon: '📦', label: 'Archived / re-activated' },
  payment: { icon: '💵', label: 'Payment' },
  correction: { icon: '🛠️', label: 'Correction' },
  attendance: { icon: '✅', label: 'Attendance' },
  attendance_cleared: { icon: '↩️', label: 'Attendance cleared' },
  role_changed: { icon: '🔑', label: 'Role change' },
  settings_updated: { icon: '⚙️', label: 'Settings' },
};

export default function LogList({ logs, studentNames }) {
  return (
    <ul className="timeline">
      {logs.map((log) => {
        const type = LOG_TYPES[log.type] || { icon: '•', label: log.type };
        return (
          <li key={log.id}>
            <span className="dot" title={type.label} aria-hidden="true">
              {type.icon}
            </span>
            <div>
              <div style={{ overflowWrap: 'anywhere' }}>{log.message}</div>
              <div className="meta row" style={{ gap: '0.4rem' }}>
                <span>{formatTimestamp(log.createdAt)}</span>
                <span>·</span>
                <span>{log.actorName || 'Unknown'}</span>
                <RoleBadge role={log.actorRole} />
                {studentNames && log.studentId && studentNames[log.studentId] && (
                  <>
                    <span>·</span>
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
