import { render, screen, waitFor } from "@testing-library/react";
import { FacilityPositionSetupPage } from "./App";

function fixtureSettings() {
  return {
    sites: [{
      id: "facility-1",
      siteName: "Synthetic Central Facility",
      aliases: ["Synthetic Central"],
      regionId: "central",
      status: "Active",
      hiringManagerName: "",
      hiringManagerEmail: "",
      adminContactName: "",
      adminContactEmail: "",
      additionalHiringManagers: [],
      siteSpecificQuestions: [],
    }],
    requisitions: [{
      id: "req-1",
      reqNumber: "SYN-81271",
      uniqueIdNumber: "SYN-UNIQUE-1",
      siteName: "Synthetic Central Facility",
      positionTitle: "Registered Nurse",
      numberOfOpenings: "2",
      status: "Active",
      employmentType: "Full-time",
      fte: "",
      shiftPreference: "",
    }],
    reporting: {
      regions: [{ id: "central", name: "Central", active: true }],
      reportPresets: [],
    },
    contacts: [],
    options: {
      featureFlags: {},
      shiftOptions: ["Day", "Night"],
      requisitionStatusOptions: ["Active", "Filled", "Closed"],
    },
    compensationStructure: { rules: [], enabledDimensions: [] },
    communicationSettings: {},
  };
}

function renderTarget(correctionTarget) {
  const settings = fixtureSettings();
  const original = JSON.stringify(settings);
  const setSettings = jest.fn();
  render(
    <FacilityPositionSetupPage
      settings={settings}
      setSettings={setSettings}
      correctionTarget={correctionTarget}
      onCorrectionSaved={jest.fn()}
      onReturnToFacilityReadiness={jest.fn()}
    />,
  );
  return { settings, original, setSettings };
}

test.each([
  ["Add FTE", "fte"],
  ["Add Shift", "shiftPreference"],
  ["Resolve Facility", "siteName"],
])("%s opens the exact affected requisition and field", async (action, field) => {
  const { settings, original, setSettings } = renderTarget({
    action,
    page: "positions",
    tab: "positions",
    recordType: "requisition",
    recordId: "req-1",
    field,
    label: "SYN-81271",
  });

  expect(await screen.findByRole("heading", { name: "Edit Requisition" })).toBeInTheDocument();
  expect(await screen.findByTestId(`correction-field-${field}`)).toBeInTheDocument();
  expect(screen.getByTestId("reporting-correction-target")).toHaveTextContent(`${action}: SYN-81271`);
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(original);
});

test("Add Contact opens the exact facility contact section without changing source data", async () => {
  const { settings, original, setSettings } = renderTarget({
    action: "Add Contact",
    page: "positions",
    tab: "facilities",
    recordType: "facility",
    recordId: "facility-1",
    field: "facilityContact",
    label: "Synthetic Central Facility",
    sourceContext: {
      facilityId: "facility-1",
      regionName: "Central",
      audience: "Regional",
      missingContactRole: "Regional Manager",
      affectedReportScope: "Regional Manager Summary for Synthetic Central Facility",
    },
  });

  expect(await screen.findByRole("heading", { name: "Edit Facility" })).toBeInTheDocument();
  expect(await screen.findByTestId("correction-field-facilityContact")).toBeInTheDocument();
  expect(screen.getByTestId("reporting-correction-target")).toHaveTextContent("Add Contact: Synthetic Central Facility");
  expect(screen.getByTestId("reporting-correction-source-context")).toHaveTextContent("Facility ID: facility-1");
  expect(screen.getByTestId("reporting-correction-source-context")).toHaveTextContent("Region: Central");
  expect(screen.getByTestId("reporting-correction-source-context")).toHaveTextContent("Audience: Regional");
  expect(screen.getByTestId("reporting-correction-source-context")).toHaveTextContent("Missing role: Regional Manager");
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(original);
});

test.each([
  ["facilities", "Search facilities..."],
  ["positions", "Search facility, position, req #, shift, or status"],
  ["rates", "Search rate rules..."],
])("direct %s navigation opens the usable section without saving", async (navigationTab, searchPlaceholder) => {
  const settings = fixtureSettings();
  const before = JSON.stringify(settings);
  const setSettings = jest.fn();
  render(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab={navigationTab} />);

  expect(await screen.findByPlaceholderText(searchPlaceholder)).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Edit Requisition" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Edit Facility" })).not.toBeInTheDocument();
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(before);
});

test("a navigation prop change switches setup sections without modifying records", async () => {
  const settings = fixtureSettings();
  const before = JSON.stringify(settings);
  const setSettings = jest.fn();
  const { rerender } = render(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab="facilities" />);
  expect(screen.getByPlaceholderText("Search facilities...")).toBeVisible();

  rerender(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab="rates" />);
  expect(await screen.findByPlaceholderText("Search rate rules...")).toBeVisible();
  expect(screen.queryByPlaceholderText("Search facilities...")).not.toBeInTheDocument();

  rerender(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab="positions" />);
  expect(await screen.findByRole("button", { name: "+ Add Requisition" })).toBeVisible();
  expect(screen.queryByPlaceholderText("Search rate rules...")).not.toBeInTheDocument();

  rerender(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab="facilities" />);
  expect(await screen.findByPlaceholderText("Search facilities...")).toBeVisible();
  expect(screen.queryByRole("button", { name: "+ Add Requisition" })).not.toBeInTheDocument();
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(before);
});

test("an exact opening correction remains authoritative over generic section navigation", async () => {
  const settings = fixtureSettings();
  settings.requisitions.push({ ...settings.requisitions[0], id: "req-other", reqNumber: "SYN-OTHER", uniqueIdNumber: "OTHER-OPENING" });
  const before = JSON.stringify(settings);
  const setSettings = jest.fn();
  const correctionTarget = { action: "Complete opening details", recordType: "requisition", recordId: "req-1", tab: "positions", field: "reqNumber", label: "SYN-81271" };
  const { rerender } = render(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab="facilities" correctionTarget={correctionTarget} />);

  expect(await screen.findByRole("heading", { name: "Edit Requisition" })).toBeVisible();
  expect(screen.getByDisplayValue("SYN-UNIQUE-1")).toBeVisible();
  expect(screen.queryByDisplayValue("OTHER-OPENING")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Positions / Requisitions" })).toBeVisible();
  const input = screen.getByTestId("correction-field-reqNumber").querySelector("input");
  await waitFor(() => expect(input).toHaveFocus());

  rerender(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab="rates" correctionTarget={correctionTarget} />);
  expect(screen.getByRole("heading", { name: "Edit Requisition" })).toBeVisible();
  expect(screen.getByDisplayValue("SYN-UNIQUE-1")).toBeVisible();
  expect(screen.getByRole("heading", { name: "Positions / Requisitions" })).toBeVisible();
  expect(screen.queryByPlaceholderText("Search rate rules...")).not.toBeInTheDocument();

  rerender(<FacilityPositionSetupPage settings={settings} setSettings={setSettings} navigationTab="rates" correctionTarget={null} />);
  expect(screen.getByRole("heading", { name: "Positions / Requisitions" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Edit Requisition" })).toBeVisible();
  expect(screen.getByDisplayValue("SYN-UNIQUE-1")).toBeVisible();
  expect(screen.queryByPlaceholderText("Search rate rules...")).not.toBeInTheDocument();
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(before);
});
