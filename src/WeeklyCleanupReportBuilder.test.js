import { fireEvent, render, screen } from "@testing-library/react";
import WeeklyCleanupReportBuilder from "./WeeklyCleanupReportBuilder";

const settings = {
  sites: [
    { id: "facility-1", siteName: "Burruss Training Center", aliases: ["Burruss CTC"], status: "Active", regionId: "region-1" },
    { id: "facility-2", siteName: "North Center", status: "Active", regionId: "region-1" },
    { id: "facility-3", siteName: "Closed Center", status: "Inactive" },
  ],
  requisitions: [
    { id: "req-1", reqNumber: "REQ-1", uniqueIdNumber: "UID-1", facilityId: "facility-1", siteName: "Burruss Training Center", positionTitle: "RN", fte: "1.0", shiftPreference: "Day", status: "Active" },
  ],
  contacts: [
    { id: "contact-1", name: "Synthetic Director", contactRole: "Regional Director", assignedFacilityIds: ["facility-1"], status: "Active" },
  ],
  reporting: {
    regions: [{ id: "region-1", name: "Synthetic Region", active: true }],
  },
};

const tracker = [{ id: "candidate-1", name: "Synthetic Candidate", facility: "Burruss CTC", requisitionId: "req-1", status: "Active", nextAction: "Follow up" }];

function renderBuilder(overrides = {}) {
  const downloadExcelWorkbook = jest.fn();
  const setSettings = jest.fn();
  render(<WeeklyCleanupReportBuilder settings={settings} setSettings={setSettings} tracker={tracker} hasLoaded downloadExcelWorkbook={downloadExcelWorkbook} {...overrides} />);
  return { downloadExcelWorkbook, setSettings };
}

test("select all active, select visible, and clear all operate on canonical facilities", () => {
  renderBuilder();
  fireEvent.change(screen.getByLabelText("Report Scope"), { target: { value: "selected-facilities" } });
  fireEvent.click(screen.getByRole("button", { name: "Select All Active Facilities" }));
  expect(screen.getByText("Selected Facility Count: 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
  expect(screen.getByText("Selected Facility Count: 0")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Search Facilities"), { target: { value: "Burruss CTC" } });
  fireEvent.click(screen.getByRole("button", { name: "Select All Visible Facilities" }));
  expect(screen.getByText("Selected Facility Count: 1")).toBeInTheDocument();
});

test("clearing columns blocks export until at least one column is selected", () => {
  const { downloadExcelWorkbook } = renderBuilder();
  fireEvent.click(screen.getByRole("button", { name: "Clear All Columns" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Select at least one report column.");
  expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  expect(downloadExcelWorkbook).not.toHaveBeenCalled();
});

test("preview summarizes current scope without rendering candidate details", () => {
  renderBuilder();
  fireEvent.click(screen.getByRole("button", { name: "Preview Report" }));
  expect(screen.getByText("Report Preview")).toBeInTheDocument();
  expect(screen.getAllByText("1", { selector: "strong" }).length).toBeGreaterThan(0);
  expect(screen.getByText(/Summary only/)).toBeInTheDocument();
  expect(screen.queryByText("Synthetic Candidate")).not.toBeInTheDocument();
});

test("export uses the configured workbook and remains a local download callback", () => {
  const { downloadExcelWorkbook } = renderBuilder();
  fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
  expect(downloadExcelWorkbook).toHaveBeenCalledTimes(1);
  const [name, sheets] = downloadExcelWorkbook.mock.calls[0];
  expect(name).toMatch(/welcomeflow-weekly-cleanup-.*\.xls$/);
  expect(sheets.map((sheet) => sheet.name)).toEqual(expect.arrayContaining(["Summary", "Data Quality"]));
});

test("workspace hydration and load errors block report generation", () => {
  const downloadExcelWorkbook = jest.fn();
  const { rerender } = render(<WeeklyCleanupReportBuilder settings={settings} tracker={tracker} hasLoaded={false} downloadExcelWorkbook={downloadExcelWorkbook} />);
  expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  rerender(<WeeklyCleanupReportBuilder settings={settings} tracker={tracker} hasLoaded loadError="WelcomeFlow could not load the current reporting data." downloadExcelWorkbook={downloadExcelWorkbook} />);
  expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  expect(downloadExcelWorkbook).not.toHaveBeenCalled();
});

test("regional contact scope reports only assigned canonical facilities", () => {
  renderBuilder();
  fireEvent.change(screen.getByLabelText("Report Scope"), { target: { value: "regional-contact" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Synthetic Director/ }));
  fireEvent.click(screen.getByRole("button", { name: "Preview Report" }));
  expect(screen.getByText(/Regional Manager or Director · 1 facilities/)).toBeInTheDocument();
});

test("ambiguous aliases leave diagnostic preview available while disabling workbook export", () => {
  const ambiguousSettings = {
    ...settings,
    sites: [
      ...settings.sites,
      { id: "facility-4", siteName: "East Center", aliases: ["Shared Alias"], status: "Active" },
      { id: "facility-5", siteName: "West Center", aliases: ["Shared Alias"], status: "Active" },
    ],
  };
  const { downloadExcelWorkbook } = renderBuilder({ settings: ambiguousSettings });

  expect(screen.getByRole("button", { name: "Export Excel" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Preview Report" }));
  expect(screen.getByText("Diagnostic Preview — Final Output Blocked")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Ambiguous Facility/ })).toBeInTheDocument();
  expect(downloadExcelWorkbook).not.toHaveBeenCalled();
});

test("missing contact does not prevent a local workbook download", () => {
  const { downloadExcelWorkbook } = renderBuilder();

  expect(screen.getByRole("button", { name: "Export Excel" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Export Excel" }));
  expect(downloadExcelWorkbook).toHaveBeenCalledTimes(1);
});

test("grouped issues keep missing shift discoverable after many earlier blockers", () => {
  const manyIssuesSettings = {
    ...settings,
    requisitions: Array.from({ length: 10 }, (_, index) => ({
      id: `req-${index + 1}`,
      reqNumber: `REQ-${index + 1}`,
      uniqueIdNumber: `UID-${index + 1}`,
      facilityId: "facility-1",
      siteName: "Burruss Training Center",
      positionTitle: `Synthetic Role ${index + 1}`,
      fte: "",
      shiftPreference: index === 9 ? "" : "Day",
      status: "Active",
    })),
  };
  renderBuilder({ settings: manyIssuesSettings });

  fireEvent.click(screen.getByRole("button", { name: "Preview Report" }));
  const shiftGroup = screen.getByRole("button", { name: /Missing shift/ });
  expect(shiftGroup).toHaveTextContent("1");
  fireEvent.click(shiftGroup);
  expect(screen.getByText(/Synthetic Role 10/)).toBeInTheDocument();
  expect(screen.getByText(/Next action: Add Shift/)).toBeInTheDocument();
});
