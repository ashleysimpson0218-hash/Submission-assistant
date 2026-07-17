import { evaluateRequisitionCommunicationReadiness } from "./communicationReadiness";
import {
  SAFE_REQUISITION_ERROR,
  assertTestRuntime,
  communicationDetailChanges,
  communicationDetailsFromRequisition,
  communicationSummary,
  normalizeBenefitsEligible,
  normalizeWeeklyHours,
  updateExistingRequisitionCommunicationDetails,
} from "./requisitionCommunicationDetails";

const baseReq = {
  id: "req-1",
  reqNumber: "REQ-100",
  uniqueIdNumber: "UNIQUE-100",
  siteName: "Test Facility",
  positionTitle: "Registered Nurse",
  status: "Active",
  employmentType: "Full-time",
  fte: "1.0",
  shiftPreference: "Day",
  workSchedule: "Rotating",
  screeningQuestions: [{ id: "q-1", question: "Test question" }],
  rateInformation: { amount: 50 },
  custom: { nested: { preserved: true } },
};

const readinessSettings = {
  sites: [{ id: "site-1", siteName: "Test Facility", hiringManagerEmail: "test@example.com" }],
  roles: [{ id: "role-1", positionTitle: "Registered Nurse", requiresLicense: true }],
  templates: {},
};

function readiness(req) {
  return evaluateRequisitionCommunicationReadiness({ requisition: req, settings: readinessSettings });
}

describe("requisition Communication Details", () => {
  test("existing requisitions load without new fields", () => {
    expect(communicationDetailsFromRequisition(baseReq)).toMatchObject({ benefitsEligible: null, weeklyHours: null, contractDuration: null });
  });

  test("opening or reviewing does not mutate the record", () => {
    const original = JSON.parse(JSON.stringify(baseReq));
    communicationDetailChanges(baseReq, { ...baseReq, weeklyHours: 36 });
    expect(baseReq).toEqual(original);
  });

  test.each([["Yes", true], ["No", false], ["Unknown", null]])("Benefits %s normalizes correctly", (input, expected) => {
    expect(normalizeBenefitsEligible(input)).toBe(expected);
  });

  test("explicit false is not treated as missing", () => {
    expect(readiness({ ...baseReq, benefitsEligible: false }).issues.some((issue) => issue.field === "Benefits eligibility")).toBe(false);
  });

  test("Full-time plus No Benefits is valid", () => {
    expect(readiness({ ...baseReq, employmentType: "Full-time", benefitsEligible: false }).benefitsEligibility).toBe("no");
  });

  test("PRN plus Benefits is valid and weekly hours is not required", () => {
    const result = readiness({ ...baseReq, employmentType: "PRN", benefitsEligible: true, fte: "", weeklyHours: null, workSchedule: "As Needed" });
    expect(result.benefitsEligibility).toBe("yes");
    expect(result.issues.some((issue) => issue.field === "FTE / weekly hours")).toBe(false);
  });

  test.each([[36, 36], ["36", 36], ["", null], [null, null], ["As Needed", null], [Infinity, null]])("weeklyHours %p normalizes to %p", (input, expected) => {
    expect(normalizeWeeklyHours(input)).toBe(expected);
  });

  test("Contract summary displays duration", () => {
    expect(communicationSummary({ employmentType: "Contract", benefitsEligible: false, contractDuration: "13 Weeks", shiftPreference: "Day" })).toBe("Contract • No Benefits • 13 Weeks • Day");
  });

  test("PRN summary displays benefits and schedule", () => {
    expect(communicationSummary({ employmentType: "PRN", benefitsEligible: true, workSchedule: "As Needed" })).toBe("PRN • Benefits Eligible • As Needed");
  });

  test("saving updates only one existing requisition without duplication", () => {
    const other = { ...baseReq, id: "req-2", reqNumber: "REQ-200" };
    const result = updateExistingRequisitionCommunicationDetails([baseReq, other], "req-1", { ...baseReq, benefitsEligible: false, weeklyHours: 36 });
    expect(result.requisitions).toHaveLength(2);
    expect(result.requisitions[0]).toMatchObject({ benefitsEligible: false, weeklyHours: 36 });
    expect(result.requisitions[1]).toEqual(other);
  });

  test("saving preserves unrelated and nested properties", () => {
    const result = updateExistingRequisitionCommunicationDetails([baseReq], "req-1", { ...baseReq, benefitsEligible: true });
    expect(result.requisition.rateInformation).toEqual(baseReq.rateInformation);
    expect(result.requisition.custom).toEqual(baseReq.custom);
    expect(result.requisition.screeningQuestions).toEqual(baseReq.screeningQuestions);
    expect(result.requisition.reqNumber).toBe(baseReq.reqNumber);
    expect(result.requisition.uniqueIdNumber).toBe(baseReq.uniqueIdNumber);
    expect(result.requisition.siteName).toBe(baseReq.siteName);
    expect(result.requisition.positionTitle).toBe(baseReq.positionTitle);
    expect(result.requisition.status).toBe(baseReq.status);
  });

  test("ambiguous stable ID prevents saving", () => {
    expect(() => updateExistingRequisitionCommunicationDetails([baseReq, { ...baseReq }], "req-1", { ...baseReq, benefitsEligible: true })).toThrow(SAFE_REQUISITION_ERROR);
  });

  test("missing stable ID prevents saving instead of guessing", () => {
    expect(() => updateExistingRequisitionCommunicationDetails([baseReq], "", { ...baseReq, benefitsEligible: true })).toThrow(SAFE_REQUISITION_ERROR);
  });

  test("readiness recalculates and removes the benefits warning after save", () => {
    expect(readiness(baseReq).issues.some((issue) => issue.field === "Benefits eligibility")).toBe(true);
    const saved = updateExistingRequisitionCommunicationDetails([baseReq], "req-1", { ...baseReq, benefitsEligible: false }).requisition;
    expect(readiness(saved).issues.some((issue) => issue.field === "Benefits eligibility")).toBe(false);
  });

  test("audit records configuration fields without candidate data", () => {
    const result = updateExistingRequisitionCommunicationDetails([baseReq], "req-1", { ...baseReq, benefitsEligible: false }, { now: () => "2026-07-17T20:00:00.000Z" });
    expect(result.auditEntry).toMatchObject({ requisitionId: "req-1", reqNumber: "REQ-100", uniqueIdNumber: "UNIQUE-100", facility: "Test Facility", source: "Communication Details", environment: "test" });
    expect(JSON.stringify(result.auditEntry)).not.toMatch(/candidate/i);
  });

  test("the save helper has no candidate, readiness, or output side effects", () => {
    const workspace = { requisitions: [baseReq], candidates: [], tracker: [{ id: "candidate-1", status: "Screening" }], outputs: [] };
    const result = updateExistingRequisitionCommunicationDetails(workspace.requisitions, "req-1", { ...baseReq, benefitsEligible: true });
    expect(workspace.candidates).toEqual([]);
    expect(workspace.tracker).toEqual([{ id: "candidate-1", status: "Screening" }]);
    expect(workspace.outputs).toEqual([]);
    expect(result.requisition).not.toHaveProperty("communicationReadiness");
  });

  test("approved test runtime is accepted", () => {
    expect(assertTestRuntime({ environment: "test", projectRef: "bjverobaoujhfaylyrzi" }).ok).toBe(true);
  });

  test.each([
    { environment: "production", projectRef: "bjverobaoujhfaylyrzi" },
    { environment: "test", projectRef: "qfpgednixvveelgwfylv" },
    { environment: "test", projectRef: "another-project" },
  ])("rejects environment=$environment project=$projectRef", ({ environment, projectRef }) => {
    expect(assertTestRuntime({ environment, projectRef }).ok).toBe(false);
  });
});
