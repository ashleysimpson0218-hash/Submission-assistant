const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalCalendarDateKey(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalCalendarDate(value) {
  const key = getLocalCalendarDateKey(value);
  if (!key) return null;

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;

  return date;
}

export function getLocalCalendarWeekRange(value, days = 7) {
  const selected = getLocalCalendarDate(value);
  if (!selected) return { start: null, end: null };

  const start = new Date(selected);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);

  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { start, end };
}
