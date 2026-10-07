import { useEffect, useId, useRef } from 'react';
import { subscriptionInfo } from '../lib/billing.js';
import { formatDate, todayStr } from '../lib/dates.js';
import { friendlyError } from '../lib/errors.js';
import { CrestLoader } from './Crest.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

export function Spinner({ label }) {
  const { t } = useI18n();
  return <CrestLoader label={label || t('common.loading')} />;
}

export function ErrorAlert({ error }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      {typeof error === 'string' ? error : friendlyError(error)}
    </div>
  );
}

export function Empty({ code = 'EMPTY', title, children }) {
  return (
    <div className="empty">
      <div className="code" aria-hidden="true">
        [ {code} ]
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
  const { t } = useI18n();
  const info = subscriptionInfo(student, todayStr(), soonDays);
  return <span className={`badge badge-${info.state}`}>{t(`status.${info.state}`)}</span>;
}

export function RoleBadge({ role }) {
  const { t } = useI18n();
  return <span className={`badge plain badge-${role}`}>{['admin', 'teacher', 'parent'].includes(role) ? t(`roles.${role}`) : role}</span>;
}

export function SubscriptionHero({ student, soonDays }) {
  const { t } = useI18n();
  const info = subscriptionInfo(student, todayStr(), soonDays);
  return (
    <div className={`status-hero ${info.state}`}>
      <div>
        <div className="label">{t(`hero.${info.state}`)}</div>
        <div className="big">{info.expiry ? t('hero.paidUntil', { date: formatDate(info.expiry) }) : t('hero.waiting')}</div>
        {info.expiry && <div className="days">{info.label}</div>}
      </div>
      {student.creditDays > 0 && <div className="extra">{t('hero.credit', { n: student.creditDays })}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  const { t } = useI18n();
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
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
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
