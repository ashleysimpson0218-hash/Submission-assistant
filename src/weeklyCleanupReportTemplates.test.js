import {
  DEFAULT_WEEKLY_REPORT_TEMPLATES,
  WEEKLY_REPORT_TEMPLATE_KEYS,
  renderWeeklyReportContent,
  renderWeeklyReportTemplate,
  weeklyReportTemplateFor,
} from "./weeklyCleanupReportTemplates";

describe("Weekly Cleanup report communication templates", () => {
  test("provides separate facility, no-openings, regional, and leadership templates", () => {
    expect(Object.keys(DEFAULT_WEEKLY_REPORT_TEMPLATES)).toEqual([
      "facilityWeeklyReport",
      "noOpeningsWeeklyReport",
      "regionalWeeklyReport",
      "leadershipWeeklyReport",
    ]);
  });

  test("renders report data without changing the selected wording", () => {
    const { subject, body } = renderWeeklyReportContent({}, WEEKLY_REPORT_TEMPLATE_KEYS.facility, {
      facility: "Synthetic Facility",
      report_start_date: "7/20/2026",
      reporting_week: "7/20/2026 to 7/24/2026",
      open_requisitions: "Synthetic Role | 1001",
      candidate_details: "Synthetic Candidate | Submitted",
      hires_and_starts: "None",
      leadership_openings: "None",
      attachment_note: "Synthetic attachment note.",
    });
    expect(subject).toBe("Weekly Recruiting Update, Synthetic Facility, Week of 7/20/2026");
    expect(body).toContain("Synthetic Role | 1001");
    expect(body).toContain("Synthetic Candidate | Submitted");
  });

  test("uses saved custom wording for the correct audience", () => {
    const settings = { templates: { regionalWeeklyReport: { useCustom: true, subject: "Regional: {reporting_week}", body: "Review {facilities_included}." } } };
    const { subject: customSubject, body: customBody } = renderWeeklyReportContent(settings, WEEKLY_REPORT_TEMPLATE_KEYS.regional, { reporting_week: "This Week", facilities_included: "Facility A, Facility B" });
    expect({ subject: customSubject, body: customBody }).toMatchObject({ subject: "Regional: This Week", body: "Review Facility A, Facility B." });
  });

  test("preserves unknown tokens instead of silently deleting recruiter wording", () => {
    expect(renderWeeklyReportTemplate("Review {facility} with {future_report_value}.", { facility: "Synthetic Facility" }))
      .toBe("Review Synthetic Facility with {future_report_value}.");
  });

  test("keeps a customized legacy Weekly Report Email as a facility fallback", () => {
    const record = weeklyReportTemplateFor({ templates: {
      weeklyReport: { useCustom: true, subject: "Legacy {facility}", body: "Legacy body" },
      facilityWeeklyReport: { ...DEFAULT_WEEKLY_REPORT_TEMPLATES.facilityWeeklyReport },
    } }, WEEKLY_REPORT_TEMPLATE_KEYS.facility);
    expect(record.subject).toBe("Legacy {facility}");
    expect(record.body).toBe("Legacy body");
  });

  test("a specific facility template takes precedence over the legacy fallback", () => {
    const record = weeklyReportTemplateFor({ templates: {
      weeklyReport: { useCustom: true, subject: "Legacy" },
      facilityWeeklyReport: { useCustom: true, subject: "Current" },
    } }, WEEKLY_REPORT_TEMPLATE_KEYS.facility);
    expect(record.subject).toBe("Current");
  });
});
