import {
  getLocalCalendarDate,
  getLocalCalendarDateKey,
  getLocalCalendarWeekRange,
} from "./calendarDate";

const timezone = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
const isNewYork = timezone === "America/New_York";

test("groups a timestamp shortly after midnight UTC by its local calendar date", () => {
  expect(getLocalCalendarDateKey("2026-07-28T00:44:00.000Z")).toBe(isNewYork ? "2026-07-27" : "2026-07-28");
});

test("preserves date-only values without reparsing them as UTC", () => {
  expect(getLocalCalendarDateKey("2026-07-27")).toBe("2026-07-27");
});

test("uses the winter local offset without hardcoding a timezone", () => {
  expect(getLocalCalendarDateKey("2026-01-15T02:30:00.000Z")).toBe(isNewYork ? "2026-01-14" : "2026-01-15");
});

test("uses the summer local offset without hardcoding a timezone", () => {
  expect(getLocalCalendarDateKey("2026-07-15T02:30:00.000Z")).toBe(isNewYork ? "2026-07-14" : "2026-07-15");
});

test.each([undefined, null, "", "not-a-date", new Date("invalid")])("fails safely for invalid value %p", (value) => {
  expect(getLocalCalendarDateKey(value)).toBe("");
});

test("accepts Date objects using the same local calendar model", () => {
  expect(getLocalCalendarDateKey(new Date("2026-07-28T00:44:00.000Z"))).toBe(isNewYork ? "2026-07-27" : "2026-07-28");
});

test("constructs date-only values as local calendar dates without shifting Monday", () => {
  const date = getLocalCalendarDate("2026-07-27");
  expect(getLocalCalendarDateKey(date)).toBe("2026-07-27");
  expect(date.getDay()).toBe(1);
});

test("keeps Sunday and Monday in their correct local week ranges", () => {
  const sunday = getLocalCalendarWeekRange("2026-07-26");
  const monday = getLocalCalendarWeekRange("2026-07-27");
  expect(getLocalCalendarDateKey(sunday.start)).toBe("2026-07-20");
  expect(getLocalCalendarDateKey(sunday.end)).toBe("2026-07-27");
  expect(getLocalCalendarDateKey(monday.start)).toBe("2026-07-27");
  expect(getLocalCalendarDateKey(monday.end)).toBe("2026-08-03");
});

test("fails safely when a local date or week cannot be constructed", () => {
  expect(getLocalCalendarDate("2026-02-30")).toBeNull();
  expect(getLocalCalendarWeekRange("invalid")).toEqual({ start: null, end: null });
});
