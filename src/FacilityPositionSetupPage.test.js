import { render, screen } from "@testing-library/react";
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
  });

  expect(await screen.findByRole("heading", { name: "Edit Facility" })).toBeInTheDocument();
  expect(await screen.findByTestId("correction-field-facilityContact")).toBeInTheDocument();
  expect(screen.getByTestId("reporting-correction-target")).toHaveTextContent("Add Contact: Synthetic Central Facility");
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(original);
});
