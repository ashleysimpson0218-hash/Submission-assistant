import { fireEvent, render, screen } from "@testing-library/react";
import { WeeklyReportingPage } from "./WeeklyReportingPage";
import {
  NO_OPENINGS_POLICIES,
  NO_OPENINGS_WEEKLY_DECISIONS,
} from "./noOpeningFacilityPolicy";

const THEME = {
  amber: "#b45309",
  amberBg: "#fffbeb",
  blueBg: "#eef2ff",
  border: "#c4b5fd",
  borderSoft: "#e9d5ff",
  coralBg: "#fff1f2",
  green: "#15803d",
  muted: "#6b7280",
  panel: "#fff",
  panelAlt: "#faf5ff",
  primary2: "#7c3aed",
  red: "#dc2626",
  shadow: "none",
  text: "#111827",
};

function Button({ children, disabled, onClick, primary, subtle, ...props }) {
  void primary;
  void subtle;
  return <button type="button" disabled={disabled} onClick={onClick} {...props}>{children}</button>;
}

function Card({ children, title, subtitle, action }) {
  return <section><div>{title}</div><div>{subtitle}</div>{action}{children}</section>;
}

function Field({ children, label }) {
  return <label>{label}{children}</label>;
}

function TextInput(props) {
  return <input {...props} />;
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

function Badge({ children }) {
  return <span>{children}</span>;
}

function EmptyState({ children }) {
  return <div>{children}</div>;
}

const allowedEligibility = {
  canViewDraftPreview: true,
  canCreateFinalPreview: true,
  canDownloadWorkbook: true,
  canMarkReady: true,
  canPrepareEmail: true,
  canGenerateReport: true,
};

const emptyActionState = {
  totalReadyReportIds: [],
  totalMarkReviewedReportIds: [],
  totalMarkSentReportIds: [],
  selectedReportIds: [],
  selectedPreviewableReportIds: [],
  selectedDownloadableReportIds: [],
  selectedEmailReportIds: [],
  selectedReadyReportIds: [],
  selectedMarkReviewedReportIds: [],
  selectedMarkSentReportIds: [],
  selectedCount: 0,
  blockerCount: 0,
};

function actionState(overrides = {}) {
  return { ...emptyActionState, ...overrides };
}

const baseRow = {
  id: "facility-1",
  facility: "Synthetic Central Facility",
  facilityId: "facility-1",
  regionName: "Central",
  report: "Weekly",
  reportType: "Facility Weekly Report",
  readiness: "Needs Review",
  readinessIssues: [],
  lastAction: "No action",
  action: "Preview",
  reportActionEligible: true,
};

function baseProps(overrides = {}) {
  return {
    Accordion: ({ children, title }) => <section><div>{title}</div>{children}</section>,
    Badge,
    Button,
    Card,
    EmailDocument: () => null,
    EmptyState,
    Field,
    FileButton: Button,
    MiniStat,
    ReportDetailPanel: () => null,
    ReportTile: () => null,
    SelectInput,
    TextInput,
    ToggleField: () => null,
    THEME,
    activePage: "reports",
    activeReportSection: "",
    allowManualCompletion: true,
    restartWeeklyReview: jest.fn(),
    clearFacilityReportSelection: jest.fn(),
    copySelectedFacilityReports: jest.fn(),
    copyWeeklyReport: jest.fn(),
    displayDate: (value) => value,
    eligibilityForReportRows: jest.fn(() => allowedEligibility),
    excludedReportIds: [],
    expandedReportIssueCode: "",
    exportFacilityWorkbooks: jest.fn(),
    exportSelectedFacilityReports: jest.fn(),
    facilityReportQueueFiltered: [],
    facilityReadinessFilters: {
      search: "",
      regionId: "All Regions",
      readiness: "Needs Action",
      reportType: "All Report Types",
    },
    facilityReadinessIssueGroups: [],
    facilityReadinessMatchingRows: [baseRow],
    facilityReadinessRegions: [{ id: "central", name: "Central" }],
    facilityReadinessRows: [baseRow],
    facilityReadinessSelection: {
      selectedCount: 0,
      hiddenSelectedCount: 0,
    },
    facilityReadinessStatusCounts: {
      "Needs Action": 1,
      Blocked: 0,
      "Needs Review": 1,
      Ready: 0,
      "No Report Required": 0,
      Scheduled: 0,
      Sent: 0,
      All: 1,
    },
    facilityReadinessVisibleRows: [baseRow],
    includedReportRows: [],
    isNarrow: false,
    labelFromKey: (value) => value,
    markSelectedFacilityReportsReviewed: jest.fn(),
    markSelectedFacilityReportsSent: jest.fn(),
    noOpeningsPolicy: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    noOpeningsPolicyDraft: "",
    noOpeningsPolicySelection: NO_OPENINGS_POLICIES.ASK_WEEKLY,
    noOpeningWeeklyDecisions: {},
    openReportReview: jest.fn(),
    openReportingIssueCorrection: jest.fn(),
    previewSelectedFacilityReports: jest.fn(),
    recipientGroupOptions: ["Facility Contacts"],
    reportAutomation: {},
    reportCompletionSummary: { total: 1, done: 0 },
    reportingActionState: emptyActionState,
    reportEndDate: "2026-07-24",
    reportFacilityNames: [],
    reportInclusions: {},
    reportIssueGroups: [],
    reportStartDate: "2026-07-20",
    reportStatusOptions: ["All"],
    reportTypeOptions: ["Facility Weekly Report"],
    reportsTab: "facility-readiness",
    saveReportsToHistory: jest.fn(),
    saveNoOpeningsPolicy: jest.fn(),
    selectAllMatchingFacilityReports: jest.fn(),
    selectAllVisibleFacilityReports: jest.fn(),
    selectedFacilityActionEligibility: allowedEligibility,
    selectedFacilityActionRows: [],
    selectedFacilityPolicyRows: [],
    selectedFacilityReports: [],
    selectedFacility: "All Facilities",
    selectedRecipientGroup: "Facility Contacts",
    selectedReportEligibility: allowedEligibility,
    selectedReportType: "Facility Weekly Report",
    selectedStatusFilter: "All",
    sendReadyFacilityReports: jest.fn(),
    setExpandedReportIssueCode: jest.fn(),
    setFacilityReadinessVisibleLimit: jest.fn(),
    setNoOpeningsPolicyDraft: jest.fn(),
    setReportEndDate: jest.fn(),
    setReportInclusions: jest.fn(),
    setReportStartDate: jest.fn(),
    setReportsTab: jest.fn(),
    setSelectedFacility: jest.fn(),
    setSelectedFacilityReports: jest.fn(),
    setSelectedRecipientGroup: jest.fn(),
    setSelectedReportType: jest.fn(),
    setSelectedStatusFilter: jest.fn(),
    setWeeklyNoOpeningDecision: jest.fn(),
    toggleFacilityReportSelection: jest.fn(),
    undoNoOpeningWeeklyDecision: jest.fn(),
    updateFacilityReadinessFilter: jest.fn(),
    weeklyReport: "",
    weeklySubject: "",
    weeklyReportingBlockerCount: 0,
    weeklyReportingPrimaryAction: {
      label: "View Weekly Summary",
      targetStep: "overview",
      disabled: false,
    },
    ...overrides,
  };
}

test("renders the existing Needs Action default, status counts, search, and filters", () => {
  render(<WeeklyReportingPage {...baseProps()} />);

  expect(screen.getAllByText("Facility Readiness").length).toBeGreaterThan(0);
  expect(screen.getByDisplayValue("Needs Action")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Canonical name, alias, original label, or Facility ID")).toBeInTheDocument();
  expect(screen.getByDisplayValue("All Regions")).toBeInTheDocument();
  expect(screen.getByDisplayValue("All Report Types")).toBeInTheDocument();
  expect(screen.getByText("Needs Review: 1")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Needs Action (1)" })).toBeInTheDocument();
});

test("preserves explicit selection and distinct visible and matching selection callbacks", () => {
  const props = baseProps();
  render(<WeeklyReportingPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Select All Visible (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Select All Matching (1)" }));

  expect(props.selectAllVisibleFacilityReports).toHaveBeenCalledTimes(1);
  expect(props.selectAllMatchingFacilityReports).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Clear Selection" })).toBeDisabled();
});

test("shows hidden selections and count-specific actions without making zero selection mean all", () => {
  const props = baseProps({
    facilityReadinessSelection: { selectedCount: 2, hiddenSelectedCount: 1 },
    selectedFacilityReports: ["facility-1", "facility-hidden"],
    selectedFacilityPolicyRows: [baseRow, { ...baseRow, id: "facility-hidden" }],
    selectedFacilityActionRows: [baseRow],
    reportingActionState: actionState({
      selectedReportIds: ["facility-1", "facility-hidden"],
      selectedPreviewableReportIds: ["facility-1"],
      selectedDownloadableReportIds: ["facility-1"],
      selectedEmailReportIds: ["facility-1"],
      selectedCount: 2,
    }),
  });
  render(<WeeklyReportingPage {...props} />);

  expect(screen.getAllByText(/1 hidden by current filters/).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Preview 1 Selected Report" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Download Combined Workbook" })).toBeEnabled();
  expect(screen.getByText("1 ineligible under the current policy")).toBeInTheDocument();
});

test("renders complete grouped issues, including missing shift, and passes exact correction targets", () => {
  const issues = [
    { code: "AMBIGUOUS_FACILITY", facilityName: "Synthetic Central", originalFacilityLabel: "Central", candidateName: "Synthetic Candidate 004", candidateId: "candidate-4", competingFacilityNames: ["Synthetic Central", "Synthetic East"], competingFacilityIds: ["facility-1", "facility-2"], reason: "Choose the correct canonical facility.", resolutionAction: "Resolve Facility" },
    { code: "MISSING_REQUIRED_FTE", facilityName: "Synthetic Central", canonicalFacilityName: "Synthetic Central", facilityId: "facility-1", regionName: "Central", requisitionId: "req-fte", requisitionNumber: "SYN-1", position: "RN", currentFte: "", missingField: "FTE", reason: "FTE is required.", resolutionAction: "Add FTE" },
    { code: "MISSING_REQUIRED_SHIFT", facilityName: "Synthetic Central", canonicalFacilityName: "Synthetic Central", facilityId: "facility-1", regionName: "Central", requisitionId: "req-shift", requisitionNumber: "SYN-2", position: "LPN", currentShift: "", missingField: "Shift", reason: "Shift is required.", resolutionAction: "Add Shift" },
    { code: "MISSING_REQUIRED_CONTACT", facilityName: "Synthetic Central", canonicalFacilityName: "Synthetic Central", facilityId: "facility-1", regionName: "Central", currentContactStatus: "No active facility contact configured", missingField: "Contact", reason: "A contact is required.", resolutionAction: "Add Contact" },
  ];
  const props = baseProps({
    expandedReportIssueCode: "blockers",
    facilityReadinessIssueGroups: [{
      code: "blockers",
      label: "Reporting blockers",
      count: issues.length,
      blocking: true,
      issues,
    }],
  });
  render(<WeeklyReportingPage {...props} />);

  expect(screen.getByText(/Req SYN-2.*Shift/)).toBeInTheDocument();
  expect(screen.getByText("Synthetic Candidate 004")).toBeInTheDocument();
  expect(screen.getByText("candidate-4")).toBeInTheDocument();
  expect(screen.getByText("Synthetic Central, Synthetic East")).toBeInTheDocument();
  expect(screen.getByText("req-fte")).toBeInTheDocument();
  expect(screen.getAllByText("Not set").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("No active facility contact configured")).toBeInTheDocument();
  for (const issue of issues) {
    fireEvent.click(screen.getByRole("button", { name: issue.resolutionAction }));
  }
  expect(props.openReportingIssueCorrection.mock.calls.map(([issue]) => issue)).toEqual(issues);
});

test("row remediation actions do not truncate Add Contact behind FTE and shift issues", () => {
  const readinessIssues = [
    { code: "MISSING_REQUIRED_FTE", resolutionAction: "Add FTE", requisitionId: "req-1" },
    { code: "MISSING_REQUIRED_SHIFT", resolutionAction: "Add Shift", requisitionId: "req-1" },
    { code: "MISSING_REQUIRED_CONTACT", resolutionAction: "Add Contact", facilityId: "facility-1" },
  ];
  const row = { ...baseRow, readinessIssues, readiness: "Blocked" };
  const props = baseProps({
    facilityReadinessRows: [row],
    facilityReadinessVisibleRows: [row],
    facilityReadinessMatchingRows: [row],
  });
  render(<WeeklyReportingPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Add FTE" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Shift" }));
  fireEvent.click(screen.getByRole("button", { name: "Add Contact" }));

  expect(props.openReportingIssueCorrection.mock.calls.map(([issue]) => issue)).toEqual(readinessIssues);
});

test("keeps diagnostic issue detail available while final actions obey eligibility", () => {
  const blockedEligibility = {
    ...allowedEligibility,
    canCreateFinalPreview: false,
    canDownloadWorkbook: false,
    canMarkReady: false,
  };
  const props = baseProps({
    expandedReportIssueCode: "ambiguous",
    facilityReadinessIssueGroups: [{
      code: "ambiguous",
      label: "Ambiguous facilities",
      count: 1,
      blocking: true,
      issues: [{ code: "ambiguous", originalFacilityLabel: "Synthetic Shared", detail: "Choose a canonical facility." }],
    }],
    selectedFacilityActionEligibility: blockedEligibility,
    selectedFacilityActionRows: [baseRow],
    selectedFacilityPolicyRows: [baseRow],
    selectedFacilityReports: ["facility-1"],
    reportingActionState: actionState({
      selectedReportIds: ["facility-1"],
      selectedPreviewableReportIds: ["facility-1"],
      selectedCount: 1,
      blockerCount: 1,
    }),
  });
  render(<WeeklyReportingPage {...props} />);

  expect(screen.getAllByText("Synthetic Shared").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Choose a canonical facility.").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: "Preview 1 Selected Report" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Download Combined Workbook" })).toBeDisabled();
});

test("preserves session-only no-opening decisions and status labels", () => {
  const noOpeningRow = {
    ...baseRow,
    noOpeningOutcome: { applies: true },
    noOpeningOutcomeLabel: "Weekly Decision Needed",
  };
  const props = baseProps({
    facilityReadinessRows: [noOpeningRow],
    facilityReadinessVisibleRows: [noOpeningRow],
    facilityReadinessMatchingRows: [noOpeningRow],
  });
  const { rerender } = render(<WeeklyReportingPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Create Standard Report This Week" }));
  fireEvent.click(screen.getByRole("button", { name: "No Report Needed This Week" }));
  expect(props.setWeeklyNoOpeningDecision).toHaveBeenNthCalledWith(1, "facility-1", NO_OPENINGS_WEEKLY_DECISIONS.CREATE_STANDARD_REPORT);
  expect(props.setWeeklyNoOpeningDecision).toHaveBeenNthCalledWith(2, "facility-1", NO_OPENINGS_WEEKLY_DECISIONS.NO_REPORT_NEEDED);

  rerender(<WeeklyReportingPage {...baseProps({
    facilityReadinessRows: [noOpeningRow],
    facilityReadinessVisibleRows: [noOpeningRow],
    facilityReadinessMatchingRows: [noOpeningRow],
    noOpeningWeeklyDecisions: { "facility-1": NO_OPENINGS_WEEKLY_DECISIONS.CREATE_STANDARD_REPORT },
    undoNoOpeningWeeklyDecision: props.undoNoOpeningWeeklyDecision,
  })} />);
  fireEvent.click(screen.getByRole("button", { name: "Undo Weekly Decision" }));
  expect(props.undoNoOpeningWeeklyDecision).toHaveBeenCalledWith("facility-1");
});

test("keeps weekly no-opening decisions visible when another blocker still wins", () => {
  const blockedNoOpeningRow = {
    ...baseRow,
    readiness: "Blocked",
    noOpeningOutcome: { applies: true },
    noOpeningOutcomeLabel: "Weekly Decision Needed",
    readinessIssues: [{
      code: "missing-contact",
      message: "Missing facility contact",
      resolutionAction: "Add Contact",
      facilityId: "facility-1",
    }],
  };
  const props = baseProps({
    facilityReadinessRows: [blockedNoOpeningRow],
    facilityReadinessVisibleRows: [blockedNoOpeningRow],
    facilityReadinessMatchingRows: [blockedNoOpeningRow],
  });
  render(<WeeklyReportingPage {...props} />);

  expect(screen.getByText("Weekly Decision Needed")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create Standard Report This Week" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "No Report Needed This Week" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add Contact" })).toBeInTheDocument();
});

test("Review Report delegates the exact stable report row for deterministic deep linking", () => {
  const props = baseProps({
    facilityReadinessRows: [baseRow],
    facilityReadinessVisibleRows: [baseRow],
    facilityReadinessMatchingRows: [baseRow],
  });
  render(<WeeklyReportingPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Review Report" }));

  expect(props.openReportReview).toHaveBeenCalledWith(baseRow);
  expect(props.previewSelectedFacilityReports).not.toHaveBeenCalled();
});

test("uses plural preview wording when two eligible reports are selected", () => {
  const second = { ...baseRow, id: "facility-2", facilityId: "facility-2", facility: "Synthetic South" };
  render(<WeeklyReportingPage {...baseProps({
    selectedFacilityReports: [baseRow.id, second.id],
    selectedFacilityPolicyRows: [baseRow, second],
    selectedFacilityActionRows: [baseRow, second],
    facilityReadinessSelection: { selectedCount: 2, hiddenSelectedCount: 0 },
    reportingActionState: actionState({
      selectedReportIds: [baseRow.id, second.id],
      selectedPreviewableReportIds: [baseRow.id, second.id],
      selectedCount: 2,
    }),
  })} />);

  expect(screen.getByRole("button", { name: "Preview 2 Selected Reports" })).toBeInTheDocument();
});

test("rendering and navigation do not mutate source rows or create hidden status changes", () => {
  const row = { ...baseRow, readinessIssues: [] };
  const original = JSON.stringify(row);
  const props = baseProps({
    facilityReadinessRows: [row],
    facilityReadinessVisibleRows: [row],
    facilityReadinessMatchingRows: [row],
    selectedFacilityActionRows: [row],
    selectedFacilityPolicyRows: [row],
    selectedFacilityReports: [row.id],
    reportingActionState: actionState({
      selectedReportIds: [row.id],
      selectedPreviewableReportIds: [row.id],
      selectedDownloadableReportIds: [row.id],
      selectedEmailReportIds: [row.id],
      selectedCount: 1,
    }),
  });
  render(<WeeklyReportingPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Preview 1 Selected Report" }));
  fireEvent.click(screen.getByRole("button", { name: "Download Combined Workbook" }));

  expect(JSON.stringify(row)).toBe(original);
  expect(props.previewSelectedFacilityReports).toHaveBeenCalledTimes(1);
  expect(props.exportSelectedFacilityReports).toHaveBeenCalledTimes(1);
  expect(props.markSelectedFacilityReportsReviewed).not.toHaveBeenCalled();
});

test("header and Ready action use the same canonical Ready set", () => {
  render(<WeeklyReportingPage {...baseProps({
    reportsTab: "review-reports",
    selectedFacilityReports: [baseRow.id],
    selectedFacilityPolicyRows: [baseRow],
    selectedFacilityActionRows: [baseRow],
    reportingActionState: actionState({
      selectedReportIds: [baseRow.id],
      selectedPreviewableReportIds: [baseRow.id],
      selectedDownloadableReportIds: [baseRow.id],
      selectedCount: 1,
    }),
  })} />);

  expect(screen.getByText("0 Ready")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Review 0 Ready Reports" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Preview 1 Selected Report" })).toBeEnabled();
});

test("mixed selections expose exact transition counts without making ineligible rows Ready", () => {
  const ready = { ...baseRow, id: "facility-ready", facilityId: "facility-ready", readiness: "Ready", status: "Ready" };
  const blocked = { ...baseRow, id: "facility-blocked", facilityId: "facility-blocked", readiness: "Blocked", status: "Blocked" };
  render(<WeeklyReportingPage {...baseProps({
    reportsTab: "review-reports",
    selectedFacilityReports: [ready.id, blocked.id],
    selectedFacilityPolicyRows: [ready, blocked],
    selectedFacilityActionRows: [ready, blocked],
    reportingActionState: actionState({
      totalReadyReportIds: [ready.id],
      totalMarkReviewedReportIds: [ready.id],
      selectedReportIds: [ready.id, blocked.id],
      selectedPreviewableReportIds: [ready.id, blocked.id],
      selectedDownloadableReportIds: [ready.id],
      selectedEmailReportIds: [ready.id],
      selectedReadyReportIds: [ready.id],
      selectedMarkReviewedReportIds: [ready.id],
      selectedCount: 2,
      blockerCount: 1,
    }),
  })} />);

  expect(screen.getByText("1 Ready")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Review 1 Ready Reports" })).toBeEnabled();
  expect(screen.getByText(/2 selected · 2 available for diagnostic preview · 1 downloadable · 1 ready · 1 eligible to mark reviewed · 0 eligible to mark sent/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Download Combined Workbook" })).toBeDisabled();
});

test("renders the five-step workflow in order with the active step and exact scope", () => {
  render(<WeeklyReportingPage {...baseProps()} />);

  const labels = ["Overview", "Candidate & ATS Cleanup", "Facility Readiness", "Review Reports", "Send & Export"];
  labels.forEach((label) => expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /Facility Readiness/ })).toHaveAttribute("aria-current", "step");
  expect(screen.getByRole("note")).toHaveTextContent("Canonical facilities with report-period activity or a required weekly reporting decision.");
  expect(screen.getByText("Step 3 of 5")).toBeInTheDocument();
});

test("context action and step controls navigate without running report actions", () => {
  const props = baseProps({
    weeklyReportingPrimaryAction: {
      label: "Continue: Fix 2 Blockers",
      targetStep: "facility-readiness",
      disabled: false,
    },
  });
  render(<WeeklyReportingPage {...props} />);

  fireEvent.click(screen.getByRole("button", { name: "Continue: Fix 2 Blockers" }));
  fireEvent.click(screen.getByRole("button", { name: /Review Reports/ }));

  expect(props.setReportsTab).toHaveBeenNthCalledWith(1, "facility-readiness");
  expect(props.setReportsTab).toHaveBeenNthCalledWith(2, "review-reports");
  expect(props.previewSelectedFacilityReports).not.toHaveBeenCalled();
  expect(props.exportSelectedFacilityReports).not.toHaveBeenCalled();
  expect(props.markSelectedFacilityReportsReviewed).not.toHaveBeenCalled();
});

test("keeps Restart Weekly Review in More and delegates the confirmed reset", () => {
  const props = baseProps();
  render(<WeeklyReportingPage {...props} />);

  expect(screen.getByText("More")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Restart Weekly Review" }));
  expect(props.restartWeeklyReview).toHaveBeenCalledTimes(1);
});
