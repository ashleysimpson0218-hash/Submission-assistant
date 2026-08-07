export const WEEKLY_REPORT_TEMPLATE_KEYS = {
  facility: "facilityWeeklyReport",
  noOpenings: "noOpeningsWeeklyReport",
  regional: "regionalWeeklyReport",
  leadership: "leadershipWeeklyReport",
};

export const DEFAULT_WEEKLY_REPORT_TEMPLATES = {
  [WEEKLY_REPORT_TEMPLATE_KEYS.facility]: {
    useCustom: false,
    channel: "Email",
    subject: "Weekly Recruiting Update, {facility}, Week of {report_start_date}",
    body: "Facility: {facility}\nReporting Week: {reporting_week}\n\nOpen Requisitions:\n{open_requisitions}\n\nCandidate Details:\n{candidate_details}\n\nHires and Tentative Starts:\n{hires_and_starts}\n\nLeadership Openings:\n{leadership_openings}\n\n{attachment_note}",
  },
  [WEEKLY_REPORT_TEMPLATE_KEYS.noOpenings]: {
    useCustom: false,
    channel: "Email",
    subject: "No Openings Update, {facility}, Week of {report_start_date}",
    body: "Facility: {facility}\nReporting Week: {reporting_week}\n\nThere are no current open requisitions for this reporting period.\n\nCandidate Details:\n{candidate_details}\n\nHires and Tentative Starts:\n{hires_and_starts}\n\n{attachment_note}",
  },
  [WEEKLY_REPORT_TEMPLATE_KEYS.regional]: {
    useCustom: false,
    channel: "Email",
    subject: "Regional Recruiting Summary: {reporting_week}",
    body: "Regional Recruiting Summary\nReporting Week: {reporting_week}\n\nFacilities included: {facilities_included}\nTotal open requisitions: {total_open_requisitions}\nFacilities with no openings: {facilities_with_no_openings}\nFacilities with high-risk candidates: {high_risk_facilities}\n\nCandidates awaiting feedback over 5 days:\n{aging_feedback}\n\nPending offers: {pending_offers}\nTentative starts: {tentative_starts}\nLeadership openings: {leadership_opening_count}\n\n{attachment_note}",
  },
  [WEEKLY_REPORT_TEMPLATE_KEYS.leadership]: {
    useCustom: false,
    channel: "Email",
    subject: "Leadership Recruiting Summary: {reporting_week}",
    body: "Leadership Recruiting Summary\nReporting Week: {reporting_week}\n\nTotal open requisitions: {total_open_requisitions}\nTotal active candidates: {total_active_candidates}\nTotal pending offers: {pending_offers}\nTotal hires / tentative starts: {tentative_starts}\nTotal leadership openings: {leadership_opening_count}\n\nAging feedback concerns: {aging_feedback_count}\nHigh-risk facilities: {high_risk_facilities}\n\nLeadership role activity:\n{leadership_openings}\n\nNo-opening facility summary: {no_opening_summary}\n\n{attachment_note}",
  },
};

export const WEEKLY_REPORT_TEMPLATE_TOKENS = [
  "{report_type}",
  "{facility}",
  "{report_start_date}",
  "{report_end_date}",
  "{reporting_week}",
  "{facilities_included}",
  "{open_requisitions}",
  "{candidate_details}",
  "{hires_and_starts}",
  "{leadership_openings}",
  "{total_open_requisitions}",
  "{total_active_candidates}",
  "{facilities_with_no_openings}",
  "{high_risk_facilities}",
  "{aging_feedback}",
  "{aging_feedback_count}",
  "{pending_offers}",
  "{tentative_starts}",
  "{leadership_opening_count}",
  "{no_opening_summary}",
  "{attachment_note}",
];

export function renderWeeklyReportTemplate(template, values = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (token, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key] ?? "") : token
  ));
}

export function weeklyReportTemplateFor(settings = {}, key = WEEKLY_REPORT_TEMPLATE_KEYS.facility) {
  const defaults = DEFAULT_WEEKLY_REPORT_TEMPLATES[key] || { useCustom: false, subject: "", body: "" };
  const templates = settings.templates || {};
  const specific = templates[key] || {};
  const legacy = key === WEEKLY_REPORT_TEMPLATE_KEYS.facility && templates.weeklyReport?.useCustom ? templates.weeklyReport : {};
  const selected = specific.useCustom ? specific : legacy.useCustom ? legacy : specific;
  return { ...defaults, ...selected };
}

export function renderWeeklyReportContent(settings = {}, key, values = {}) {
  const template = weeklyReportTemplateFor(settings, key);
  return {
    key,
    subject: renderWeeklyReportTemplate(template.subject, values),
    body: renderWeeklyReportTemplate(template.body, values),
  };
}
