import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FacilityPositionSetupPage, SettingsPanel, resolveSetupIssueTarget, setupIssuesFor } from "./App";

function fixtureSettings() {
  return {
    general: {},
    sites: [{ id: "site-synthetic", siteName: "Synthetic North Office", status: "Active", aliases: [], additionalHiringManagers: [], siteSpecificQuestions: [] }],
    requisitions: [
      { id: "req-other", reqNumber: "SYN-100", positionTitle: "Office Coordinator", siteName: "Synthetic North Office", status: "Active", numberOfOpenings: "1", uniqueIdNumber: "OTHER-OPENING" },
      { id: "req-target", reqNumber: "SYN-200", positionTitle: "Team Assistant", siteName: "Synthetic North Office", status: "Active", numberOfOpenings: "1", uniqueIdNumber: "TARGET-OPENING" },
    ],
    roles: [],
    contacts: [],
    reporting: { regions: [], reportPresets: [] },
    options: { featureFlags: {}, workflowRules: {}, shiftOptions: ["Day"], requisitionStatusOptions: ["Active", "Filled", "Closed"] },
    compensationStructure: { rules: [], enabledDimensions: [] },
    communicationSettings: {},
  };
}

function SetupRepairHarness({ settings, setSettings }) {
  const [target, setTarget] = useState(null);
  const [error, setError] = useState("");
  if (target) return <FacilityPositionSetupPage settings={settings} setSettings={setSettings} correctionTarget={target} />;
  return <>
    {error ? <div role="alert">{error}</div> : null}
    <SettingsPanel
      activeSettingsTab="general"
      setActiveSettingsTab={jest.fn()}
      settings={settings}
      setSettings={setSettings}
      updateSettings={jest.fn()}
      activeRoles={settings.roles}
      activeSites={settings.sites}
      onOpenSetupIssue={(issue) => {
        const resolution = resolveSetupIssueTarget(issue, settings);
        if (resolution.ok) setTarget(resolution.target);
        else setError(resolution.error);
      }}
    />
  </>;
}

function renderSetup(settings = fixtureSettings()) {
  const setSettings = jest.fn();
  const before = JSON.stringify(settings);
  render(<SetupRepairHarness settings={settings} setSettings={setSettings} />);
  return { setSettings, before };
}

test.each([
  ["reqNumber", "Team Assistant at Synthetic North Office needs an opening number."],
  ["positionTitle", "Opening SYN-200 needs a job title."],
  ["siteName", "Opening SYN-200 needs a location."],
])("the rendered %s warning opens and focuses that field on the exact opening", async (field, message) => {
  const settings = fixtureSettings();
  settings.requisitions[1][field] = "  ";
  const { setSettings, before } = renderSetup(settings);

  expect(screen.getByText(message)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: `Fix opening: ${message}` }));

  expect(await screen.findByRole("heading", { name: "Edit Requisition" })).toBeVisible();
  expect(screen.getByDisplayValue("TARGET-OPENING")).toBeVisible();
  expect(screen.queryByDisplayValue("OTHER-OPENING")).not.toBeInTheDocument();
  const fieldContainer = screen.getByTestId(`correction-field-${field}`);
  await waitFor(() => expect(fieldContainer.contains(document.activeElement)).toBe(true));
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(before);
});

test("a brand-new workspace explains the missing opening and opens the add-opening screen", async () => {
  const settings = fixtureSettings();
  settings.requisitions = [];
  settings.sites = [];
  const { setSettings, before } = renderSetup(settings);

  expect(screen.getByText(/No active openings are set up yet/)).toBeVisible();
  expect(screen.queryByText("Details present")).not.toBeInTheDocument();
  expect(screen.queryByText(/Setup looks ready/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Open openings:/ }));

  expect(await screen.findByRole("heading", { name: "Positions / Requisitions" })).toBeVisible();
  expect(screen.getByRole("button", { name: "+ Add Requisition" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Edit Requisition" })).not.toBeInTheDocument();
  expect(screen.queryByTestId("reporting-correction-target")).not.toBeInTheDocument();
  expect(setSettings).not.toHaveBeenCalled();
  expect(JSON.stringify(settings)).toBe(before);
});

test("archived openings alone do not satisfy the active-opening check", () => {
  const settings = fixtureSettings();
  settings.requisitions.forEach((req) => { req.status = "Closed"; });
  renderSetup(settings);
  expect(screen.getByText(/No active openings are set up yet/)).toBeVisible();
  expect(screen.queryByText("Details present")).not.toBeInTheDocument();
});

test("complete opening details state the limited scope of the check", () => {
  renderSetup();
  expect(screen.getByText("Details present")).toBeVisible();
  expect(screen.getByText(/Account access, communication settings, and security still need their own checks/)).toBeVisible();
  expect(screen.queryByText(/Setup looks ready/)).not.toBeInTheDocument();
  expect(screen.getByText("Setup progress")).toBeVisible();
});

test("issues after the first three remain visible and repairable", async () => {
  const settings = fixtureSettings();
  settings.requisitions[0].reqNumber = "";
  settings.requisitions[0].positionTitle = "";
  settings.requisitions[0].siteName = "";
  settings.requisitions[1].positionTitle = "";
  renderSetup(settings);

  const laterMessage = "Opening SYN-200 needs a job title.";
  expect(screen.queryByText(laterMessage)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show all 4 issues" }));
  expect(screen.getByText(laterMessage)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: `Fix opening: ${laterMessage}` }));
  expect(await screen.findByRole("heading", { name: "Edit Requisition" })).toBeVisible();
  expect(screen.getByDisplayValue("TARGET-OPENING")).toBeVisible();
});

test.each(["missing", "stale", "duplicate"])("a %s record ID cannot open a different opening", (caseName) => {
  const settings = fixtureSettings();
  settings.requisitions[1].positionTitle = "";
  const issue = setupIssuesFor(settings).find((item) => item.req?.id === "req-target");
  if (caseName === "missing") issue.req = { ...issue.req, id: undefined };
  if (caseName === "stale") settings.requisitions = settings.requisitions.filter((req) => req.id !== "req-target");
  if (caseName === "duplicate") settings.requisitions.push({ ...settings.requisitions[1], uniqueIdNumber: "DUPLICATE-OPENING" });

  const resolution = resolveSetupIssueTarget(issue, settings);
  expect(resolution.ok).toBe(false);
  expect(resolution.error).toBeTruthy();
  expect(resolution.target).toBeUndefined();
});
