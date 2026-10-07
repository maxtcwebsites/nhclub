import { useEffect, useState } from 'react';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { countResetData, RESET_SCOPES, resetClubData } from '../../lib/api.js';
import { friendlyError } from '../../lib/errors.js';
import { ErrorAlert, Modal } from '../../components/ui.jsx';

// Super admin only: wipe test data before the club goes live.
export default function ResetData({ onDone }) {
  const { t } = useI18n();
  const [scope, setScope] = useState(null);
  return (
    <div className="card form danger-zone">
      <div className="card-title">
        <h2>{t('reset.title')}</h2>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {t('reset.intro')}
      </p>
      {RESET_SCOPES.map((key) => (
        <div key={key} className="danger-row">
          <div>
            <strong>{t(`reset.${key}.label`)}</strong>
            <span className="muted small" style={{ display: 'block' }}>
              {t(`reset.${key}.help`)}
            </span>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => setScope(key)}>
            {t(`reset.${key}.label`)}
          </button>
        </div>
      ))}
      {scope && <ResetModal scope={scope} onClose={() => setScope(null)} onDone={onDone} />}
    </div>
  );
}

function ResetModal({ scope, onClose, onDone }) {
  const { actor } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const [counts, setCounts] = useState(null);
  const [typed, setTyped] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const everything = scope === 'everything';
  const word = t('reset.word');
  const busy = progress !== null;

  useEffect(() => {
    countResetData(db)
      .then(setCounts)
      .catch((err) => setError(friendlyError(err)));
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (typed.trim().toUpperCase() !== word || busy) return;
    setError('');
    setProgress({ done: 0, total: 0 });
    try {
      await resetClubData(db, actor, scope, (done, total) => setProgress({ done, total }));
      toast(t(`reset.${scope}.done`));
      onDone?.(scope);
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setProgress(null);
    }
  }

  return (
    <Modal title={t(`reset.${scope}.confirm`)} onClose={busy ? () => {} : onClose}>
      <form className="form" onSubmit={submit}>
        <div>
          <div className="reset-head">{t('reset.willDelete')}</div>
          {counts ? (
            <ul className="reset-list">
              <li>{t('reset.payments', { n: counts.payments })}</li>
              <li>{t('reset.attendance', { n: counts.attendance })}</li>
              <li>{t('reset.logs', { n: counts.logs })}</li>
              {everything ? (
                <>
                  <li>{t('reset.students', { n: counts.students })}</li>
                  <li>{t('reset.users', { n: Math.max(0, counts.users - 1) })}</li>
                  <li>{t('reset.settings')}</li>
                </>
              ) : (
                <li>{t('reset.studentsReset', { n: counts.students })}</li>
              )}
            </ul>
          ) : (
            !error && <p className="muted small">{t('reset.counting')}</p>
          )}
        </div>
        {everything && <p className="muted small" style={{ margin: 0 }}>{t('reset.authNote')}</p>}
        <div className="alert alert-error">{t('reset.undo')}</div>
        <ErrorAlert error={error} />
        <div className="field">
          <label htmlFor="reset-confirm">{t('reset.type', { word })}</label>
          <input
            id="reset-confirm"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={typed}
            disabled={busy}
            onChange={(e) => setTyped(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-danger-solid" disabled={busy || typed.trim().toUpperCase() !== word}>
            {busy ? t('reset.progress', progress) : t(`reset.${scope}.label`)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
