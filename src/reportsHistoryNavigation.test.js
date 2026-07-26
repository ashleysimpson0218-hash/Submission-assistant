import {
  LEGACY_REPORTS_HISTORY_DESTINATIONS,
  REPORTS_HISTORY_STATUS_FILTERS,
  filterReportHistoryByView,
  normalizeReportsHistoryDestination,
  reportHistoryRecordMatchesView,
} from "./reportsHistoryNavigation";

test.each([
  ["preview", "ready-review", "Facility", "All"],
  ["facility", "ready-review", "Facility", "All"],
  ["regional", "ready-review", "Regional", "All"],
  ["csuite", "ready-review", "Executive", "All"],
  ["email", "ready-review", "Facility", "All"],
  ["attachment", "ready-review", "Facility", "All"],
  ["generated", "sent-history", "Facility", "Drafts"],
  ["history", "sent-history", "Facility", "All"],
  ["download", "sent-history", "Facility", "All"],
  ["settings", "templates-settings", "Facility", "All"],
])("maps legacy destination %s deterministically", (legacy, destination, audience, historyFilter) => {
  expect(normalizeReportsHistoryDestination(legacy)).toEqual(expect.objectContaining({
    destination,
    audience,
    historyFilter,
  }));
});

test("the compatibility map contains exactly the ten legacy destination values", () => {
  expect(Object.keys(LEGACY_REPORTS_HISTORY_DESTINATIONS).sort()).toEqual(
    ["preview", "facility", "regional", "csuite", "email", "attachment", "generated", "history", "download", "settings"].sort(),
  );
});

test.each([undefined, null, "", "invalid-destination"])("maps missing or invalid destination %s safely", (value) => {
  expect(normalizeReportsHistoryDestination(value)).toEqual(expect.objectContaining({
    destination: "ready-review",
    audience: "Facility",
    historyFilter: "All",
  }));
});

test.each(["ready-review", "sent-history", "templates-settings"])("preserves canonical destination %s", (value) => {
  expect(normalizeReportsHistoryDestination(value).destination).toBe(value);
});

test("filters Drafts, Reviewed, Downloaded, Sent, Previous Periods, and All without mutating records", () => {
  const records = [
    { id: "draft", status: "Draft Generated", reportWeek: "2026-07-20 to 2026-07-24" },
    { id: "reviewed", status: "Reviewed", reportWeek: "2026-07-20 to 2026-07-24" },
    { id: "downloaded", status: "Downloaded Only", reportWeek: "2026-07-20 to 2026-07-24" },
    { id: "exported", status: "Exported", reportWeek: "2026-07-20 to 2026-07-24" },
    { id: "sent", status: "Sent", reportWeek: "2026-07-20 to 2026-07-24" },
    { id: "previous", status: "Sent", reportWeek: "2026-07-13 to 2026-07-17" },
    { id: "copied", status: "Copied", reportWeek: "2026-07-20 to 2026-07-24" },
    { id: "manual", status: "Manually Completed", reportWeek: "2026-07-20 to 2026-07-24" },
  ];
  const before = JSON.stringify(records);

  expect(filterReportHistoryByView(records, "Drafts", "2026-07-20 to 2026-07-24").map(({ id }) => id)).toEqual(["draft"]);
  expect(filterReportHistoryByView(records, "Reviewed", "2026-07-20 to 2026-07-24").map(({ id }) => id)).toEqual(["reviewed"]);
  expect(filterReportHistoryByView(records, "Downloaded", "2026-07-20 to 2026-07-24").map(({ id }) => id)).toEqual(["downloaded", "exported"]);
  expect(filterReportHistoryByView(records, "Sent", "2026-07-20 to 2026-07-24").map(({ id }) => id)).toEqual(["sent", "previous"]);
  expect(filterReportHistoryByView(records, "Previous Periods", "2026-07-20 to 2026-07-24").map(({ id }) => id)).toEqual(["previous"]);
  expect(filterReportHistoryByView(records, "All", "2026-07-20 to 2026-07-24")).toHaveLength(records.length);
  expect(JSON.stringify(records)).toBe(before);
});

test("does not reinterpret copied or manually completed as reviewed or sent", () => {
  expect(reportHistoryRecordMatchesView({ status: "Copied" }, "Reviewed")).toBe(false);
  expect(reportHistoryRecordMatchesView({ status: "Copied" }, "Sent")).toBe(false);
  expect(reportHistoryRecordMatchesView({ status: "Manually Completed" }, "Reviewed")).toBe(false);
  expect(reportHistoryRecordMatchesView({ status: "Manually Completed" }, "Sent")).toBe(false);
});

test("exports remain a downloaded activity and never a sent activity", () => {
  expect(reportHistoryRecordMatchesView({ status: "Exported" }, "Downloaded")).toBe(true);
  expect(reportHistoryRecordMatchesView({ status: "Exported" }, "Sent")).toBe(false);
});

test("exposes the required history filter order", () => {
  expect(REPORTS_HISTORY_STATUS_FILTERS).toEqual(["Drafts", "Reviewed", "Downloaded", "Sent", "Previous Periods", "All"]);
});
