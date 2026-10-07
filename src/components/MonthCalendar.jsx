import { addMonths, formatDate, monthGrid, todayStr } from '../lib/dates.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Generic month grid. `renderDay(date)` returns { className, content, onClick }.
export default function MonthCalendar({ month, onMonthChange, renderDay, small = false, selected }) {
  const today = todayStr();
  const weeks = monthGrid(month);
  return (
    <div className={small ? 'cal-small' : undefined}>
      <div className="cal-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMonthChange(addMonths(month, -1))} aria-label="Previous month">
          ←
        </button>
        <h3>{formatDate(month, { month: 'long', year: 'numeric' })}</h3>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onMonthChange(addMonths(month, 1))} aria-label="Next month">
          →
        </button>
      </div>
      <div className="calendar" role="grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow" role="columnheader">
            {small ? d[0] : d}
          </div>
        ))}
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`e${i}`} className="cal-day cal-blank" />;
          const day = renderDay(date) || {};
          const classes = ['cal-day', day.className, date === today && 'today', date === selected && 'selected']
            .filter(Boolean)
            .join(' ');
          const body = (
            <>
              <span className="num">{Number(date.slice(8))}</span>
              {day.content}
            </>
          );
          return day.onClick ? (
            <button
              key={date}
              type="button"
              className={classes}
              onClick={day.onClick}
              aria-label={`${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}${day.label ? `: ${day.label}` : ''}`}
              aria-pressed={date === selected}
            >
              {body}
            </button>
          ) : (
            <div key={date} className={classes} title={day.label}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
