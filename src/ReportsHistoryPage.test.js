import { fireEvent, render, screen, within } from "@testing-library/react";
import { HISTORICAL_REGENERATION_WARNING, ReportsHistoryPage } from "./ReportsHistoryPage";

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

const historyRecord = {
  id: "history-1",
  reportWeek: "2026-07-20 to 2026-07-24",
  generatedDate: "2026-07-24T12:00:00.000Z",
  facility: "Synthetic Central Facility",
  reportType: "Facility Weekly Report",
  audience: "Facility",
  status: "Sent",
  attachmentName: "synthetic-central.xlsx",
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
    downloadHistoricalFacilityReport: jest.fn(),
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
  })} />);

  expect(screen.getByLabelText("Report audience metadata")).toHaveTextContent(audience);
  expect(screen.getByLabelText("Report recipient")).toHaveTextContent(recipientGroup);
  expect(screen.getByLabelText("Report subject")).toHaveTextContent(reportType);
  expect(screen.getByText(body)).toBeInTheDocument();
  expect(screen.getByLabelText("Attachment name")).toHaveTextContent(attachmentName);
  expect(screen.getByLabelText("Attachment type")).toHaveTextContent(`${audience} recruiting workbook`);
});

test("audience controls delegate one synchronized context change and preview passes no click event as rows", () => {
  const props = baseProps();
  render(<ReportsHistoryPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Regional" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Review Report" })[0]);

  expect(props.setReportsReviewAudience).toHaveBeenCalledWith("Regional");
  expect(props.previewSelectedFacilityReports).toHaveBeenCalledWith();
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
    blockingReasons: [{ message: "Missing facility contact." }],
  };
  render(<ReportsHistoryPage {...baseProps({
    selectedReportEligibility: eligibility,
    reportingActionState: {
      ...allowedActionState,
      selectedEmailReportIds: [],
      selectedReadyReportIds: [],
      selectedMarkReviewedReportIds: [],
      selectedMarkSentReportIds: [],
    },
  })} />);

  expect(screen.getByRole("button", { name: "Copy Email Body" })).toBeDisabled();
  expect(screen.getAllByRole("button", { name: "Download Workbook" })[0]).toBeEnabled();
  expect(screen.getByRole("button", { name: "Mark Sent" })).toBeDisabled();
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
  expect(props.exportWeeklyFullDataWorkbook).not.toHaveBeenCalled();
  expect(props.saveReportsToHistory).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsReviewed).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsSent).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Copy Email Body" }));
  fireEvent.click(screen.getAllByRole("button", { name: "Download Workbook" })[0]);
  fireEvent.click(screen.getByRole("button", { name: "Save Draft to History" }));
  fireEvent.click(screen.getByRole("button", { name: "Mark Reviewed" }));
  fireEvent.click(screen.getByRole("button", { name: "Mark Sent" }));

  expect(props.copyReportEmailContent).toHaveBeenCalledWith("Synthetic preview body", "Email body");
  expect(props.exportWeeklyFullDataWorkbook).toHaveBeenCalledTimes(1);
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

test("warns before historical regeneration and distinguishes saved details from current-data regeneration", () => {
  const props = baseProps({ reportsHubTab: "sent-history" });
  render(<ReportsHistoryPage {...props} />);

  expect(screen.getAllByText(HISTORICAL_REGENERATION_WARNING).length).toBeGreaterThanOrEqual(2);
  fireEvent.click(screen.getByRole("button", { name: "View Saved Report Details" }));
  expect(props.setWeeklySubject).toHaveBeenCalledWith(historyRecord.emailSubject);
  expect(props.setWeeklyReport).toHaveBeenCalledWith(historyRecord.emailBody);
  expect(props.setReportsHubTab).toHaveBeenCalledWith("ready-review");
  expect(props.downloadHistoricalFacilityReport).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Regenerate Workbook Using Current Data" }));
  expect(props.downloadHistoricalFacilityReport).toHaveBeenCalledWith(historyRecord);
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
