const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const TIME_ZONE_ALIASES = Object.freeze({
  "(UTC-05:00) Eastern Time (US & Canada)": "America/New_York",
  "(UTC-06:00) Central Time (US & Canada)": "America/Chicago",
  "(UTC-07:00) Mountain Time (US & Canada)": "America/Denver",
  "(UTC-08:00) Pacific Time (US & Canada)": "America/Los_Angeles",
  "Eastern Time (ET)": "America/New_York",
  "Central Time (CT)": "America/Chicago",
  "Mountain Time (MT)": "America/Denver",
  "Pacific Time (PT)": "America/Los_Angeles",
});

export const DEFAULT_REPORTING_TIME_ZONE = "America/New_York";

export function reportingTimeZone(value) {
  const candidate = String(value ?? "").trim();
  if (TIME_ZONE_ALIASES[candidate]) return TIME_ZONE_ALIASES[candidate];
  if (!candidate) return DEFAULT_REPORTING_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return DEFAULT_REPORTING_TIME_ZONE;
  }
}

export function reportingCalendarDateKey(value = new Date(), timeZone = DEFAULT_REPORTING_TIME_ZONE) {
  if (typeof value === "string" && DATE_ONLY.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: reportingTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function shiftDateOnly(value, days) {
  if (!DATE_ONLY.test(String(value || ""))) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

export function reportingPeriodFor(value = new Date(), timeZone = DEFAULT_REPORTING_TIME_ZONE) {
  const endDate = reportingCalendarDateKey(value, timeZone);
  if (!endDate) return { startDate: "", endDate: "" };
  const [year, month, day] = endDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;
  return {
    startDate: shiftDateOnly(endDate, offsetToMonday),
    endDate,
  };
}
