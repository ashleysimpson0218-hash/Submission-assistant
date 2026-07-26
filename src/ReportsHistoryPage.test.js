import { fireEvent, render, screen, within } from "@testing-library/react";
import { ReportsHistoryPage } from "./ReportsHistoryPage";

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

function Card({ action, children, title, subtitle }) {
  return <section aria-label={title}><h2>{title}</h2><div>{subtitle}</div>{action}{children}</section>;
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

function TextInput(props) {
  return <input {...props} />;
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
  canCreateFinalPreview: true,
  canDownloadWorkbook: true,
  canPrepareEmail: true,
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
    TextInput,
    ToggleField,
    THEME,
    activePage: "reporting",
    buildAllFacilityWorkbookSheets: jest.fn(() => [{ name: "Summary" }, { name: "Detail" }]),
    cSuiteEmailBody: jest.fn(() => "Synthetic C-Suite body"),
    copyReportEmailContent: jest.fn(),
    displayDate: jest.fn(() => "Jul 24, 2026"),
    downloadGeneratedFacilityReport: jest.fn(),
    downloadHistoricalFacilityReport: jest.fn(),
    eligibilityForReportRows: jest.fn(() => allowedEligibility),
    exportAtsUpdatePacketExcel: jest.fn(),
    exportFacilityWorkbooks: jest.fn(),
    exportHistoryExcel: jest.fn(),
    exportWeeklyFullDataWorkbook: jest.fn(),
    facilityEmailContent: jest.fn(() => ({
      subject: "Synthetic facility subject",
      body: "Synthetic facility body",
    })),
    facilityReportModel: jest.fn(() => ({
      facility: "Synthetic Central Facility",
      missingContact: false,
    })),
    facilityWorkbookSheets: jest.fn(() => [{ name: "Summary" }]),
    history: [historyRecord],
    isNarrow: false,
    labelFromKey: jest.fn((key) => key),
    openReportAutomationSettings: jest.fn(),
    previewSelectedFacilityReports: jest.fn(),
    regionalEmailBody: jest.fn(() => "Synthetic regional body"),
    reportFacilityNames: ["Synthetic Central Facility"],
    reportHistoryFiltered: [historyRecord],
    reportHistoryFilters: {
      facility: "All",
      reportType: "All",
      status: "All",
      start: "",
      end: "",
    },
    reportInclusions: {
      candidates: true,
      requisitions: false,
    },
    reportTypeOptions: ["Facility Weekly Report"],
    reportsHubTab: "preview",
    safeCopy: jest.fn(),
    saveReportsToHistory: jest.fn(),
    selectedAudienceEmailBody: jest.fn(() => "Synthetic audience body"),
    selectedFacilityActionRows: [reportRow],
    selectedReportEligibility: allowedEligibility,
    selectedReportType: "Facility Weekly Report",
    setReportHistoryFilters: jest.fn(),
    setReportInclusions: jest.fn(),
    setReportsHubTab: jest.fn(),
    setWeeklyReport: jest.fn(),
    setWeeklySubject: jest.fn(),
    weeklyReport: "Synthetic preview body",
    weeklySubject: "Synthetic preview subject",
    ...overrides,
  };
}

const destinations = [
  ["preview", "Report Preview"],
  ["generated", "Generated Reports"],
  ["history", "Report History"],
  ["facility", "Facility Reports"],
  ["regional", "Regional Reports"],
  ["csuite", "C-Suite Reports"],
  ["download", "Download Center"],
  ["email", "Email Preview"],
  ["attachment", "Attachment Preview"],
  ["settings", "Report Settings"],
];

test("preserves every destination label, order, active styling, and navigation callback", () => {
  const props = baseProps({ reportsHubTab: "history" });
  render(<ReportsHistoryPage {...props} />);

  const hub = screen.getByRole("region", { name: "Reports Hub" });
  const buttons = within(hub).getAllByRole("button").slice(1);
  expect(buttons.map((button) => button.textContent)).toEqual(destinations.map(([, label]) => label));
  expect(screen.getByRole("button", { name: "Report History" })).toHaveStyle(`border: 1px solid ${THEME.primary2}`);

  destinations.forEach(([value], index) => {
    fireEvent.click(buttons[index]);
    expect(props.setReportsHubTab).toHaveBeenLastCalledWith(value);
  });
  expect(props.saveReportsToHistory).not.toHaveBeenCalled();
});

test.each([
  ["preview", "Email Preview"],
  ["email", "Email Preview"],
  ["generated", "Generated Reports"],
  ["facility", "Generated Reports"],
  ["regional", "Generated Reports"],
  ["csuite", "Generated Reports"],
  ["history", "Report History"],
  ["download", "Download Center"],
  ["attachment", "Download Center"],
  ["settings", "Report Settings Shortcut"],
])("renders the existing %s destination content", (reportsHubTab, expectedTitle) => {
  const overrides = { reportsHubTab };
  if (reportsHubTab === "regional") overrides.selectedReportType = "Regional Manager Summary";
  if (reportsHubTab === "csuite") overrides.selectedReportType = "C-Suite Leadership Report";
  render(<ReportsHistoryPage {...baseProps(overrides)} />);
  expect(screen.getByRole("heading", { name: expectedTitle })).toBeInTheDocument();
});

test("renders existing preview data and invokes copy or history changes only through explicit controls", () => {
  const props = baseProps();
  const sourceRows = JSON.stringify(props.selectedFacilityActionRows);
  render(<ReportsHistoryPage {...props} />);

  expect(screen.getByText("Synthetic preview body")).toBeInTheDocument();
  expect(props.copyReportEmailContent).not.toHaveBeenCalled();
  expect(props.saveReportsToHistory).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Copy Email" }));
  expect(props.copyReportEmailContent).toHaveBeenCalledWith("Synthetic preview body", "Email body");
  fireEvent.click(screen.getByRole("button", { name: "Copy Subject" }));
  expect(props.copyReportEmailContent).toHaveBeenCalledWith("Synthetic preview subject", "Email subject");
  fireEvent.click(screen.getByRole("button", { name: "Mark Reviewed" }));
  expect(props.saveReportsToHistory).toHaveBeenCalledWith(props.selectedFacilityActionRows, "Reviewed");
  expect(JSON.stringify(props.selectedFacilityActionRows)).toBe(sourceRows);
});

test("keeps preview, copy, and explicit history actions disabled under existing eligibility conditions", () => {
  const props = baseProps({
    selectedFacilityActionRows: [],
    selectedReportEligibility: {
      canCreateFinalPreview: false,
      canDownloadWorkbook: false,
      canPrepareEmail: false,
    },
  });
  render(<ReportsHistoryPage {...props} />);

  expect(screen.getByRole("button", { name: "Preview Email" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Copy Email" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Copy Subject" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Mark Reviewed" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Hold for Approval" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send Later" })).toBeDisabled();
});

test("renders generated facility, regional, and C-Suite models without side effects", () => {
  const facilityProps = baseProps({ reportsHubTab: "facility" });
  const sourceRow = JSON.stringify(reportRow);
  const { rerender } = render(<ReportsHistoryPage {...facilityProps} />);

  expect(screen.getByText("Synthetic Central Facility")).toBeInTheDocument();
  expect(screen.getByText("Synthetic facility subject")).toBeInTheDocument();
  expect(screen.getByText("1 attachment tabs")).toBeInTheDocument();
  expect(facilityProps.downloadGeneratedFacilityReport).not.toHaveBeenCalled();
  expect(facilityProps.saveReportsToHistory).not.toHaveBeenCalled();

  rerender(<ReportsHistoryPage {...baseProps({ reportsHubTab: "regional", selectedReportType: "Regional Manager Summary" })} />);
  expect(screen.getByRole("heading", { name: "Regional Manager Email" })).toBeInTheDocument();
  expect(screen.getByText("Synthetic regional body")).toBeInTheDocument();

  rerender(<ReportsHistoryPage {...baseProps({ reportsHubTab: "csuite", selectedReportType: "C-Suite Leadership Report" })} />);
  expect(screen.getByRole("heading", { name: "C-Suite Leadership Email" })).toBeInTheDocument();
  expect(screen.getByText("Synthetic C-Suite body")).toBeInTheDocument();
  expect(JSON.stringify(reportRow)).toBe(sourceRow);
});

test("renders report history and calls preview, copy, and download only when selected", () => {
  const props = baseProps({ reportsHubTab: "history" });
  const original = JSON.stringify(props.reportHistoryFiltered);
  render(<ReportsHistoryPage {...props} />);

  expect(screen.getByText(historyRecord.reportWeek)).toBeInTheDocument();
  expect(screen.getByText(historyRecord.attachmentName)).toBeInTheDocument();
  expect(props.safeCopy).not.toHaveBeenCalled();
  expect(props.downloadHistoricalFacilityReport).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect(props.safeCopy).toHaveBeenCalledWith(historyRecord.emailBody);
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  expect(props.downloadHistoricalFacilityReport).toHaveBeenCalledWith(historyRecord);
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(props.setWeeklySubject).toHaveBeenCalledWith(historyRecord.emailSubject);
  expect(props.setWeeklyReport).toHaveBeenCalledWith(historyRecord.emailBody);
  expect(props.setReportsHubTab).toHaveBeenCalledWith("email");
  expect(JSON.stringify(props.reportHistoryFiltered)).toBe(original);
});

test("renders download and attachment actions with existing workbook counts and explicit callbacks", () => {
  const props = baseProps({ reportsHubTab: "attachment" });
  render(<ReportsHistoryPage {...props} />);

  expect(screen.getByText("Report-eligible Selected Facilities: 1")).toBeInTheDocument();
  expect(screen.getByText("Attachment Tabs: 2")).toBeInTheDocument();
  expect(props.exportWeeklyFullDataWorkbook).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Download All-Facility Excel" }));
  fireEvent.click(screen.getByRole("button", { name: "Download Facility Excel Files" }));
  fireEvent.click(screen.getByRole("button", { name: "Download History Excel" }));
  fireEvent.click(screen.getByRole("button", { name: "Download ATS Packet Excel" }));
  expect(props.exportWeeklyFullDataWorkbook).toHaveBeenCalledTimes(1);
  expect(props.exportFacilityWorkbooks).toHaveBeenCalledTimes(1);
  expect(props.exportHistoryExcel).toHaveBeenCalledTimes(1);
  expect(props.exportAtsUpdatePacketExcel).toHaveBeenCalledTimes(1);
});

test("renders existing report settings and forwards changes without mutating settings", () => {
  const props = baseProps({ reportsHubTab: "settings" });
  const original = JSON.stringify(props.reportInclusions);
  render(<ReportsHistoryPage {...props} />);

  expect(screen.getByRole("checkbox", { name: "candidates" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "requisitions" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Open Automation Center Report Automation" }));
  expect(props.openReportAutomationSettings).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("checkbox", { name: "requisitions" }));
  expect(props.setReportInclusions).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(props.reportInclusions)).toBe(original);
});
