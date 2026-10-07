import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { ATTENDANCE_STATUSES, clearAttendance, setAttendance } from '../../lib/api.js';
import { fullName, subscriptionInfo } from '../../lib/billing.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { formatDate, monthEnd, monthStart, todayStr, weekdayOf } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { Empty, ErrorAlert, Spinner, StatusBadge } from '../../components/ui.jsx';
import MonthCalendar from '../../components/MonthCalendar.jsx';

export default function AttendancePage() {
  const { settings } = useSettings();
  const { actor } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const today = todayStr();
  const [month, setMonth] = useState(monthStart(today));
  const [selected, setSelected] = useState(today);
  const [bulk, setBulk] = useState(null);

  const students = useCollection(() => collection(db, 'students'), []);
  const records = useCollection(
    () => query(collection(db, 'attendance'), where('date', '>=', month), where('date', '<=', monthEnd(month))),
    [month],
  );

  useEffect(() => {
    if (selected.slice(0, 7) !== month.slice(0, 7)) {
      setSelected(today.slice(0, 7) === month.slice(0, 7) ? today : month);
    }
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const perDay = useMemo(() => {
    const map = {};
    records.data.forEach((r) => {
      map[r.date] ??= { present: 0, absent: 0, excused: 0 };
      map[r.date][r.status] += 1;
    });
    return map;
  }, [records.data]);

  const dayRecords = useMemo(
    () => Object.fromEntries(records.data.filter((r) => r.date === selected).map((r) => [r.studentId, r])),
    [records.data, selected],
  );

  const roster = students.data
    .filter((s) => s.status === 'active' || dayRecords[s.id])
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const unmarked = roster.filter((s) => !dayRecords[s.id] && s.status === 'active');
  const isClubDay = settings.clubDays.includes(weekdayOf(selected));
  const tally = perDay[selected] || { present: 0, absent: 0, excused: 0 };

  async function markAllPresent() {
    setBulk({ done: 0, total: unmarked.length });
    let failed = 0;
    for (const [i, s] of unmarked.entries()) {
      try {
        await setAttendance(db, actor, s.id, { date: selected, status: 'present', note: '', policy: settings.absencePolicy });
      } catch {
        failed += 1;
      }
      setBulk({ done: i + 1, total: unmarked.length });
    }
    setBulk(null);
    toast(failed ? t('attendance.bulkFailed', { n: failed }) : t('attendance.bulkDone'), failed ? 'error' : 'success');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{t('attendance.eyebrow')}</div>
          <h1>{t('attendance.title')}</h1>
          <p className="muted">{t('attendance.subtitle')}</p>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 20 }}>
        {t('attendance.policy')} <strong>{t(`policy.${settings.absencePolicy}.label`)}</strong>.{' '}
        {t(`policy.${settings.absencePolicy}.help`)}
      </div>

      <ErrorAlert error={students.error || records.error} />

      <div className="split attendance-layout">
        <div className="card">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            renderDay={(date) => {
              const c = perDay[date];
              const off = !settings.clubDays.includes(weekdayOf(date));
              return {
                className: off ? 'off' : '',
                onClick: () => setSelected(date),
                label: c ? t('attendance.dayLabel', { p: c.present, a: c.absent, e: c.excused }) : undefined,
                content: c ? (
                  <span className="counts">
                    {c.present > 0 && <span className="c-present">{c.present}</span>}
                    {c.absent > 0 && <span className="c-absent">{c.absent}</span>}
                    {c.excused > 0 && <span className="c-excused">{c.excused}</span>}
                  </span>
                ) : null,
              };
            }}
          />
          <div className="legend">
            {ATTENDANCE_STATUSES.map((k) => (
              <span key={k}>
                <i className={`c-${k}`} /> {t(`att.${k}`)}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <div>
              <h2>{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <div className="small muted">
                {t('attendance.tally', { p: tally.present, a: tally.absent, e: tally.excused, u: unmarked.length })}
              </div>
            </div>
            {unmarked.length > 0 && (
              <button type="button" className="btn btn-sm" disabled={Boolean(bulk)} onClick={markAllPresent}>
                {bulk ? t('attendance.savingBulk', { done: bulk.done, total: bulk.total }) : t('attendance.markAll', { n: unmarked.length })}
              </button>
            )}
          </div>
          {!isClubDay && (
            <div className="alert alert-warn small" style={{ marginBottom: 12 }}>
              {t('attendance.notClubDay')}
            </div>
          )}
          {selected > today && (
            <div className="alert alert-info small" style={{ marginBottom: 12 }}>
              {t('attendance.future')}
            </div>
          )}
          {students.loading ? (
            <Spinner />
          ) : roster.length === 0 ? (
            <Empty code={t('attendance.emptyCode')} title={t('attendance.noStudents')} />
          ) : (
            <div className="roster">
              {roster.map((s) => (
                <RosterRow key={`${s.id}_${selected}`} student={s} record={dayRecords[s.id]} date={selected} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function RosterRow({ student, record, date }) {
  const { actor } = useAuth();
  const { settings } = useSettings();
  const { t } = useI18n();
  const toast = useToast();
  const [note, setNote] = useState(record?.note ?? '');
  const [focused, setFocused] = useState(false);
  // Status the teacher just picked, shown immediately while the save runs.
  const [picked, setPicked] = useState(null);
  const [pending, setPending] = useState(0);
  // Saves for one row run one after another, so a quick "status, then note"
  // always ends with both saved, in that order.
  const queue = useRef(Promise.resolve());

  // Keep the note in sync with changes made by other teachers.
  useEffect(() => {
    if (!focused) setNote(record?.note ?? '');
  }, [record?.note]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pending > 0 || !picked) return;
    if (picked === 'cleared' ? !record : record?.status === picked) setPicked(null);
  }, [record, picked, pending]);

  const status = picked === 'cleared' ? null : picked || record?.status || null;
  const info = subscriptionInfo(student, todayStr(), settings.expiringSoonDays);

  function enqueue(task) {
    setPending((n) => n + 1);
    queue.current = queue.current
      .then(task)
      .catch((err) => {
        setPicked(null);
        toast(`${student.firstName}: ${friendlyError(err)}`, 'error');
      })
      .finally(() => setPending((n) => n - 1));
  }

  function save(nextStatus, nextNote = note) {
    setPicked(nextStatus);
    enqueue(() =>
      setAttendance(db, actor, student.id, { date, status: nextStatus, note: nextNote, policy: settings.absencePolicy }),
    );
  }

  function clear() {
    setPicked('cleared');
    setNote('');
    enqueue(() => clearAttendance(db, actor, student.id, date));
  }

  return (
    <div className={`roster-row ${status ? `marked-${status}` : ''}`} aria-busy={pending > 0}>
      <div className="who">
        <strong>
          <Link to={`/staff/students/${student.id}`}>{fullName(student)}</Link>
        </strong>
        <div className="meta-line">
          <StatusBadge student={student} soonDays={settings.expiringSoonDays} />
          {(info.state === 'expired' || info.state === 'unpaid') && <span className="muted">{t('attendance.needsPayment')}</span>}
          {record?.credited && status && status !== 'present' && <span className="muted">{t('attendance.plusDay')}</span>}
          {pending > 0 && <span className="muted">{t('attendance.saving')}</span>}
        </div>
      </div>
      <div className="seg" role="radiogroup" aria-label={t('attendance.groupLabel', { name: fullName(student) })}>
        {ATTENDANCE_STATUSES.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={status === key}
            className={status === key ? `on-${key}` : ''}
            onClick={() => save(key)}
            title={t(`att.${key}`)}
          >
            {t(`att.${key}`)}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder={status ? t('attendance.addNote') : t('attendance.pickFirst')}
        maxLength={300}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (status && note.trim() !== (record?.note ?? '')) save(status, note);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={t('attendance.noteFor', { name: fullName(student) })}
      />
      <button
        type="button"
        className="btn btn-sm btn-square"
        disabled={!record && !status}
        onClick={clear}
        title={t('attendance.clearDay')}
        aria-label={t('attendance.clearFor', { name: fullName(student) })}
      >
        &times;
      </button>
    </div>
  );
}
