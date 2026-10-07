import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useCollection } from '../../lib/useFirestore.js';
import { ATTENDANCE_LABELS, clearAttendance, setAttendance } from '../../lib/api.js';
import { ABSENCE_POLICIES, fullName, subscriptionInfo } from '../../lib/billing.js';
import { formatDate, monthEnd, monthStart, todayStr, weekdayOf } from '../../lib/dates.js';
import { friendlyError } from '../../lib/errors.js';
import { Empty, ErrorAlert, Spinner, StatusBadge } from '../../components/ui.jsx';
import MonthCalendar from '../../components/MonthCalendar.jsx';

export default function AttendancePage() {
  const { settings } = useSettings();
  const { actor } = useAuth();
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
    toast(failed ? `${failed} could not be saved — please retry.` : 'Everyone marked present', failed ? 'error' : 'success');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Attendance</div>
          <h1>Attendance calendar</h1>
          <p className="muted">Pick a day, then mark each child. Notes are visible to the child’s parent.</p>
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: '1.25rem' }}>
        Absence policy: <strong>{ABSENCE_POLICIES[settings.absencePolicy]?.label}</strong>.{' '}
        <span style={{ fontWeight: 600 }}>{ABSENCE_POLICIES[settings.absencePolicy]?.help}</span>
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
                label: c ? `${c.present} present, ${c.absent} absent, ${c.excused} excused` : undefined,
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
            <span>
              <i className="c-present" /> Present
            </span>
            <span>
              <i className="c-absent" /> Absent
            </span>
            <span>
              <i className="c-excused" /> Excused
            </span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            <div>
              <h2>{formatDate(selected, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <div className="small muted">
                {tally.present} present · {tally.absent} absent · {tally.excused} excused · {unmarked.length} not marked
              </div>
            </div>
            {unmarked.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(bulk)} onClick={markAllPresent}>
                {bulk ? `Saving ${bulk.done}/${bulk.total}…` : `Mark ${unmarked.length} present`}
              </button>
            )}
          </div>
          {!isClubDay && <div className="alert alert-warn small" style={{ marginBottom: '0.75rem' }}>This is not a regular club day.</div>}
          {selected > today && (
            <div className="alert alert-info small" style={{ marginBottom: '0.75rem' }}>
              This day is in the future — useful for planned absences.
            </div>
          )}
          {students.loading ? (
            <Spinner />
          ) : roster.length === 0 ? (
            <Empty code="NO STUDENTS" title="No enrolled students yet" />
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
          {(info.state === 'expired' || info.state === 'unpaid') && <span className="muted">needs payment</span>}
          {record?.credited && status && status !== 'present' && <span className="muted">+1 day</span>}
          {pending > 0 && <span className="muted">saving…</span>}
        </div>
      </div>
      <div className="seg" role="radiogroup" aria-label={`Attendance for ${fullName(student)}`}>
        {Object.entries(ATTENDANCE_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={status === key}
            className={status === key ? `on-${key}` : ''}
            onClick={() => save(key)}
            title={label}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder={status ? 'Add a note…' : 'Pick a status, then add a note'}
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
        aria-label={`Note for ${fullName(student)}`}
      />
      <button
        type="button"
        className="btn btn-sm btn-square"
        disabled={!record && !status}
        onClick={clear}
        title="Clear this day"
        aria-label={`Clear attendance for ${fullName(student)}`}
      >
        &times;
      </button>
    </div>
  );
}
