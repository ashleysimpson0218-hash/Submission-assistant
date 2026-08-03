const { PRODUCTION_PROJECT_REF, buildSanitizedWorkspace, validateSanitizedWorkspace } = require("../scripts/sanitize-welcomeflow-config");

const productionLikeWorkspace = {
  settings: {
    sites: [{ siteName: "Test Facility", hiringManagerName: "Source Manager", hiringManagerEmail: "source.manager@example.test", hiringManagerPhone: "202-555-0110", notes: "private note" }],
    roles: [{ positionTitle: "Registered Nurse" }],
    requisitions: [{ reqNumber: "REQ-1", positionTitle: "Registered Nurse", siteName: "Test Facility" }],
    contacts: [{ name: "Source Manager", email: "source.manager@example.test", phone: "202-555-0110", department: "Nursing" }],
    templates: { candidateConfirmation: { subject: "Hello Source Candidate", body: "Email source.manager@example.test or 202-555-0110" } },
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
  expect(JSON.stringify(sanitized)).not.toContain("source.manager@example.test");
  expect(JSON.stringify(sanitized)).not.toContain("Jane Candidate");
  expect(sanitized.settings.featureFlags.communicationReadinessAudit).toBe(true);
});
