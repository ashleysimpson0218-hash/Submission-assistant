import React, { useEffect, useMemo, useState } from "react";

const pad = (value) => String(value).padStart(2, "0");
const dateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const timeKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const rangeKey = (range) => `${range.start}-${range.end}`;

const TIME_OPTIONS = Array.from({ length: 65 }, (_, index) => {
  const minutes = 6 * 60 + index * 15;
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const value = `${pad(hours)}:${pad(minute)}`;
  return {
    value,
    label: new Date(2000, 0, 1, hours, minute).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
});

function sortedRanges(ranges = []) {
  return [...ranges].sort((a, b) => rangeKey(a).localeCompare(rangeKey(b)));
}

function initialAvailability(slots = []) {
  const timesByDate = {};
  slots.forEach((slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return;
    const day = dateKey(start);
    timesByDate[day] = sortedRanges([
      ...(timesByDate[day] || []),
      { start: timeKey(start), end: timeKey(end) },
    ]);
  });
  const dates = Object.keys(timesByDate).sort();
  const firstRanges = timesByDate[dates[0]] || [];
  const shared =
    dates.length > 0 &&
    dates.every(
      (day) =>
        JSON.stringify(timesByDate[day]) === JSON.stringify(firstRanges),
    );
  return {
    dates,
    timesByDate,
    applyToAll: slots.length === 0 || shared,
    sharedTimes: shared ? firstRanges : [],
  };
}

export function buildAvailabilitySlots({
  dates,
  applyToAll,
  sharedTimes,
  timesByDate,
}) {
  return dates
    .flatMap((day) => {
      const ranges = applyToAll ? sharedTimes : timesByDate[day] || [];
      return ranges.map((range) => ({
        start: new Date(`${day}T${range.start}:00`).toISOString(),
        end: new Date(`${day}T${range.end}:00`).toISOString(),
      }));
    })
    .filter(
      (slot, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.start === slot.start && candidate.end === slot.end,
        ) === index,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}

function MultiDateCalendar({ dates, onChange, disabled }) {
  const today = dateKey(new Date());
  const [visibleMonth, setVisibleMonth] = useState(
    dates[0]?.slice(0, 7) || today.slice(0, 7),
  );
  const [year, month] = visibleMonth.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthLabel = first.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  const cells = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const moveMonth = (amount) => {
    const next = new Date(year, month - 1 + amount, 1);
    setVisibleMonth(`${next.getFullYear()}-${pad(next.getMonth() + 1)}`);
  };

  return (
    <div className="wf-calendar" aria-label="Interview date calendar">
      <div className="wf-calendar-heading">
        <button
          type="button"
          aria-label="Previous month"
          disabled={disabled || visibleMonth <= today.slice(0, 7)}
          onClick={() => moveMonth(-1)}
        >
          Previous
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label="Next month" disabled={disabled} onClick={() => moveMonth(1)}>
          Next
        </button>
      </div>
      <label className="wf-month-jump">
        <span>Calendar month</span>
        <input
          type="month"
          min={today.slice(0, 7)}
          value={visibleMonth}
          disabled={disabled}
          onChange={(event) => setVisibleMonth(event.target.value)}
        />
      </label>
      <div className="wf-calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span className="wf-calendar-weekday" key={day}>{day}</span>
        ))}
        {cells.map((day, index) => {
          if (!day) return <span key={`empty-${index}`} />;
          const key = `${year}-${pad(month)}-${pad(day)}`;
          const selected = dates.includes(key);
          const past = key < today;
          const label = new Date(year, month - 1, day).toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          return (
            <button
              type="button"
              key={key}
              className={selected ? "wf-calendar-day is-selected" : "wf-calendar-day"}
              aria-label={`${selected ? 'Remove' : 'Select'} ${label}`}
              aria-pressed={selected}
              disabled={disabled || past}
              onClick={() =>
                onChange(
                  selected
                    ? dates.filter((date) => date !== key)
                    : [...dates, key].sort(),
                )
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AvailabilityPicker({ initialSlots = [], onChange, disabled }) {
  const initial = useMemo(() => initialAvailability(initialSlots), [initialSlots]);
  const [dates, setDates] = useState(initial.dates);
  const [applyToAll, setApplyToAll] = useState(initial.applyToAll);
  const [sharedTimes, setSharedTimes] = useState(initial.sharedTimes);
  const [timesByDate, setTimesByDate] = useState(initial.timesByDate);
  const [activeDate, setActiveDate] = useState(initial.dates[0] || "");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("09:30");
  const [error, setError] = useState("");
  const slots = useMemo(
    () =>
      buildAvailabilitySlots({ dates, applyToAll, sharedTimes, timesByDate }),
    [dates, applyToAll, sharedTimes, timesByDate],
  );

  useEffect(() => {
    onChange(slots);
  }, [onChange, slots]);

  useEffect(() => {
    if (dates.length && !dates.includes(activeDate)) setActiveDate(dates[0]);
    if (!dates.length && activeDate) setActiveDate("");
  }, [activeDate, dates]);

  const addRange = () => {
    if (!dates.length) {
      setError("Select at least one interview date first.");
      return;
    }
    if (end <= start) {
      setError("Choose an end time after the start time.");
      return;
    }
    const range = { start, end };
    if (applyToAll) {
      if (!sharedTimes.some((item) => rangeKey(item) === rangeKey(range)))
        setSharedTimes(sortedRanges([...sharedTimes, range]));
    } else {
      if (!activeDate) {
        setError("Choose the date that should receive this time.");
        return;
      }
      const current = timesByDate[activeDate] || [];
      if (!current.some((item) => rangeKey(item) === rangeKey(range)))
        setTimesByDate({
          ...timesByDate,
          [activeDate]: sortedRanges([...current, range]),
        });
    }
    setError("");
  };

  const setMode = (checked) => {
    if (!checked && sharedTimes.length) {
      setTimesByDate(
        dates.reduce(
          (next, day) => ({ ...next, [day]: [...sharedTimes] }),
          timesByDate,
        ),
      );
    }
    if (checked && !sharedTimes.length && activeDate)
      setSharedTimes(timesByDate[activeDate] || []);
    setApplyToAll(checked);
    setError("");
  };

  const removeRange = (day, range) => {
    if (applyToAll) {
      setSharedTimes(sharedTimes.filter((item) => rangeKey(item) !== rangeKey(range)));
      return;
    }
    setTimesByDate({
      ...timesByDate,
      [day]: (timesByDate[day] || []).filter(
        (item) => rangeKey(item) !== rangeKey(range),
      ),
    });
  };

  return (
    <section className="wf-availability" aria-label="Interview availability">
      <h4>Select one or more interview dates</h4>
      <p>Choose individual days from the calendar. Selected days do not need to be consecutive.</p>
      <MultiDateCalendar dates={dates} onChange={setDates} disabled={disabled} />
      {dates.length ? (
        <div className="wf-selected-dates" aria-label="Selected interview dates">
          {dates.map((day) => (
            <button
              type="button"
              key={day}
              disabled={disabled}
              onClick={() => setDates(dates.filter((date) => date !== day))}
            >
              {new Date(`${day}T12:00:00`).toLocaleDateString([], {
                month: "short",
                day: "numeric",
                year: "numeric",
              })} ×
            </button>
          ))}
        </div>
      ) : null}
      <label className="wf-checkbox">
        <input
          type="checkbox"
          checked={applyToAll}
          disabled={disabled}
          onChange={(event) => setMode(event.target.checked)}
        />
        <span>Apply selected times to all selected days</span>
      </label>
      {!applyToAll && dates.length ? (
        <div className="wf-date-tabs" aria-label="Choose a date to set its times">
          {dates.map((day) => (
            <button
              type="button"
              key={day}
              className={activeDate === day ? "is-selected" : ""}
              aria-pressed={activeDate === day}
              onClick={() => setActiveDate(day)}
            >
              {new Date(`${day}T12:00:00`).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </button>
          ))}
        </div>
      ) : null}
      <div className="wf-time-row">
        <label className="wf-field">
          <span>Start time</span>
          <select value={start} disabled={disabled} onChange={(event) => setStart(event.target.value)}>
            {TIME_OPTIONS.slice(0, -1).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="wf-field">
          <span>End time</span>
          <select value={end} disabled={disabled} onChange={(event) => setEnd(event.target.value)}>
            {TIME_OPTIONS.slice(1).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button type="button" disabled={disabled || !dates.length} onClick={addRange}>
          Add time range
        </button>
      </div>
      {error ? <p role="alert" className="wf-alert">{error}</p> : null}
      {slots.length > 10 ? (
        <p role="alert" className="wf-alert">Choose no more than 10 total interview times.</p>
      ) : null}
      {slots.length ? (
        <div className="wf-slot-review">
          <h4>Review offered times ({slots.length} of 10)</h4>
          {dates.map((day) => {
            const ranges = applyToAll ? sharedTimes : timesByDate[day] || [];
            if (!ranges.length) return null;
            return (
              <div key={day} className="wf-slot-day">
                <strong>{new Date(`${day}T12:00:00`).toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}</strong>
                {ranges.map((range) => (
                  <p key={rangeKey(range)}>
                    {new Date(`2000-01-01T${range.start}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {' – '}
                    {new Date(`2000-01-01T${range.end}:00`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {' '}
                    <button type="button" disabled={disabled} onClick={() => removeRange(day, range)}>
                      {applyToAll ? "Remove from all days" : "Remove"}
                    </button>
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
