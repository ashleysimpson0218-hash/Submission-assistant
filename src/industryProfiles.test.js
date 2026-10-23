import { applyIndustryProfile, industryProfile, industryScreeningQuestions, mobilePageValue, notesWithIndustryScreening, recruiterSetupSteps, recruiterSetupSummary, resolveIndustryRole, workspaceSaveStatus } from "./industryProfiles";

const existingRole = { id: "existing", positionTitle: "Registered Nurse", requiresCpr: true, status: "Active" };
const original = { roles: [existingRole], options: { roleTypes: ["Healthcare"], workflowRules: { candidateFollowUpDays: 2 } }, sites: [{ id: "site" }], requisitions: [{ id: "req" }], templates: { hiringManager: { body: "Our approved template", useCustom: true } } };

test("industry choice adds roles idempotently without replacing any existing records or workflow settings", () => {
  const before = JSON.stringify(original);
  const trucking = applyIndustryProfile(original, "trucking");
  const repeat = applyIndustryProfile(trucking, "trucking");
  expect(repeat).toEqual(trucking);
  expect(JSON.stringify(original)).toBe(before);
  expect(trucking.roles[0]).toBe(existingRole);
  ["sites", "requisitions", "templates"].forEach((key) => expect(trucking[key]).toBe(original[key]));
  expect(trucking.options.workflowRules).toBe(original.options.workflowRules);
  expect(trucking.options.roleTypes).toEqual(["Healthcare", "Transportation"]);
  const clinical = applyIndustryProfile(trucking, "healthcare");
  expect(clinical.roles).toEqual(expect.arrayContaining(trucking.roles));
  expect(clinical.templates).toBe(original.templates);
});

test("unknown industry is a no-op and an unconfigured workspace does not default to healthcare", () => {
  expect(applyIndustryProfile(original, "invalid")).toBe(original);
  expect(industryProfile({}).id).toBe("general");
});

test("an existing custom role is not overwritten or silently assigned driver prompts", () => {
  const role = { id: "custom", positionTitle: " cdl class a driver ", requiresCpr: true };
  const next = applyIndustryProfile({ roles: [role] }, "trucking");
  expect(next.roles.filter((row) => row.positionTitle.trim().toLowerCase() === "cdl class a driver")).toEqual([role]);
  expect(industryScreeningQuestions(role)).toEqual([]);
});

test("driver prompts are role scoped and do not leak into healthcare or a mismatched requisition", () => {
  const settings = applyIndustryProfile(original, "trucking");
  const driver = settings.roles.find((role) => role.positionTitle === "CDL Class A Driver");
  expect(driver).toMatchObject({ requiresLicense: true, requiresCpr: false, requiresFte: false });
  expect(industryScreeningQuestions(driver)).toHaveLength(7);
  expect(industryScreeningQuestions(existingRole)).toEqual([]);
  expect(industryScreeningQuestions(driver, { positionTitle: "Registered Nurse" })).toEqual([]);
  expect(industryScreeningQuestions(settings.roles.find((role) => role.positionTitle === "Dispatcher")).some((item) => item.id.includes("license-class"))).toBe(false);
  expect(industryScreeningQuestions({ ...driver, positionTitle: "Truck Driver" })).toHaveLength(7);
});

test("industry resolution ignores inactive roles and fails closed for ambiguous active roles", () => {
  const role = { id: "driver", positionTitle: "Truck Driver", status: "Active", industryId: "trucking" };
  expect(resolveIndustryRole({ roles: [{ ...role, id: "old", status: "Inactive", industryId: "healthcare" }, role] }, role.positionTitle)).toBe(role);
  expect(resolveIndustryRole({ roles: [role, { ...role, id: "duplicate" }] }, role.positionTitle)).toEqual({});
});

test("saved screening labels and answers survive serialization and feed notes without changing recruiter notes", () => {
  const role = applyIndustryProfile({}, "trucking").roles[0];
  const questions = industryScreeningQuestions(role);
  const form = JSON.parse(JSON.stringify({ position: role.positionTitle, candidateNotes: "Recruiter observation", industryScreeningContext: { position: role.positionTitle, questions }, siteSpecificAnswers: { [questions[0].id]: "Class A", [questions[3].id]: "Regional" } }));
  const notes = notesWithIndustryScreening(form);
  expect(notes).toContain("Recruiter observation");
  expect(notes).toContain("License class reported by candidate: Class A");
  expect(notes).toContain("Preferred route type: Regional");
  expect(notes).toContain("candidate reported; verify as required");
  expect(form.candidateNotes).toBe("Recruiter observation");
  expect(notesWithIndustryScreening({ ...form, position: "Registered Nurse" })).toBe("Recruiter observation");
});

test.each([
  ["submission", "overview", "submission"], ["workspace", "overview", "workspace"],
  ["hotLegacy", "overview", "hot"], ["reports", "hub", "reporting"],
  ["reports", "review-reports", "reports"], ["learning", "overview", "learning"],
])("mobile navigation retains the active route %s", (page, tab, expected) => expect(mobilePageValue(page, tab)).toBe(expected));

test("saving disabled never claims cloud saved, and errors override earlier success text", () => {
  expect(workspaceSaveStatus({ cloudStatus: "Saved to cloud" }).label).toBe("Session only");
  expect(workspaceSaveStatus({ cloudStatus: "Cloud save paused", cloudEnabled: true, browserEnabled: true }).label).toBe("Save needs attention");
  expect(workspaceSaveStatus({ cloudStatus: "Saved to cloud", cloudEnabled: true }).label).toBe("Cloud connected");
});

test("setup checks distinguish completed information from missing setup", () => {
  const steps = recruiterSetupSteps({ general: { recruiterName: "Example Recruiter", recruiterEmail: "recruiter@example.test", companyName: "Example Company" }, sites: [{ siteName: "Example Site", hiringManagerEmail: "manager@example.test" }], roles: [] });
  expect(steps.find((step) => step.id === "identity").done).toBe(true);
  expect(steps.find((step) => step.id === "locations").done).toBe(true);
  expect(steps.find((step) => step.id === "roles").done).toBe(false);
});

function setupSettings() {
  return {
    general: { recruiterName: " Example Recruiter ", recruiterEmail: "recruiter@example.test", companyName: "Example Company" },
    sites: [{ id: "location-1", siteName: "Example Site", hiringManagerEmail: "manager@example.test", status: "Inactive" }],
    roles: [{ id: "role-1", positionTitle: "Team Assistant", status: "Active" }],
    requisitions: [{ id: "opening-1", reqNumber: "SYN-100", positionTitle: "Team Assistant", siteName: " example site ", status: "Active" }],
    options: { workflowRules: {} },
  };
}

const setupDone = (settings, id) => recruiterSetupSteps(settings).find((step) => step.id === id).done;

test("the shared summary advances through required information and excludes optional timing from progress", () => {
  const settings = setupSettings();
  const empty = recruiterSetupSummary({});
  expect(empty).toMatchObject({ completedCount: 0, totalCount: 4, nextStep: { id: "identity", target: "general" } });
  expect(empty.requiredSteps.map((step) => [step.id, step.target])).toEqual([
    ["identity", "general"], ["locations", "sites"], ["roles", "roles"], ["openings", "requisitions"],
  ]);
  expect(empty.requiredSteps.every((step) => step.required === true)).toBe(true);
  expect(empty.optionalSteps).toEqual([expect.objectContaining({ id: "follow-up", required: false, done: false })]);

  let partial = { general: settings.general };
  expect(recruiterSetupSummary(partial)).toMatchObject({ completedCount: 1, nextStep: { id: "locations" } });
  partial = { ...partial, sites: settings.sites };
  expect(recruiterSetupSummary(partial)).toMatchObject({ completedCount: 2, nextStep: { id: "roles" } });
  partial = { ...partial, roles: settings.roles };
  expect(recruiterSetupSummary(partial)).toMatchObject({ completedCount: 3, nextStep: { id: "openings" } });
  expect(recruiterSetupSummary(settings)).toMatchObject({ completedCount: 4, totalCount: 4, nextStep: null });

  settings.options.workflowRules = { candidateFollowUpDays: 2, managerNudgeDays: "3" };
  expect(recruiterSetupSummary(settings)).toMatchObject({ completedCount: 4, totalCount: 4, nextStep: null, optionalSteps: [expect.objectContaining({ done: true })] });
});

test.each(["recruiterName", "recruiterEmail", "companyName"])("identity stays incomplete when %s is blank or malformed", (field) => {
  for (const value of ["  ", null, 123, {}, []]) {
    const settings = setupSettings();
    settings.general[field] = value;
    expect(setupDone(settings, "identity")).toBe(false);
  }
});

test("a signature is required only when the user explicitly includes a signature line", () => {
  const settings = setupSettings();
  expect(setupDone(settings, "identity")).toBe(true);
  settings.general.includeSignatureLineInEmails = false;
  expect(setupDone(settings, "identity")).toBe(true);
  settings.general.includeSignatureLineInEmails = true;
  settings.general.signOffLine = "  ";
  expect(setupDone(settings, "identity")).toBe(false);
  settings.general.signOffLine = "Example Company Recruiting";
  expect(setupDone(settings, "identity")).toBe(true);
});

test("location information can precede openings even when activity is derived as Inactive", () => {
  const settings = setupSettings();
  settings.requisitions = [];
  expect(setupDone(settings, "locations")).toBe(true);
  expect(setupDone(settings, "openings")).toBe(false);
  settings.sites[0].hiringManagerEmail = " ";
  expect(setupDone(settings, "locations")).toBe(false);
  settings.sites[0].hiringManagerEmail = "manager@example.test";
  settings.sites[0].siteName = " ";
  expect(setupDone(settings, "locations")).toBe(false);
});

test("role information needs an explicitly active named role", () => {
  const settings = setupSettings();
  for (const status of ["Inactive", "Archived", undefined, {}, "  ", " active ", "active", "ACTIVE"]) {
    settings.roles[0].status = status;
    expect(setupDone(settings, "roles")).toBe(false);
  }
  settings.roles[0].status = "Active";
  expect(setupDone(settings, "roles")).toBe(true);
  settings.roles[0].positionTitle = "  ";
  expect(setupDone(settings, "roles")).toBe(false);
});

test.each(["id", "reqNumber", "positionTitle", "siteName"])("an opening linked only by location name cannot complete setup without a usable %s", (field) => {
  for (const value of [undefined, "  ", {}, []]) {
    const settings = setupSettings();
    settings.requisitions[0][field] = value;
    expect(setupDone(settings, "openings")).toBe(false);
  }
});

test("the opening check follows the application's active status rather than unrecognized status labels", () => {
  const settings = setupSettings();
  for (const status of ["Open", "Approved", "Posted", "Closed", "Inactive", {}]) {
    settings.requisitions[0].status = status;
    expect(setupDone(settings, "openings")).toBe(false);
  }
  for (const status of [" active ", undefined, ""]) {
    settings.requisitions[0].status = status;
    expect(setupDone(settings, "openings")).toBe(true);
  }
});

test("an opening needs a unique ID and number and one matching saved location", () => {
  const settings = setupSettings();
  const opening = settings.requisitions[0];
  settings.requisitions.push({ ...opening, reqNumber: "SYN-200" });
  expect(setupDone(settings, "openings")).toBe(false);
  settings.requisitions[1] = { ...opening, id: "opening-2", reqNumber: " syn-100 " };
  expect(setupDone(settings, "openings")).toBe(false);
  settings.requisitions = [opening];
  opening.siteName = "Unconfigured Site";
  expect(setupDone(settings, "openings")).toBe(false);
  opening.siteName = " example site ";
  expect(setupDone(settings, "openings")).toBe(true);
  settings.sites.push({ id: "location-2", siteName: " EXAMPLE SITE " });
  expect(setupDone(settings, "openings")).toBe(false);
});

test("an opening keeps its configured location after a rename through a saved alias", () => {
  const settings = setupSettings();
  settings.sites[0] = { ...settings.sites[0], siteName: "Renamed Site", aliases: ["Example Site"] };
  const before = JSON.stringify(settings);
  expect(recruiterSetupSummary(settings)).toMatchObject({ completedCount: 4, nextStep: null });
  expect(JSON.stringify(settings)).toBe(before);
});

test.each(["facilityId", "siteId"])("an opening can use its stable %s when its location label is old or absent", (field) => {
  const settings = setupSettings();
  settings.sites[0].siteName = "Renamed Site";
  settings.requisitions[0][field] = settings.sites[0].id;
  expect(setupDone(settings, "openings")).toBe(true);
  delete settings.requisitions[0].siteName;
  expect(setupDone(settings, "openings")).toBe(true);
  settings.requisitions[0][field] = "unknown-location";
  expect(setupDone(settings, "openings")).toBe(false);
});

test("ambiguous aliases stay incomplete until the opening has a stable location ID", () => {
  const settings = setupSettings();
  settings.sites = [
    { ...settings.sites[0], siteName: "North Site", aliases: ["Example Site"] },
    { id: "location-2", siteName: "South Site", aliases: ["Example Site"] },
  ];
  expect(setupDone(settings, "openings")).toBe(false);
  settings.requisitions[0].facilityId = "location-1";
  expect(setupDone(settings, "openings")).toBe(true);
  settings.requisitions.push({ ...settings.requisitions[0], id: "opening-2" });
  expect(setupDone(settings, "openings")).toBe(false);
});

test("duplicate source location IDs stay incomplete through name and stable ID resolution", () => {
  const settings = setupSettings();
  settings.sites.push({ ...settings.sites[0], siteName: "Another Site" });
  expect(setupDone(settings, "openings")).toBe(false);
  settings.requisitions[0].facilityId = "location-1";
  expect(setupDone(settings, "openings")).toBe(false);
});

test("an unknown location ID can use a unique saved name or alias consistently with reporting", () => {
  const settings = setupSettings();
  settings.requisitions[0].facilityId = "old-unmapped-id";
  expect(setupDone(settings, "openings")).toBe(true);
  settings.sites[0] = { ...settings.sites[0], siteName: "Renamed Site", aliases: ["Example Site"] };
  expect(setupDone(settings, "openings")).toBe(true);
});

test.each([0, -1, " ", "not a number", "Infinity", Infinity, true, [], {}])("optional follow-up timing rejects unusable values: %p", (value) => {
  const settings = setupSettings();
  settings.options.workflowRules = { candidateFollowUpDays: value, managerNudgeDays: 2 };
  expect(setupDone(settings, "follow-up")).toBe(false);
  settings.options.workflowRules = { candidateFollowUpDays: 2, managerNudgeDays: value };
  expect(setupDone(settings, "follow-up")).toBe(false);
});

test("malformed settings and record collections stay incomplete without throwing or changing saved data", () => {
  for (const settings of [null, [], 7, "settings", { general: [], sites: {}, roles: "Active", requisitions: null, options: { workflowRules: [] } }]) {
    expect(recruiterSetupSummary(settings)).toMatchObject({ completedCount: 0, totalCount: 4, nextStep: { id: "identity" } });
  }
  const settings = setupSettings();
  for (const collection of ["sites", "roles", "requisitions"]) settings[collection].unshift(null, undefined, [], 1, "invalid");
  const before = JSON.stringify(settings);
  expect(recruiterSetupSummary(settings)).toMatchObject({ completedCount: 4, nextStep: null });
  expect(JSON.stringify(settings)).toBe(before);
});
