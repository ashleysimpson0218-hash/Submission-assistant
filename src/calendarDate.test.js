import { getLocalCalendarDateKey } from "./calendarDate";

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
