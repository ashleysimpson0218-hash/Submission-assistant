import {
  GENERATED_COMMUNICATION_TOKENS,
  LEGACY_TOKEN_ALIASES,
  buildCommunicationPreview,
  buildEmploymentDetails,
  normalizeCandidateType,
  normalizeTemplateTokenSyntax,
  renderCommunicationTemplate,
  resolveExactFacility,
  resolveExactRequisition,
} from "./communicationGeneration";

const mockCreateClient = jest.fn();
jest.mock("@supabase/supabase-js", () => ({ createClient: mockCreateClient }));

const TEST_RUNTIME = { environment: "test", projectRef: "bjverobaoujhfaylyrzi" };

function baseRequisition(overrides = {}) {
  return {
    id: "req-1",
    reqNumber: "REQ-100",
    uniqueIdNumber: "UID-100",
    facilityId: "facility-1",
    siteName: "Test Facility",
    positionTitle: "Registered Nurse",
    employmentType: "Full-time",
    benefitsEligible: true,
    fte: 0.9,
    weeklyHours: 36,
    shiftPreference: "Day",
    workSchedule: "Monday-Friday",
    contractDuration: null,
    ...overrides,
  };
}

function baseFacility(overrides = {}) {
  return {
    id: "facility-1",
    siteName: "Test Facility",
    hiringManagerName: "Test Manager",
    hiringManagerEmail: "manager@example.test",
    adminContactName: "Test Administrator",
    adminContactEmail: "admin@example.test",
    additionalHiringManagers: [
      { id: "additional-1", name: "Second Manager", email: "second@example.test" },
      { id: "additional-2", name: "Duplicate Manager", email: "MANAGER@example.test" },
    ],
    ...overrides,
  };
}

function baseIntake(overrides = {}) {
  return {
    candidateType: "External",
    candidateTypeConfirmed: true,
    candidateName: "Synthetic Candidate",
    candidateEmail: "candidate@example.test",
    candidatePhone: "555-0100",
    candidateSource: "Synthetic fixture",
    experience: "Five years",
    education: ["BSN"],
    credentials: ["RN"],
    interviewAvailability: "Weekday mornings",
    finalCompensation: "$40/hour",
    recruiterNotes: "Synthetic test only",
    intakeCompleted: true,
    intakeCompletedAt: "2026-07-17",
    submissionDate: "2026-07-18",
    missingRequiredIntakeFields: [],
    ...overrides,
  };
}

function baseSettings(overrides = {}) {
  const settings = {
    general: { recruiterName: "Test Recruiter", recruiterEmail: "recruiter@example.test" },
    templates: {
      hiringManager: {
        status: "Active",
        subject: "Submission: {candidate_name} | {position} | {facility}",
        body: "Candidate: {candidate_name}\n{employment_details}\nCredentials:\n{credentials}\n{internal_employee_section}\n{rehire_section}",
        conditionalBlocks: {
          rehireSection: "Approved rehire information:",
          internalEmployeeSection: "Approved internal movement information:",
        },
      },
      candidateConfirmation: {
        status: "Active",
        subject: "Submission: {{positionTitle}} | {{facilityName}}",
        body: "Hello {{candidateName}}. {{employmentLanguage}} Benefits: {{benefitsEligible}}. Rate: {{rate}}.",
      },
      atsUpdate: {
        status: "Active",
        subject: "ATS: {candidate_name}",
        body: "Candidate type: {candidate_type}\nFacility: {facility}\nPosition: {position}\nReq Number: {req_number}\n{employment_details}\nCompleted: {intake_completion_date}\nSubmitted: {submission_date}\nCompensation: {final_compensation}",
      },
    },
    textTemplates: [
      { id: "submission-follow-up", status: "Active", body: "Hi {candidate_first_name}, your {position} submission is under review." },
    ],
  };
  return {
    ...settings,
    ...overrides,
    general: { ...settings.general, ...(overrides.general || {}) },
    templates: { ...settings.templates, ...(overrides.templates || {}) },
    textTemplates: overrides.textTemplates || settings.textTemplates,
  };
}

function inputSet(overrides = {}) {
  return {
    runtime: TEST_RUNTIME,
    requisitionId: "req-1",
    requisitions: [baseRequisition()],
    facilities: [baseFacility()],
    intake: baseIntake(),
    positionRequirements: { licenseRequired: true },
    settings: baseSettings(),
    selectedTextTemplateId: "submission-follow-up",
    ...overrides,
  };
}

function immutablePreview(overrides = {}) {
  const inputs = inputSet(overrides);
  const before = JSON.stringify(inputs);
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => Promise.reject(new Error("Network calls are prohibited")));
  mockCreateClient.mockClear();
  const result = buildCommunicationPreview(inputs);
  expect(JSON.stringify(inputs)).toBe(before);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(mockCreateClient).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
  expect(result).not.toHaveProperty("candidateCreated");
  expect(result).not.toHaveProperty("trackerCreated");
  expect(result).not.toHaveProperty("history");
  expect(result).not.toHaveProperty("audit");
  expect(result).not.toHaveProperty("statusChange");
  return result;
}

function codes(result) {
  return result.blockers.map((item) => item.code);
}

describe("side-effect-free communication preview resolver", () => {
  test("scenario 1: External Full-time with benefits, 36 hours, and Day shift", () => {
    const result = immutablePreview();
    expect(result.canConfirm).toBe(true);
    expect(result.rendered.facilityEmail.body).toContain("This is a full-time position scheduled for approximately 36 hours per week.");
    expect(result.rendered.facilityEmail.body).toContain("The assigned shift is Day.");
    expect(result.rendered.facilityEmail.body).toContain("This position is benefits eligible.");
    expect(result.snapshotHash).toMatch(/^fnv1a-[0-9a-f]{8}$/);
  });

  test("scenario 2 and 17: External Full-time with explicit false renders No Benefits", () => {
    const result = immutablePreview({ requisitions: [baseRequisition({ benefitsEligible: false, weeklyHours: null, shiftPreference: "", workSchedule: "" })] });
    expect(result.canConfirm).toBe(true);
    expect(result.snapshot.requisition.benefitsEligible).toBe(false);
    expect(result.rendered.candidateEmail.body).toContain("Benefits: No Benefits");
    expect(result.rendered.candidateEmail.body).toContain("This position is not benefits eligible.");
    expect(codes(result)).not.toContain("BENEFITS_UNCONFIRMED");
  });

  test("scenario 3: External PRN with benefits and As Needed needs no weekly hours", () => {
    const result = immutablePreview({ requisitions: [baseRequisition({ employmentType: "PRN", benefitsEligible: true, weeklyHours: null, fte: null, shiftPreference: "", workSchedule: "As Needed" })] });
    expect(result.canConfirm).toBe(true);
    expect(result.rendered.facilityEmail.body).toContain("This is a PRN position.");
    expect(result.rendered.facilityEmail.body).toContain("Hours are scheduled according to facility needs.");
    expect(result.rendered.facilityEmail.body).not.toContain("not guaranteed");
  });

  test("scenario 4: External Contract with no benefits and 13 Weeks", () => {
    const result = immutablePreview({ requisitions: [baseRequisition({ employmentType: "Contract", benefitsEligible: false, weeklyHours: null, shiftPreference: "", workSchedule: "", contractDuration: "13 Weeks" })] });
    expect(result.canConfirm).toBe(true);
    expect(result.rendered.facilityEmail.body).toContain("This is a contract position with an expected duration of 13 Weeks.");
    expect(result.rendered.facilityEmail.body).toContain("This position is not benefits eligible.");
  });

  test("scenario 5: Internal uses an explicitly Active Internal variant", () => {
    const settings = baseSettings();
    settings.templates.hiringManager.draftVariants = {
      Internal: { status: "Active", subject: "Internal: {candidate_name}", body: "{internal_employee_section}\n{employment_details}", conditionalBlocks: { internalEmployeeSection: "Movement review:" } },
    };
    const result = immutablePreview({
      settings,
      intake: baseIntake({ candidateType: "Internal", currentPosition: "Staff RN", currentFacility: "Current Test Facility", currentManager: "Synthetic Manager", internalMoveType: "Transfer", internalEligibilityStatus: "Approved", currentManagerAware: true, reasonForTransfer: "Synthetic transfer" }),
    });
    expect(result.canConfirm).toBe(true);
    expect(result.rendered.facilityEmail.variantKey).toBe("Internal");
    expect(result.rendered.facilityEmail.body).toContain("Current position: Staff RN");
    expect(result.rendered.facilityEmail.body).toContain("Internal eligibility: Approved");
  });

  test("scenario 6: Internal without an Active Internal variant is blocked", () => {
    const result = immutablePreview({
      intake: baseIntake({ candidateType: "Internal", currentPosition: "Staff RN", currentFacility: "Current Test Facility", internalEligibilityStatus: "Approved" }),
    });
    expect(result.canConfirm).toBe(false);
    expect(result.rendered.facilityEmail.variantKey).toBe("root-comparison");
    expect(codes(result)).toContain("INTERNAL_VARIANT_NOT_APPROVED");
  });

  test("scenario 7: Rehire eligibility and prior employment render separately from Internal", () => {
    const result = immutablePreview({
      intake: baseIntake({ candidateType: "Rehire", previousEmployee: "Yes", previousFacility: "Prior Test Facility", priorEmploymentDates: "2020-2022", rehireEligibility: "Eligible", rehireEligibilityConfirmed: true }),
    });
    expect(result.canConfirm).toBe(true);
    expect(result.rendered.facilityEmail.variantKey).toBe("root+rehire");
    expect(result.rendered.facilityEmail.body).toContain("Previous facility: Prior Test Facility");
    expect(result.rendered.facilityEmail.body).toContain("Rehire eligibility: Eligible");
    expect(result.snapshot.internalEmployee).toBeNull();
  });

  test("scenario 8: Rehire with missing eligibility is blocked", () => {
    const result = immutablePreview({ intake: baseIntake({ candidateType: "Rehire", previousFacility: "Prior Test Facility", rehireEligibility: "", rehireEligibilityConfirmed: false }) });
    expect(result.canConfirm).toBe(false);
    expect(codes(result)).toContain("REHIRE_ELIGIBILITY_MISSING");
  });

  test("scenario 9: Benefits Unknown returns a visible warning and blocker without inference", () => {
    const result = immutablePreview({ requisitions: [baseRequisition({ benefitsEligible: null })] });
    expect(result.canConfirm).toBe(false);
    expect(codes(result)).toContain("BENEFITS_UNCONFIRMED");
    expect(result.warnings.map((item) => item.code)).toContain("BENEFITS_PREVIEW_WARNING");
    expect(result.rendered.candidateEmail.body).toContain("Benefits eligibility has not been confirmed.");
  });

  test("scenario 10: candidate type is never defaulted and must be explicitly confirmed", () => {
    expect(normalizeCandidateType("unknown")).toBe("");
    const missing = immutablePreview({ intake: baseIntake({ candidateType: "", candidateTypeConfirmed: false }) });
    expect(missing.canConfirm).toBe(false);
    expect(codes(missing)).toEqual(expect.arrayContaining(["CANDIDATE_TYPE_INVALID", "CANDIDATE_TYPE_UNCONFIRMED"]));
  });

  test("scenario 11: no valid exact-facility recipient blocks confirmation", () => {
    const result = immutablePreview({ facilities: [baseFacility({ hiringManagerEmail: "", adminContactEmail: "invalid", additionalHiringManagers: [] })] });
    expect(result.canConfirm).toBe(false);
    expect(result.recipients.facility).toEqual({ to: [], cc: [] });
    expect(codes(result)).toContain("FACILITY_RECIPIENT_MISSING");
  });

  test("facility recipients are validated, deduplicated, and never use general recruiter fallback", () => {
    const result = immutablePreview();
    expect(result.recipients.facility.to).toEqual(["manager@example.test", "second@example.test"]);
    expect(result.recipients.facility.cc).toEqual(["admin@example.test"]);
    expect(result.recipients.facility.to).not.toContain("recruiter@example.test");
  });

  test("scenario 12: ambiguous stable requisition ID blocks without fallback matching", () => {
    const duplicate = baseRequisition({ reqNumber: "OTHER", positionTitle: "Other" });
    const result = immutablePreview({ requisitions: [baseRequisition(), duplicate] });
    expect(result.canConfirm).toBe(false);
    expect(codes(result)).toContain("REQUISITION_AMBIGUOUS");
    expect(resolveExactRequisition([baseRequisition()], "").blockers[0].code).toBe("REQUISITION_ID_MISSING");
  });

  test("scenario 13: ambiguous exact facility name blocks when no stable facility ID exists", () => {
    const requisition = baseRequisition({ facilityId: "", siteName: "Test Facility" });
    const facilities = [baseFacility(), baseFacility({ id: "facility-2" })];
    const result = immutablePreview({ requisitions: [requisition], facilities });
    expect(result.canConfirm).toBe(false);
    expect(codes(result)).toContain("FACILITY_AMBIGUOUS");
    expect(resolveExactFacility(facilities, requisition).value).toBeNull();
  });

  test("scenario 14: all required templates inactive creates blockers and no unsafe fallback", () => {
    const settings = baseSettings();
    Object.values(settings.templates).forEach((template) => { template.status = "Inactive"; });
    const result = immutablePreview({ settings });
    expect(result.canConfirm).toBe(false);
    expect(codes(result)).toEqual(expect.arrayContaining(["FACILITY_TEMPLATE_INACTIVE", "TEMPLATE_INACTIVE"]));
    expect(result.rendered.facilityEmail.variantKey).toBe("root");
  });

  test("scenario 15: unsupported legacy token is preserved visibly and blocks", () => {
    const settings = baseSettings({ templates: { candidateConfirmation: { status: "Active", subject: "Test", body: "Pay type: {{payType}}" } } });
    const result = immutablePreview({ settings });
    expect(result.canConfirm).toBe(false);
    expect(result.unresolvedTokens).toContain("{{payType}}");
    expect(result.rendered.candidateEmail.body).toContain("[UNRESOLVED TOKEN: {{payType}}]");
    expect(result.rendered.candidateEmail.body).not.toContain("Pay type: {}");
  });

  test("scenario 16: approved double-brace camelCase aliases render before single braces", () => {
    const template = { subject: "{{candidateName}}", body: "{{facilityName}} | {{positionTitle}} | {{employmentType}} | {{benefitsEligible}} | {{rate}}" };
    const tokens = { candidate_name: "Candidate", facility: "Facility", position: "RN", employment_type: "Full-time", benefits_eligible: "No Benefits", final_compensation: "$40/hour" };
    const { subject, body, unresolvedTokens } = renderCommunicationTemplate(template, tokens);
    expect({ subject, body, unresolvedTokens }).toMatchObject({ subject: "Candidate", body: "Facility | RN | Full-time | No Benefits | $40/hour", unresolvedTokens: [] });
    expect(normalizeTemplateTokenSyntax("{{candidateName}} {candidate_name}")).toBe("{candidate_name} {candidate_name}");
    expect(LEGACY_TOKEN_ALIASES.payType).toBeUndefined();
  });

  test("scenario 18: an empty optional credential section removes its heading", () => {
    const result = immutablePreview({ intake: baseIntake({ credentials: [] }) });
    expect(result.canConfirm).toBe(true);
    expect(result.rendered.facilityEmail.body).not.toContain("Credentials:");
  });

  test("generated token contract contains every Phase 2B.1 token", () => {
    expect(GENERATED_COMMUNICATION_TOKENS).toEqual([
      "benefits_eligible", "benefits_statement", "weekly_hours", "contract_duration", "employment_details", "schedule_statement", "contract_statement",
    ]);
  });

  test("candidate email never substitutes recruiter email", () => {
    const result = immutablePreview({ intake: baseIntake({ candidateEmail: "invalid" }) });
    expect(result.canConfirm).toBe(false);
    expect(result.recipients.candidate.to).toEqual([]);
    expect(codes(result)).toContain("CANDIDATE_EMAIL_INVALID");
  });

  test("ATS restricted tokens remain visible and block sensitive insertion", () => {
    const settings = baseSettings({ templates: { atsUpdate: { status: "Active", subject: "ATS", body: "Employee: {employee_id}\n{rehire_details}" } } });
    const result = immutablePreview({ settings });
    expect(result.canConfirm).toBe(false);
    expect(result.restrictedTokens).toEqual(expect.arrayContaining(["employee_id", "rehire_details"]));
    expect(result.rendered.atsUpdate.body).toContain("[RESTRICTED TOKEN:");
  });

  test("text preview requires an explicit ID and never guesses among stored templates", () => {
    const optional = immutablePreview({ selectedTextTemplateId: "" });
    expect(optional.canConfirm).toBe(true);
    expect(optional.rendered.candidateText).toBeNull();
    expect(optional.warnings.map((item) => item.code)).toContain("TEXT_TEMPLATE_NOT_CONFIGURED");
    const required = immutablePreview({ selectedTextTemplateId: "", textRequired: true });
    expect(required.canConfirm).toBe(false);
    expect(codes(required)).toContain("TEXT_TEMPLATE_REQUIRED");
  });

  test("snapshot is detached and deterministic after creation", () => {
    const first = immutablePreview();
    const second = immutablePreview();
    expect(first.snapshot).not.toBe(second.snapshot);
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.snapshot.requisition).not.toBe(inputSet().requisitions[0]);
  });

  test("runtime guard accepts only the approved test project", () => {
    expect(immutablePreview().canConfirm).toBe(true);
    expect(codes(immutablePreview({ runtime: { environment: "test", projectRef: "qfpgednixvveelgwfylv" } }))).toContain("TEST_RUNTIME_REJECTED");
    expect(codes(immutablePreview({ runtime: { environment: "production", projectRef: "bjverobaoujhfaylyrzi" } }))).toContain("TEST_RUNTIME_REJECTED");
    expect(codes(immutablePreview({ runtime: {} }))).toContain("TEST_RUNTIME_REJECTED");
  });

  test("employment language never infers benefits from hours, FTE, type, shift, or schedule", () => {
    const language = buildEmploymentDetails(baseRequisition({ benefitsEligible: null, employmentType: "Full-time", weeklyHours: 40, fte: 1, shiftPreference: "Day", workSchedule: "Monday-Friday" }));
    expect(language).toContain("Benefits eligibility has not been confirmed.");
    expect(language).not.toContain("This position is benefits eligible.");
  });
});
