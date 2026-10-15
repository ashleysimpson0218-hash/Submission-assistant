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
const INTERVIEW_LENGTHS = [15, 20, 30, 45, 60];
const TIME_GROUPS = [
  { label: "Morning", options: TIME_OPTIONS.filter((option) => option.value < "12:00") },
  { label: "Afternoon", options: TIME_OPTIONS.filter((option) => option.value >= "12:00" && option.value < "17:00") },
  { label: "Evening", options: TIME_OPTIONS.filter((option) => option.value >= "17:00" && option.value < "22:00") },
];

function addMinutes(time, duration) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = hours * 60 + minutes + Number(duration);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function sortedRanges(ranges = []) {
  return [...ranges].sort((a, b) => rangeKey(a).localeCompare(rangeKey(b)));
}

function initialAvailability(slots = []) {
  const timesByDate = {};
  const durations = [];
  slots.forEach((slot) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return;
    durations.push((end.valueOf() - start.valueOf()) / 60000);
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
    duration:
      durations.length &&
      durations.every((value) => value === durations[0]) &&
      INTERVIEW_LENGTHS.includes(durations[0])
        ? String(durations[0])
        : "30",
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
  const [duration, setDuration] = useState(initial.duration);
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

  const toggleStartTime = (start) => {
    if (!dates.length || (!applyToAll && !activeDate)) return;
    const range = { start, end: addMinutes(start, duration) };
    if (applyToAll) {
      setSharedTimes(
        sharedTimes.some((item) => item.start === start)
          ? sharedTimes.filter((item) => item.start !== start)
          : sortedRanges([...sharedTimes, range]),
      );
    } else {
      const current = timesByDate[activeDate] || [];
      setTimesByDate({
        ...timesByDate,
        [activeDate]: current.some((item) => item.start === start)
          ? current.filter((item) => item.start !== start)
          : sortedRanges([...current, range]),
      });
    }
  };

  const changeDuration = (nextDuration) => {
    setDuration(nextDuration);
    setSharedTimes(
      sharedTimes.map((range) => ({
        ...range,
        end: addMinutes(range.start, nextDuration),
      })),
    );
    setTimesByDate(
      Object.fromEntries(
        Object.entries(timesByDate).map(([day, ranges]) => [
          day,
          ranges.map((range) => ({
            ...range,
            end: addMinutes(range.start, nextDuration),
          })),
        ]),
      ),
    );
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
      <div className="wf-duration-row">
        <label className="wf-field">
          <span>Interview length</span>
          <select value={duration} disabled={disabled} onChange={(event) => changeDuration(event.target.value)}>
            {INTERVIEW_LENGTHS.map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} minutes</option>
            ))}
          </select>
        </label>
      </div>
      <div className="wf-time-groups">
        <h4>Select one or more start times</h4>
        <p>Click every start time you want to offer. Click a selected time again to remove it.</p>
        {TIME_GROUPS.map((group) => (
          <div key={group.label} className="wf-time-group">
            <h5>{group.label}</h5>
            <div className="wf-time-options">
              {group.options.map((option) => {
                const ranges = applyToAll ? sharedTimes : timesByDate[activeDate] || [];
                const selected = ranges.some((range) => range.start === option.value);
                return (
                  <button
                    type="button"
                    key={option.value}
                    className={selected ? "is-selected" : ""}
                    aria-pressed={selected}
                    aria-label={`${selected ? "Remove" : "Select"} ${option.label} start time`}
                    disabled={disabled || !dates.length || (!applyToAll && !activeDate)}
                    onClick={() => toggleStartTime(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p>The end time is calculated automatically from the selected interview length.</p>
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
