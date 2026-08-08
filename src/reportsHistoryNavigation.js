export const REPORTS_HISTORY_DESTINATIONS = [
  { value: "ready-review", label: "Ready to Review" },
  { value: "sent-history", label: "Sent & History" },
  { value: "templates-settings", label: "Templates & Settings" },
];

export const REPORTS_HISTORY_AUDIENCES = ["Facility", "Regional", "Executive"];

export const REPORTS_HISTORY_STATUS_FILTERS = [
  "Drafts",
  "Reviewed",
  "Downloaded",
  "Sent",
  "Previous Periods",
  "All",
];

const DEFAULT_DESTINATION = {
  destination: "ready-review",
  audience: "Facility",
  reviewSection: "combined",
  historyFilter: "All",
};

export const LEGACY_REPORTS_HISTORY_DESTINATIONS = {
  preview: { destination: "ready-review", audience: "Facility", reviewSection: "combined", historyFilter: "All" },
  facility: { destination: "ready-review", audience: "Facility", reviewSection: "combined", historyFilter: "All" },
  regional: { destination: "ready-review", audience: "Regional", reviewSection: "combined", historyFilter: "All" },
  csuite: { destination: "ready-review", audience: "Executive", reviewSection: "combined", historyFilter: "All" },
  email: { destination: "ready-review", audience: "Facility", reviewSection: "email", historyFilter: "All" },
  attachment: { destination: "ready-review", audience: "Facility", reviewSection: "attachment", historyFilter: "All" },
  generated: { destination: "sent-history", audience: "Facility", reviewSection: "combined", historyFilter: "Drafts" },
  history: { destination: "sent-history", audience: "Facility", reviewSection: "combined", historyFilter: "All" },
  download: { destination: "sent-history", audience: "Facility", reviewSection: "combined", historyFilter: "All" },
  settings: { destination: "templates-settings", audience: "Facility", reviewSection: "combined", historyFilter: "All" },
};

export function normalizeReportsHistoryDestination(value) {
  const key = String(value || "").trim();
  if (LEGACY_REPORTS_HISTORY_DESTINATIONS[key]) return { ...LEGACY_REPORTS_HISTORY_DESTINATIONS[key] };
  if (REPORTS_HISTORY_DESTINATIONS.some((destination) => destination.value === key)) {
    return { destination: key, audience: null, reviewSection: "combined", historyFilter: null };
  }
  return { ...DEFAULT_DESTINATION };
}

function normalizedStatus(record) {
  return String(record?.status || "").trim().toLowerCase();
}

function normalizedPeriod(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function reportHistoryRecordMatchesView(record, view, currentReportPeriod = "") {
  const selectedView = REPORTS_HISTORY_STATUS_FILTERS.includes(view) ? view : "All";
  const status = normalizedStatus(record);
  if (selectedView === "All") return true;
  if (selectedView === "Drafts") return status.includes("draft");
  if (selectedView === "Reviewed") return status === "reviewed";
  if (selectedView === "Downloaded") {
    return ["downloaded", "downloaded only", "exported"].includes(status);
  }
  if (selectedView === "Sent") return status === "sent";
  if (selectedView === "Previous Periods") {
    const current = normalizedPeriod(currentReportPeriod);
    const recordPeriod = normalizedPeriod(record?.reportWeek);
    return Boolean(current && recordPeriod && recordPeriod !== current);
  }
  return true;
}

export function filterReportHistoryByView(records, view, currentReportPeriod) {
  return (Array.isArray(records) ? records : []).filter((record) => (
    reportHistoryRecordMatchesView(record, view, currentReportPeriod)
  ));
}
