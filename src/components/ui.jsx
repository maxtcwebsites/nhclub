import { useEffect, useId, useRef } from 'react';
import { subscriptionInfo } from '../lib/billing.js';
import { formatDate, todayStr } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="center-page" role="status">
      <div>
        <div className="spinner" />
        <p className="muted small" style={{ marginTop: '0.75rem' }}>
          {label}
        </p>
      </div>
    </div>
  );
}

export function ErrorAlert({ error }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      {typeof error === 'string' ? error : friendlyError(error)}
    </div>
  );
}

export function Empty({ icon = '🌤️', title, children }) {
  return (
    <div className="empty">
      <div className="icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Field({ label, required, hint, error, children, id }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const child = typeof children === 'function' ? children(fieldId) : children;
  return (
    <div className="field">
      <label htmlFor={fieldId}>
        {label} {required && <span className="req">*</span>}
      </label>
      {child}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}

export function StatusBadge({ student, soonDays }) {
  const info = subscriptionInfo(student, todayStr(), soonDays);
  const text = {
    active: 'Paid',
    expiring: 'Expiring soon',
    expired: 'Expired',
    unpaid: 'Not paid yet',
    archived: 'Archived',
  }[info.state];
  return <span className={`badge badge-${info.state}`}>{text}</span>;
}

export function RoleBadge({ role }) {
  const text = { admin: 'Super admin', teacher: 'Teacher', parent: 'Parent' }[role] || role;
  return <span className={`badge plain badge-${role}`}>{text}</span>;
}

export function SubscriptionHero({ student, soonDays }) {
  const info = subscriptionInfo(student, todayStr(), soonDays);
  const headline = {
    active: 'Subscription active',
    expiring: 'Subscription ending soon',
    expired: 'Subscription expired',
    unpaid: 'No payment recorded yet',
    archived: 'No longer enrolled',
  }[info.state];
  return (
    <div className={`status-hero ${info.state}`}>
      <div>
        <div className="small" style={{ fontWeight: 800, opacity: 0.8 }}>
          {headline}
        </div>
        <div className="big">
          {info.expiry ? `Paid until ${formatDate(info.expiry)}` : 'Waiting for first payment'}
        </div>
        {info.expiry && <div style={{ fontWeight: 700 }}>{info.label}</div>}
      </div>
      {student.creditDays > 0 && (
        <div className="small" style={{ fontWeight: 700 }}>
          Includes {student.creditDays} extra day{student.creditDays === 1 ? '' : 's'} for absences
        </div>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const first = ref.current?.querySelector('input, select, textarea, button:not(.modal-close)');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={wide ? { maxWidth: 720 } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function initials(first, last) {
  return `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase();
}
