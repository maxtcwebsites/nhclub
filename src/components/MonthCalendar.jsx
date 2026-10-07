import { addMonths, formatDate, monthGrid, todayStr, weekdayNames } from '../lib/dates.js';
import { useI18n } from '../i18n/I18nContext.jsx';

// Generic month grid. `renderDay(date)` returns { className, content, onClick }.
export default function MonthCalendar({ month, onMonthChange, renderDay, small = false, selected }) {
  const { t } = useI18n();
  const today = todayStr();
  const dow = weekdayNames(small ? 'narrow' : 'short');
  const weeks = monthGrid(month);
  return (
    <div className={small ? 'cal-small' : undefined}>
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => onMonthChange(addMonths(month, -1))} aria-label={t('calendar.prev')}>
          &lt;
        </button>
        <h3>{formatDate(month, { month: 'long', year: 'numeric' })}</h3>
        <button type="button" className="cal-nav" onClick={() => onMonthChange(addMonths(month, 1))} aria-label={t('calendar.next')}>
          &gt;
        </button>
      </div>
      <div className="calendar" role="grid">
        {dow.map((d, i) => (
          <div key={i} className="cal-dow" role="columnheader">
            {d}
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
