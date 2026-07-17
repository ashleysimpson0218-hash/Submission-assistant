const { PRODUCTION_PROJECT_REF, buildSanitizedWorkspace, validateSanitizedWorkspace } = require("../scripts/sanitize-welcomeflow-config");

const productionLikeWorkspace = {
  settings: {
    sites: [{ siteName: "Test Facility", hiringManagerName: "Real Manager", hiringManagerEmail: "manager@company.org", hiringManagerPhone: "404-555-9999", notes: "private note" }],
    roles: [{ positionTitle: "Registered Nurse" }],
    requisitions: [{ reqNumber: "REQ-1", positionTitle: "Registered Nurse", siteName: "Test Facility" }],
    contacts: [{ name: "Real Manager", email: "manager@company.org", phone: "404-555-9999", department: "Nursing" }],
    templates: { candidateConfirmation: { subject: "Hello Jane Candidate", body: "Email manager@company.org or 404-555-9999" } },
  },
  tracker: [{ candidate: "Jane Candidate", candidateNotes: "private" }],
  history: [{ candidate: "Jane Candidate" }],
  hotLeads: [{ candidateName: "Jane Candidate" }],
};

test("sanitization refuses the production destination", () => {
  expect(() => buildSanitizedWorkspace(productionLikeWorkspace, PRODUCTION_PROJECT_REF)).toThrow(/Refusing/);
});

test("sanitization retains configuration while excluding candidate data and real contacts", () => {
  const sanitized = buildSanitizedWorkspace(productionLikeWorkspace, "abcdefghijklmnopqrst");
  const scan = validateSanitizedWorkspace(sanitized, ["Jane Candidate"]);
  expect(scan).toEqual({ passed: true, failures: [] });
  expect(sanitized.settings.sites).toHaveLength(1);
  expect(sanitized.settings.roles).toHaveLength(1);
  expect(sanitized.settings.requisitions).toHaveLength(1);
  expect(sanitized.tracker).toEqual([]);
  expect(sanitized.history).toEqual([]);
  expect(JSON.stringify(sanitized)).not.toContain("manager@company.org");
  expect(JSON.stringify(sanitized)).not.toContain("Jane Candidate");
  expect(sanitized.settings.featureFlags.communicationReadinessAudit).toBe(true);
});
