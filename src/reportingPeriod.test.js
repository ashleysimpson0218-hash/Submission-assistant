import {
  DEFAULT_REPORTING_TIME_ZONE,
  reportingCalendarDateKey,
  reportingPeriodFor,
  reportingTimeZone,
  shiftDateOnly,
} from "./reportingPeriod";

test("uses the configured reporting timezone rather than the process timezone", () => {
  const instant = "2026-07-28T01:30:00.000Z";
  expect(reportingCalendarDateKey(instant, "America/New_York")).toBe("2026-07-27");
  expect(reportingCalendarDateKey(instant, "UTC")).toBe("2026-07-28");
});

test("date-only values remain unchanged and invalid values fail safely", () => {
  expect(reportingCalendarDateKey("2026-07-27", "America/New_York")).toBe("2026-07-27");
  expect(reportingCalendarDateKey("not-a-date", "America/New_York")).toBe("");
  expect(shiftDateOnly("", 1)).toBe("");
});

test("reporting week is stable across reload-equivalent calculations at a timezone boundary", () => {
  const now = new Date("2026-07-28T01:30:00.000Z");
  const first = reportingPeriodFor(now, "America/New_York");
  const second = reportingPeriodFor(new Date(now.getTime()), "America/New_York");
  expect(first).toEqual({ startDate: "2026-07-27", endDate: "2026-07-27" });
  expect(second).toEqual(first);
});

test("Sunday uses the previous Monday and Monday starts a new week", () => {
  expect(reportingPeriodFor("2026-08-02", "UTC")).toEqual({
    startDate: "2026-07-27",
    endDate: "2026-08-02",
  });
  expect(reportingPeriodFor("2026-08-03", "UTC")).toEqual({
    startDate: "2026-08-03",
    endDate: "2026-08-03",
  });
});

test("saved timezone labels normalize deterministically", () => {
  expect(reportingTimeZone("(UTC-05:00) Eastern Time (US & Canada)")).toBe("America/New_York");
  expect(reportingTimeZone("UTC")).toBe("UTC");
  expect(reportingTimeZone("invalid/timezone")).toBe(DEFAULT_REPORTING_TIME_ZONE);
});
