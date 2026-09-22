import { applyIndustryProfile, industryProfile, industryScreeningQuestions, mobilePageValue, notesWithIndustryScreening, recruiterSetupSteps, resolveIndustryRole, workspaceSaveStatus } from "./industryProfiles";

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
