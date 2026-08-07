import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  HISTORICAL_REGENERATION_WARNING,
  ReportsHistoryPage,
  readSavedHistoryTarget,
  savedHistoryReviewContext,
} from "./ReportsHistoryPage";

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

const THEME = {
  blueBg: "#eef2ff",
  border: "#c4b5fd",
  borderSoft: "#e9d5ff",
  muted: "#6b7280",
  panel: "#fff",
  panelAlt: "#faf5ff",
  primary2: "#7c3aed",
  red: "#dc2626",
  text: "#111827",
};

function Button({ children, disabled, onClick, primary, subtle, ...props }) {
  void primary;
  void subtle;
  return <button type="button" disabled={disabled} onClick={onClick} {...props}>{children}</button>;
}

function Card({ children, title, subtitle }) {
  return <section aria-label={title}><h2>{title}</h2><div>{subtitle}</div>{children}</section>;
}

function Field({ children, label }) {
  return <label>{label}{children}</label>;
}

function SelectInput({ options = [], ...props }) {
  return (
    <select {...props}>
      {options.map((option) => {
        const value = typeof option === "string" ? option : option.value;
        const label = typeof option === "string" ? option : option.label;
        return <option key={value} value={value}>{label}</option>;
      })}
    </select>
  );
}

function MiniStat({ label, value }) {
  return <div>{label}: {value}</div>;
}

function ToggleField({ checked, label, onChange }) {
  return <label>{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

const reportRow = {
  id: "facility-1",
  facilityId: "facility-1",
  facility: "Synthetic Central Facility",
  reportType: "Facility Weekly Report",
  status: "Ready",
};

function audienceListRow(audience = "Facility", overrides = {}) {
  const definitions = {
    Facility: {
      key: "facility:facility-1",
      title: "Synthetic Central Facility",
      reportType: "Facility Weekly Report",
      recipientGroup: "Facility Contacts",
      attachmentName: "welcomeflow-synthetic-central-2026-07-20.xls",
      workbookTabs: ["Facility Summary"],
    },
    Regional: {
      key: "region:region-central",
      title: "Central",
      reportType: "Regional Manager Summary",
      recipientGroup: "Regional Manager",
      attachmentName: "welcomeflow-regional-summary-2026-07-20.xls",
      workbookTabs: ["Report Scope Summary", "Synthetic Central Facility"],
    },
    Executive: {
      key: "executive:all-selected",
      title: "C-Suite Leadership Report",
      reportType: "C-Suite Leadership Report",
      recipientGroup: "C-Suite",
      attachmentName: "welcomeflow-executive-summary-2026-07-20.xls",
      workbookTabs: ["All Facilities Summary", "Synthetic Central Facility"],
    },
  };
  const definition = definitions[audience];
  return {
    ...definition,
    audience,
    reportId: `wf-report-v1|${audience}|${encodeURIComponent(definition.reportType)}|facility-1`,
    reportIds: ["facility-1"],
    includedFacilityIds: ["facility-1"],
    facilityNames: ["Synthetic Central Facility"],
    facilities: [{ facilityId: "facility-1", facilityName: "Synthetic Central Facility" }],
    regionIds: ["region-central"],
    regionNames: ["Central"],
    status: "Ready",
    subject: `${audience} subject`,
    sourceRows: [reportRow],
    ...overrides,
  };
}

const historyRecord = {
  id: "history-1",
  reportId: "wf-report-v1|Facility|Facility%20Weekly%20Report|facility-1",
  reportIds: ["facility-1"],
  reportWeek: "2026-07-20 to 2026-07-24",
  reportingPeriod: "2026-07-20 to 2026-07-24",
  generatedDate: "2026-07-24T12:00:00.000Z",
  dataThrough: "2026-07-24",
  facilityId: "facility-1",
  facilityIds: ["facility-1"],
  facility: "Synthetic Central Facility",
  reportType: "Facility Weekly Report",
  audience: "Facility",
  recipient: "Synthetic Facility Contact",
  recipientGroup: "Facility Contacts",
  status: "Sent",
  attachmentName: "synthetic-central.xlsx",
  attachmentType: "Facility recruiting workbook",
  workbookTabs: ["Facility Summary", "Open Requisitions"],
  emailSubject: "Synthetic weekly report",
  emailBody: "Synthetic historical body",
};

const allowedEligibility = {
  canViewDraftPreview: true,
  canCreateFinalPreview: true,
  canDownloadWorkbook: true,
  canPrepareEmail: true,
  canMarkReady: true,
  blockingReasons: [],
  warnings: [],
};

const allowedActionState = {
  selectedPreviewableReportIds: ["facility-1"],
  selectedDownloadableReportIds: ["facility-1"],
  selectedEmailReportIds: ["facility-1"],
  selectedReadyReportIds: ["facility-1"],
  selectedMarkReviewedReportIds: ["facility-1"],
  selectedMarkSentReportIds: ["facility-1"],
};

function baseProps(overrides = {}) {
  return {
    Badge: ({ children }) => <span>{children}</span>,
    Button,
    Card,
    EmptyState: ({ children }) => <div>{children}</div>,
    Field,
    MiniStat,
    SelectInput,
    TextInput: (props) => <input {...props} />,
    ToggleField,
    THEME,
    activePage: "reporting",
    buildAllFacilityWorkbookSheets: jest.fn(() => [{ name: "Summary" }, { name: "Detail" }]),
    cSuiteEmailBody: jest.fn(() => "Synthetic executive body"),
    copyReportEmailContent: jest.fn(),
    displayDate: jest.fn((value) => value),
    downloadGeneratedFacilityReport: jest.fn(),
    downloadAudienceReportListEntry: jest.fn(),
    downloadHistoricalFacilityReport: jest.fn(),
    downloadReportReviewWorkbook: jest.fn(),
    eligibilityForReportRows: jest.fn(() => allowedEligibility),
    exportAtsUpdatePacketExcel: jest.fn(),
    exportFacilityWorkbooks: jest.fn(),
    exportHistoryExcel: jest.fn(),
    exportWeeklyFullDataWorkbook: jest.fn(),
    facilityEmailContent: jest.fn(() => ({ subject: "Synthetic facility subject", body: "Synthetic facility body" })),
    facilityReportModel: jest.fn(() => ({ facility: "Synthetic Central Facility", missingContact: false })),
    facilityWorkbookSheets: jest.fn(() => [{ name: "Summary" }]),
    history: [historyRecord],
    isNarrow: false,
    labelFromKey: jest.fn((key) => key),
    markSelectedFacilityReportsReviewed: jest.fn(),
    markSelectedFacilityReportsSent: jest.fn(),
    openReportReview: jest.fn(),
    openReportingIssueCorrection: jest.fn(),
    openReportingSettingsSurface: jest.fn(),
    previewSelectedFacilityReports: jest.fn(),
    regionalEmailBody: jest.fn(() => "Synthetic regional body"),
    reportEndDate: "2026-07-24",
    reportFacilityNames: ["Synthetic Central Facility"],
    reportHistory: [historyRecord],
    reportHistoryFiltered: [historyRecord],
    reportHistoryFilters: { facility: "All", reportType: "All", status: "All", audience: "All", start: "", end: "" },
    reportHistoryStatusView: "All",
    reportInclusions: { candidates: true, requisitions: false },
    reportReviewListRows: [audienceListRow()],
    reportStartDate: "2026-07-20",
    reportTypeOptions: ["Facility Weekly Report"],
    reportsHubTab: "ready-review",
    reportsReviewAudience: "Facility",
    reportingActionState: allowedActionState,
    safeCopy: jest.fn(),
    saveReportsToHistory: jest.fn(),
    selectedAudienceEmailBody: jest.fn(() => "Synthetic audience body"),
    selectedFacilityActionRows: [reportRow],
    selectedRecipientGroup: "Facility contacts",
    selectedReportEligibility: allowedEligibility,
    selectedReportType: "Facility Weekly Report",
    setReportHistoryFilters: jest.fn(),
    setReportHistoryStatusView: jest.fn(),
    setReportInclusions: jest.fn(),
    setReportsHubTab: jest.fn(),
    setReportsReviewAudience: jest.fn(),
    setWeeklyReport: jest.fn(),
    setWeeklySubject: jest.fn(),
    weeklyReport: "Synthetic preview body",
    weeklySubject: "Synthetic preview subject",
    ...overrides,
  };
}

test("renders exactly three Reports & History destinations in the required order", () => {
  const props = baseProps();
  render(<ReportsHistoryPage {...props} />);

  const hub = screen.getByRole("region", { name: "Reports & History" });
  const buttons = within(hub).getAllByRole("button");
  expect(buttons.map((button) => button.textContent)).toEqual(["Ready to Review", "Sent & History", "Templates & Settings"]);

  buttons.forEach((button) => fireEvent.click(button));
  expect(props.setReportsHubTab.mock.calls.map(([value]) => value)).toEqual(["ready-review", "sent-history", "templates-settings"]);
  expect(props.saveReportsToHistory).not.toHaveBeenCalled();
});

test.each([
  ["preview", "Ready to Review"],
  ["facility", "Ready to Review"],
  ["regional", "Ready to Review"],
  ["csuite", "Ready to Review"],
  ["email", "Ready to Review"],
  ["attachment", "Ready to Review"],
  ["generated", "Sent & History"],
  ["history", "Sent & History"],
  ["download", "Sent & History"],
  ["settings", "Templates & Settings"],
  ["unknown", "Ready to Review"],
  [undefined, "Ready to Review"],
])("renders legacy destination %s in the compatible consolidated destination", (reportsHubTab, title) => {
  render(<ReportsHistoryPage {...baseProps({ reportsHubTab })} />);
  expect(screen.getAllByRole("heading", { name: title }).length).toBeGreaterThan(0);
});

test("preserves Facility, Regional, and Executive audience context", () => {
  const props = baseProps();
  const { rerender } = render(<ReportsHistoryPage {...props} />);
  expect(screen.getByText("Synthetic preview body")).toBeInTheDocument();

  rerender(<ReportsHistoryPage {...baseProps({ reportsHubTab: "regional" })} />);
  expect(screen.getByText("Synthetic regional body")).toBeInTheDocument();

  rerender(<ReportsHistoryPage {...baseProps({ reportsHubTab: "csuite" })} />);
  expect(screen.getByText("Synthetic executive body")).toBeInTheDocument();
});

test.each([
  ["Facility", "Facility Contacts", "Facility Weekly Report", "welcomeflow-synthetic-central-2026-07-20.xls", "Facility body"],
  ["Regional", "Regional Manager", "Regional Manager Summary", "welcomeflow-regional-summary-2026-07-20.xls", "Regional body"],
  ["Executive", "C-Suite", "C-Suite Leadership Report", "welcomeflow-executive-summary-2026-07-20.xls", "Executive body"],
])("renders synchronized %s body, recipient, report type, and attachment metadata", (audience, recipientGroup, reportType, attachmentName, body) => {
  render(<ReportsHistoryPage {...baseProps({
    reportsReviewAudience: audience,
    reportReviewContext: {
      audience,
      recipientGroup,
      reportType,
      subject: `${reportType} subject`,
      body,
      attachmentName,
      attachmentType: `${audience} recruiting workbook`,
      workbookSheets: [{ name: `${audience} Summary` }],
      generatedAt: "2026-07-24T12:00:00.000Z",
    },
    reportReviewListRows: [audienceListRow(audience)],
  })} />);

  expect(screen.getByLabelText("Report audience metadata")).toHaveTextContent(audience);
  expect(screen.getByLabelText("Report recipient")).toHaveTextContent(recipientGroup);
  expect(screen.getByLabelText("Report subject")).toHaveTextContent(reportType);
  expect(screen.getByText(body)).toBeInTheDocument();
  expect(screen.getByLabelText("Attachment name")).toHaveTextContent(attachmentName);
  expect(screen.getByLabelText("Attachment type")).toHaveTextContent(`${audience} recruiting workbook`);
});

test("audience controls and Review Report preserve one synchronized stable report target", () => {
  const props = baseProps();
  render(<ReportsHistoryPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Regional" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Review Report" })[0]);

  expect(props.setReportsReviewAudience).toHaveBeenCalledWith("Regional");
  expect(props.openReportReview).toHaveBeenCalledWith([reportRow], {
    audience: "Facility",
    reportType: "Facility Weekly Report",
    recipientGroup: "Facility contacts",
  });
  expect(props.previewSelectedFacilityReports).not.toHaveBeenCalled();
});

test("report-row Review Report delegates the exact stable scope and audience context", () => {
  const props = baseProps({
    reportsReviewAudience: "Regional",
    reportReviewContext: {
      audience: "Regional",
      reportType: "Regional Manager Summary",
      recipientGroup: "Regional Manager",
      body: "Regional body",
      workbookSheets: [],
    },
    reportReviewListRows: [audienceListRow("Regional")],
  });
  render(<ReportsHistoryPage {...props} />);

  fireEvent.click(screen.getAllByRole("button", { name: "Review Report" })[1]);

  expect(props.openReportReview).toHaveBeenCalledWith([reportRow], {
    audience: "Regional",
    reportType: "Regional Manager Summary",
    recipientGroup: "Regional Manager",
  });
  expect(props.saveReportsToHistory).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsReviewed).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsSent).not.toHaveBeenCalled();
});

test("Regional and Executive report lists replace facility rows with their canonical audience scope", () => {
  const { rerender } = render(<ReportsHistoryPage {...baseProps()} />);
  expect(screen.getByTestId("audience-report-row-facility:facility-1")).toHaveTextContent("Synthetic Central Facility");

  rerender(<ReportsHistoryPage {...baseProps({
    reportsReviewAudience: "Regional",
    reportReviewListRows: [audienceListRow("Regional")],
  })} />);
  const regional = screen.getByTestId("audience-report-row-region:region-central");
  expect(regional).toHaveTextContent("Central");
  expect(regional).toHaveTextContent("Regional subject");
  expect(regional).toHaveTextContent("Regional Manager");
  expect(regional).toHaveTextContent("welcomeflow-regional-summary");
  expect(screen.queryByTestId("audience-report-row-facility:facility-1")).not.toBeInTheDocument();

  rerender(<ReportsHistoryPage {...baseProps({
    reportsReviewAudience: "Executive",
    reportReviewListRows: [audienceListRow("Executive")],
  })} />);
  const executive = screen.getByTestId("audience-report-row-executive:all-selected");
  expect(executive).toHaveTextContent("C-Suite Leadership Report");
  expect(executive).toHaveTextContent("Executive subject");
  expect(executive).toHaveTextContent("C-Suite");
  expect(executive).toHaveTextContent("welcomeflow-executive-summary");
  expect(screen.queryByTestId("audience-report-row-region:region-central")).not.toBeInTheDocument();
});

test("repeated audience switching restores Facility rows without stale Regional or Executive metadata", () => {
  const { rerender } = render(<ReportsHistoryPage {...baseProps()} />);
  ["Regional", "Executive", "Regional", "Facility"].forEach((audience) => {
    rerender(<ReportsHistoryPage {...baseProps({
      reportsReviewAudience: audience,
      reportReviewListRows: [audienceListRow(audience)],
    })} />);
  });

  const facility = screen.getByTestId("audience-report-row-facility:facility-1");
  expect(facility).toHaveTextContent("Facility subject");
  expect(facility).toHaveTextContent("Facility Contacts");
  expect(facility).toHaveTextContent("welcomeflow-synthetic-central");
  expect(facility).not.toHaveTextContent("Regional Manager");
  expect(facility).not.toHaveTextContent("C-Suite");
});

test("renders email and attachment details together", () => {
  render(<ReportsHistoryPage {...baseProps()} />);

  expect(screen.getByLabelText("Report recipient")).toHaveTextContent("Facility contacts");
  expect(screen.getByLabelText("Report subject")).toHaveTextContent("Synthetic preview subject");
  expect(screen.getByText("Synthetic preview body")).toBeInTheDocument();
  expect(screen.getByText(/Attachment name:/)).toBeInTheDocument();
  expect(screen.getByLabelText("Workbook tabs")).toHaveTextContent("Summary, Detail");
  expect(screen.getByLabelText("Reporting period")).toHaveTextContent("2026-07-20 to 2026-07-24");
  expect(screen.getByText(/Generated time:/)).toBeInTheDocument();
  expect(screen.getByText(/Data-through time:/)).toBeInTheDocument();
});

test("keeps diagnostic details visible while blocking affected final actions", () => {
  const eligibility = {
    canCreateFinalPreview: false,
    canDownloadWorkbook: false,
    canPrepareEmail: false,
    canMarkReady: false,
    blockingReasons: [{ message: "Ambiguous facility must be resolved." }],
    warnings: [],
  };
  render(<ReportsHistoryPage {...baseProps({
    selectedReportEligibility: eligibility,
    reportingActionState: {
      ...allowedActionState,
      selectedDownloadableReportIds: [],
      selectedEmailReportIds: [],
      selectedReadyReportIds: [],
      selectedMarkReviewedReportIds: [],
      selectedMarkSentReportIds: [],
    },
  })} />);

  expect(screen.getByText("Ambiguous facility must be resolved.")).toBeInTheDocument();
  expect(screen.getByText(/Diagnostic details remain available/)).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Review Report" })[0]).toBeEnabled();
  expect(screen.getByRole("button", { name: "Copy Email Body" })).toBeDisabled();
  expect(screen.getAllByRole("button", { name: "Download Workbook" })[0]).toBeDisabled();
  expect(screen.getByRole("button", { name: "Mark Reviewed" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Mark Sent" })).toBeDisabled();
});

test("missing contact blocks email actions but permits workbook review", () => {
  const eligibility = {
    ...allowedEligibility,
    canPrepareEmail: false,
    canMarkReady: false,
    blockingReasons: [{
      code: "MISSING_REQUIRED_CONTACT",
      issue: "Missing facility contact",
      facilityName: "Synthetic Central Facility",
      facilityId: "facility-1",
      regionName: "Central",
      requisitionNumber: "SYN-1",
      requisitionId: "req-1",
      position: "Registered Nurse",
      currentContactStatus: "No active facility contact configured",
      reason: "A facility contact is required before email preparation or Ready status.",
      resolutionAction: "Add Contact",
    }],
  };
  const props = baseProps({
    selectedReportEligibility: eligibility,
    reportingActionState: {
      ...allowedActionState,
      selectedEmailReportIds: [],
      selectedReadyReportIds: [],
      selectedMarkReviewedReportIds: [],
      selectedMarkSentReportIds: [],
    },
  });
  render(<ReportsHistoryPage {...props} />);

  expect(screen.getByRole("button", { name: "Copy Email Body" })).toBeDisabled();
  expect(screen.getAllByRole("button", { name: "Download Workbook" })[0]).toBeEnabled();
  expect(screen.getByRole("button", { name: "Mark Sent" })).toBeDisabled();
  expect(screen.getByText("Registered Nurse")).toBeInTheDocument();
  expect(screen.getByText("SYN-1")).toBeInTheDocument();
  expect(screen.getByText("req-1")).toBeInTheDocument();
  expect(screen.getByText("No active facility contact configured")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add Contact" }));
  expect(props.openReportingIssueCorrection).toHaveBeenCalledWith(
    eligibility.blockingReasons[0],
    {
      reportsTab: "review-reports",
      audience: "Facility",
      recipientGroup: "Facility contacts",
    },
  );
});

test("mixed downloadable and blocked selections cannot produce a partially scoped workbook", () => {
  const blocked = { ...reportRow, id: "facility-2", facilityId: "facility-2", status: "Blocked" };
  render(<ReportsHistoryPage {...baseProps({
    selectedFacilityActionRows: [reportRow, blocked],
    reportingActionState: {
      ...allowedActionState,
      selectedReportIds: [reportRow.id, blocked.id],
      selectedPreviewableReportIds: [reportRow.id, blocked.id],
      selectedDownloadableReportIds: [reportRow.id],
      selectedEmailReportIds: [reportRow.id],
    },
  })} />);

  expect(screen.getAllByRole("button", { name: "Review Report" })[0]).toBeEnabled();
  expect(screen.getByRole("button", { name: "Copy Email Body" })).toBeDisabled();
  expect(screen.getAllByRole("button", { name: "Download Workbook" })[0]).toBeDisabled();
});

test("renders nonblocking reporting warnings alongside the review details", () => {
  const eligibility = {
    ...allowedEligibility,
    warnings: undefined,
    scopedIssues: [{ issue: "Review source label", detail: "Original facility label differs", blocking: false }],
  };
  render(<ReportsHistoryPage {...baseProps({ selectedReportEligibility: eligibility })} />);

  expect(screen.getByText("Review source label: Original facility label differs")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Download Workbook" })[0]).toBeEnabled();
});

test("copy, download, draft, reviewed, and sent callbacks run only from explicit controls", () => {
  const props = baseProps();
  render(<ReportsHistoryPage {...props} />);

  expect(props.copyReportEmailContent).not.toHaveBeenCalled();
  expect(props.downloadReportReviewWorkbook).not.toHaveBeenCalled();
  expect(props.saveReportsToHistory).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsReviewed).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsSent).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Copy Email Body" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Download Workbook" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Save Draft to History" }));
  fireEvent.click(screen.getByRole("button", { name: "Mark Reviewed" }));
  fireEvent.click(screen.getByRole("button", { name: "Mark Sent" }));

  expect(props.copyReportEmailContent).toHaveBeenCalledWith("Synthetic preview body", "Email body");
  expect(props.downloadReportReviewWorkbook).toHaveBeenCalledTimes(1);
  expect(props.saveReportsToHistory).toHaveBeenCalledWith([reportRow], "Draft Generated");
  expect(props.markSelectedFacilityReportsReviewed).toHaveBeenCalledTimes(1);
  expect(props.markSelectedFacilityReportsSent).toHaveBeenCalledTimes(1);
});

test("Generated Reports opens Sent & History with Drafts selected", () => {
  render(<ReportsHistoryPage {...baseProps({ reportsHubTab: "generated" })} />);
  expect(screen.getByRole("button", { name: "Drafts" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("No report history matches this view.")).toBeInTheDocument();
});

test("preserves legacy history meanings", () => {
  const records = [
    { ...historyRecord, id: "copied", status: "Copied" },
    { ...historyRecord, id: "exported", status: "Exported" },
    { ...historyRecord, id: "completed", status: "Manually Completed" },
  ];
  render(<ReportsHistoryPage {...baseProps({ reportsHubTab: "sent-history", reportHistory: records, reportHistoryFiltered: records })} />);

  expect(screen.getByText("Legacy activity: Copied")).toBeInTheDocument();
  expect(screen.getByText("Legacy activity: Downloaded")).toBeInTheDocument();
  expect(screen.getByText("Legacy status: Completed")).toBeInTheDocument();
});

test("saved history review overrides the current live context and keeps regeneration explicit", () => {
  const liveContext = {
    audience: "Executive",
    recipientGroup: "C-Suite",
    subject: "Current executive subject",
    body: "Current executive body",
    attachmentName: "current-executive.xls",
    attachmentType: "Executive recruiting workbook",
    workbookSheets: [{ name: "Executive Summary" }],
  };
  const props = baseProps({ reportsHubTab: "sent-history", reportReviewContext: liveContext });
  const { rerender } = render(<ReportsHistoryPage {...props} />);

  expect(screen.getAllByText(HISTORICAL_REGENERATION_WARNING).length).toBeGreaterThanOrEqual(2);
  fireEvent.click(screen.getByRole("button", { name: "View Saved Report Details" }));
  expect(props.setReportsHubTab).toHaveBeenCalledWith("ready-review");
  expect(readSavedHistoryTarget(window.location.search)).toBe(historyRecord.id);
  expect(props.downloadHistoricalFacilityReport).not.toHaveBeenCalled();

  rerender(<ReportsHistoryPage {...props} reportsHubTab="ready-review" />);
  expect(screen.getByLabelText("Saved history review mode")).toHaveTextContent(historyRecord.id);
  expect(screen.getByLabelText("Report audience metadata")).toHaveTextContent("Facility");
  expect(screen.getByLabelText("Report recipient")).toHaveTextContent("Synthetic Facility Contact");
  expect(screen.getByLabelText("Report subject")).toHaveTextContent(historyRecord.emailSubject);
  expect(screen.getByText(historyRecord.emailBody)).toBeInTheDocument();
  expect(screen.queryByText("Current executive body")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Attachment name")).toHaveTextContent(historyRecord.attachmentName);
  expect(screen.getByLabelText("Workbook tabs")).toHaveTextContent("Facility Summary, Open Requisitions");
  expect(screen.queryByRole("button", { name: "Mark Sent" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Copy Saved Email Body" }));
  expect(props.safeCopy).toHaveBeenCalledWith(historyRecord.emailBody);
  fireEvent.click(screen.getByRole("button", { name: "Download Current-Data Regenerated Workbook" }));
  expect(props.downloadHistoricalFacilityReport).toHaveBeenCalledWith(historyRecord);
});

test.each(["Facility", "Regional", "Executive"])("reviews the exact saved %s history record", (audience) => {
  const saved = {
    ...historyRecord,
    id: `history-${audience.toLowerCase()}`,
    audience,
    recipient: `${audience} recipient`,
    recipientGroup: `${audience} group`,
    reportType: `${audience} report`,
    emailSubject: `${audience} saved subject`,
    emailBody: `${audience} saved body`,
    attachmentName: `${audience.toLowerCase()}-saved.xls`,
    attachmentType: `${audience} workbook`,
    workbookTabs: [`${audience} Summary`],
  };
  window.history.replaceState({}, "", `/?historyReportId=${saved.id}`);
  render(<ReportsHistoryPage {...baseProps({
    reportHistory: [saved],
    reportHistoryFiltered: [saved],
    reportReviewContext: { audience: "Facility", body: "Live body", workbookSheets: [] },
  })} />);

  expect(screen.getByLabelText("Saved history review mode")).toHaveTextContent(saved.id);
  expect(screen.getByLabelText("Report audience metadata")).toHaveTextContent(audience);
  expect(screen.getByText(`${audience} saved body`)).toBeInTheDocument();
  expect(screen.getByLabelText("Attachment name")).toHaveTextContent(saved.attachmentName);
});

test("switches between saved records without mutating either record", () => {
  const second = { ...historyRecord, id: "history-2", emailSubject: "Second subject", emailBody: "Second body" };
  const records = [historyRecord, second];
  const before = JSON.stringify(records);
  const props = baseProps({ reportsHubTab: "sent-history", reportHistory: records, reportHistoryFiltered: records });
  const { rerender } = render(<ReportsHistoryPage {...props} />);

  fireEvent.click(screen.getAllByRole("button", { name: "View Saved Report Details" })[1]);
  rerender(<ReportsHistoryPage {...props} reportsHubTab="ready-review" />);
  expect(screen.getByText("Second body")).toBeInTheDocument();
  expect(JSON.stringify(records)).toBe(before);
});

test("restores saved history from navigation and shows a clear missing-record state", () => {
  const props = baseProps();
  const { rerender } = render(<ReportsHistoryPage {...props} />);

  window.history.pushState({}, "", `/?historyReportId=${historyRecord.id}`);
  fireEvent.popState(window);
  expect(screen.getByText(historyRecord.emailBody)).toBeInTheDocument();

  window.history.pushState({}, "", "/?historyReportId=missing-history");
  fireEvent.popState(window);
  rerender(<ReportsHistoryPage {...props} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Historical report not found");
  expect(screen.getByRole("alert")).toHaveTextContent("missing-history");
  expect(screen.queryByText("Synthetic preview body")).not.toBeInTheDocument();
});

test("normalizes saved-history review context without changing the source record", () => {
  const source = { ...historyRecord, workbookTabs: undefined, attachmentTabs: "Summary, Detail" };
  const before = JSON.stringify(source);
  expect(savedHistoryReviewContext(source)).toEqual(expect.objectContaining({
    historyRecordId: historyRecord.id,
    reportId: historyRecord.reportId,
    subject: historyRecord.emailSubject,
    body: historyRecord.emailBody,
    workbookTabs: ["Summary", "Detail"],
    includedFacilityIds: ["facility-1"],
  }));
  expect(JSON.stringify(source)).toBe(before);
});

test("Templates & Settings consolidates all six existing settings surfaces without duplicate Report Settings controls", () => {
  const props = baseProps({ reportsHubTab: "templates-settings" });
  render(<ReportsHistoryPage {...props} />);

  [
    ["Open Email Templates", "email-templates"],
    ["Open Recipient Setup", "recipients"],
    ["Open Report Presets", "report-presets"],
    ["Open Workbook Defaults", "workbook-defaults"],
    ["Open No-Openings Policy", "no-openings"],
    ["Open Reporting Automation", "automation"],
  ].forEach(([label, value]) => {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(props.openReportingSettingsSurface).toHaveBeenLastCalledWith(value);
  });
  expect(screen.queryByRole("button", { name: "Report Settings" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("candidates")).toBeChecked();
  expect(screen.getByLabelText("requisitions")).not.toBeChecked();
});

test("rendering and destination navigation do not mutate records or trigger action callbacks", () => {
  const props = baseProps();
  const sourceRows = JSON.stringify(props.selectedFacilityActionRows);
  const sourceHistory = JSON.stringify(props.reportHistory);
  render(<ReportsHistoryPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Sent & History" }));
  fireEvent.click(screen.getByRole("button", { name: "Templates & Settings" }));

  expect(JSON.stringify(props.selectedFacilityActionRows)).toBe(sourceRows);
  expect(JSON.stringify(props.reportHistory)).toBe(sourceHistory);
  expect(props.saveReportsToHistory).not.toHaveBeenCalled();
  expect(props.copyReportEmailContent).not.toHaveBeenCalled();
  expect(props.exportWeeklyFullDataWorkbook).not.toHaveBeenCalled();
  expect(props.downloadHistoricalFacilityReport).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsReviewed).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsSent).not.toHaveBeenCalled();
});
