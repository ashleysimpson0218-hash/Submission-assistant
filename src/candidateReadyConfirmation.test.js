/* eslint-disable jest/valid-title */
import {
  REVIEW_ACKNOWLEDGMENT,
  STALE_REVIEW_MESSAGE,
  TEST_ACTION_ACKNOWLEDGMENT,
  applyCandidateReadyConfirmation,
  buildCommunicationReleaseStates,
  buildConfirmedSubmissionPackage,
  compareReviewedPreview,
  confirmationIsIdempotent,
  findCandidateForConfirmation,
  validateCandidateReadyEligibility,
} from "./candidateReadyConfirmation";

const runtime = { environment: "test", projectRef: "bjverobaoujhfaylyrzi" };
const acknowledgments = { reviewed: true, testAction: true };

function preview(overrides = {}) {
  const base = {
    canConfirm: true,
    blockers: [],
    warnings: [],
    snapshotHash: "fnv1a-reviewed",
    snapshot: {
      requisition: { requisitionId: "req-1", reqNumber: "REQ-1", uniqueIdNumber: "UID-1", facility: "Synthetic Facility", facilityId: "site-1", position: "Registered Nurse", employmentType: "Full-time", benefitsEligible: false, weeklyHours: 36, shiftPreference: "Day" },
      intake: { candidateType: "External", candidateTypeConfirmed: true, candidateName: "Jordan Ready Test", candidateEmail: "jordan.ready.test@example.com", candidatePhone: "(404) 555-0142", candidateSource: "TEST ONLY", intakeCompleted: true },
      facility: { facilityId: "site-1", facilityName: "Synthetic Facility" },
      templateSettings: {
        templates: {
          hiringManager: { draftVariants: { External: { id: "facility-external", version: 2, status: "Active", baseHash: "root-a" } } },
          candidateConfirmation: { draftVariants: { External: { id: "candidate-external", version: 2, status: "Active", baseHash: "root-b" } } },
          atsUpdate: { draftVariants: { Standard: { id: "ats-standard", version: 2, status: "Active", baseHash: "root-c" } } },
        },
        communicationTemplateDrafts: { textTemplates: { External: { id: "text-external", version: 2, status: "Active", baseHash: "root-d" } } },
      },
    },
    recipients: { facility: { to: ["manager@example.test"], cc: ["admin@example.test"] }, candidate: { to: ["jordan.ready.test@example.com"] } },
    rendered: {
      facilityEmail: { templateKey: "hiringManager", variantKey: "External", subject: "Facility subject", body: "Exact facility body", releaseCondition: "candidateReadyConfirmed" },
      candidateEmail: { templateKey: "candidateConfirmation", variantKey: "External", subject: "Candidate subject", body: "Exact candidate body", releaseCondition: "facilitySubmissionSent" },
      candidateText: { templateKey: "text-external", variantKey: "External", body: "Exact text", releaseCondition: "facilitySubmissionSent" },
      atsUpdate: { templateKey: "atsUpdate", variantKey: "Standard", subject: "ATS subject", body: "Exact ATS body", releaseCondition: "facilitySubmissionSent" },
    },
    unresolvedTokens: [],
    restrictedTokens: [],
  };
  return { ...base, ...overrides };
}

function confirmArgs(overrides = {}) {
  const reviewedPreview = preview();
  return {
    records: [],
    history: [],
    reviewedPreview,
    freshPreview: preview(),
    runtime,
    acknowledgments,
    identity: { intakeId: "intake-jordan", email: "jordan.ready.test@example.com", phone: "(404) 555-0142", requisitionId: "req-1" },
    intakeForm: { candidateNotes: "TEST ONLY — Phase 2D acceptance", rateCalculationSnapshot: { finalRate: "42" } },
    now: "2026-07-18T20:00:00.000Z",
    ...overrides,
  };
}

test("confirmation copy and action states are exact", () => {
  expect(REVIEW_ACKNOWLEDGMENT).toMatch(/^I reviewed the candidate/);
  expect(TEST_ACTION_ACKNOWLEDGMENT).toContain("It will not send or copy any communication.");
  expect(buildCommunicationReleaseStates()).toEqual({
    facilitySubmission: "Ready to Send",
    candidateConfirmation: "Locked — Awaiting Facility Submission Sent",
    candidateFollowUpText: "Locked — Awaiting Facility Submission Sent",
    atsSubmissionUpdate: "Locked — Awaiting Facility Submission Sent",
  });
});

test("approved Test and Owner UAT runtimes are accepted while production or missing runtime is rejected", () => {
  expect(validateCandidateReadyEligibility({ runtime, reviewedPreview: preview(), freshPreview: preview(), acknowledgments }).ok).toBe(true);
  expect(validateCandidateReadyEligibility({ runtime: { environment: "uat", projectRef: "zleslkwnbjxknmkqywyv" }, reviewedPreview: preview(), freshPreview: preview(), acknowledgments }).ok).toBe(true);
  expect(validateCandidateReadyEligibility({ runtime: { environment: "test", projectRef: "qfpgednixvveelgwfylv" }, reviewedPreview: preview(), freshPreview: preview(), acknowledgments }).ok).toBe(false);
  expect(validateCandidateReadyEligibility({ runtime: {}, reviewedPreview: preview(), freshPreview: preview(), acknowledgments }).ok).toBe(false);
});

test("both acknowledgments are required", () => {
  expect(validateCandidateReadyEligibility({ runtime, reviewedPreview: preview(), freshPreview: preview(), acknowledgments: { reviewed: true } }).ok).toBe(false);
  expect(validateCandidateReadyEligibility({ runtime, reviewedPreview: preview(), freshPreview: preview(), acknowledgments: { testAction: true } }).ok).toBe(false);
});

test.each([
  ["blocker", { blockers: [{ code: "BLOCK" }], canConfirm: false }],
  ["unconfirmed candidate type", { snapshot: { ...preview().snapshot, intake: { ...preview().snapshot.intake, candidateTypeConfirmed: false } } }],
  ["incomplete intake", { snapshot: { ...preview().snapshot, intake: { ...preview().snapshot.intake, intakeCompleted: false } } }],
  ["unknown benefits", { snapshot: { ...preview().snapshot, requisition: { ...preview().snapshot.requisition, benefitsEligible: null } } }],
  ["missing facility recipient", { recipients: { ...preview().recipients, facility: { to: [], cc: [] } } }],
  ["unresolved token", { unresolvedTokens: ["{unsupported}"] }],
  ["restricted token", { restrictedTokens: ["{employee_id}"] }],
])("blocks confirmation for %s", (_label, change) => {
  const reviewed = preview(change);
  expect(validateCandidateReadyEligibility({ runtime, reviewedPreview: reviewed, freshPreview: reviewed, acknowledgments }).ok).toBe(false);
});

test("snapshot, recipients, rendered content, template versions, and release changes are stale", () => {
  const reviewed = preview();
  const changes = [
    { snapshotHash: "changed" },
    { recipients: { ...reviewed.recipients, facility: { to: ["other@example.test"], cc: [] } } },
    { rendered: { ...reviewed.rendered, facilityEmail: { ...reviewed.rendered.facilityEmail, body: "changed" } } },
    { rendered: { ...reviewed.rendered, candidateEmail: { ...reviewed.rendered.candidateEmail, releaseCondition: "changed" } } },
    { snapshot: { ...reviewed.snapshot, templateSettings: { ...reviewed.snapshot.templateSettings, templates: { ...reviewed.snapshot.templateSettings.templates, candidateConfirmation: { draftVariants: { External: { id: "candidate-external", version: 3, status: "Active" } } } } } } },
  ];
  changes.forEach((change) => {
    const result = compareReviewedPreview(reviewed, preview(change));
    expect(result).toEqual({ ok: false, error: STALE_REVIEW_MESSAGE });
  });
});

test("candidate matching follows ID, intake, email, then phone and never name", () => {
  const records = [
    { id: "tracker-1", candidate: "Same Name", intakeId: "intake-1", candidateEmail: "ONE@EXAMPLE.COM", candidatePhone: "4045550101", requisitionId: "req-1" },
    { id: "tracker-2", candidate: "Same Name", intakeId: "intake-2", candidateEmail: "two@example.com", candidatePhone: "4045550102", requisitionId: "req-1" },
  ];
  expect(findCandidateForConfirmation(records, { trackerId: "tracker-2", intakeId: "intake-1" }).record.id).toBe("tracker-2");
  expect(findCandidateForConfirmation(records, { intakeId: "intake-1" }).record.id).toBe("tracker-1");
  expect(findCandidateForConfirmation(records, { email: "one@example.com", requisitionId: "req-1" }).record.id).toBe("tracker-1");
  expect(findCandidateForConfirmation(records, { phone: "(404) 555-0102", requisitionId: "req-1" }).record.id).toBe("tracker-2");
  expect(findCandidateForConfirmation(records, { candidateName: "Same Name", requisitionId: "req-1" }).record).toBeNull();
});

test("ambiguous matching blocks without changing records", () => {
  const records = [{ id: "a", candidateEmail: "same@example.com", requisitionId: "req-1" }, { id: "b", candidateEmail: "same@example.com", requisitionId: "req-1" }];
  const result = applyCandidateReadyConfirmation(confirmArgs({ records, identity: { email: "same@example.com", requisitionId: "req-1" } }));
  expect(result.ok).toBe(false);
  expect(result.records).toBe(records);
});

test("exact reviewed package is stored without restricted employee data", () => {
  const reviewed = preview({ snapshot: { ...preview().snapshot, internalEmployee: { employeeId: "restricted", currentPosition: "RN" } } });
  const stored = buildConfirmedSubmissionPackage(reviewed, { confirmedAt: "2026-07-18T20:00:00.000Z", runtime });
  expect(stored.schemaVersion).toBe(1);
  expect(stored.purpose).toBe("candidate-ready-facility-submission");
  expect(stored.snapshotHash).toBe(reviewed.snapshotHash);
  expect(stored.recipients).toEqual(reviewed.recipients);
  expect(stored.rendered).toEqual(reviewed.rendered);
  expect(stored.snapshot.internalEmployee.employeeId).toBeUndefined();
  expect(stored.confirmedBy).toBe("Test Owner Confirmation");
  expect(stored.environment).toBe("test");
  expect(stored.projectRef).toBe("bjverobaoujhfaylyrzi");
});

test("confirmation creates one canonical ready tracker and one history entry without output or sent timestamps", () => {
  const result = applyCandidateReadyConfirmation(confirmArgs());
  expect(result.ok).toBe(true);
  expect(result.records).toHaveLength(1);
  expect(result.history).toHaveLength(1);
  expect(result.history[0].type).toBe("Submission package approved");
  expect(result.history[0].body).not.toMatch(/Candidate submitted|Email sent|ATS completed|Facility contacted/i);
  expect(result.candidate).toMatchObject({
    candidate: "Jordan Ready Test",
    candidateType: "External",
    pipelineStage: "Submit",
    stage: "Submit",
    status: "Ready for Facility Submission",
    nextAction: "Send facility submission",
    waitingOn: "Recruiter",
    facilityId: "site-1",
    submissionDate: "",
    facilitySubmissionSentAt: "",
    candidateConfirmationSentAt: "",
    textSentAt: "",
    atsCompletedAt: "",
  });
  expect(result.candidate.output).toBeUndefined();
  expect(result.candidate.formSnapshot.rateCalculationSnapshot).toEqual({ finalRate: "42" });
  expect(result.candidate.formSnapshot.facilityId).toBe("site-1");
  expect(result.candidate.reviewedSubmissionPackage.snapshot.intake.candidateId).toBe(result.candidate.id);
  expect(result.candidate.reviewedSubmissionPackage.rendered).toEqual(preview().rendered);
});

test("confirmation updates one existing candidate and preserves unrelated properties, audit, output, and intake snapshot", () => {
  const existing = { id: "existing", intakeId: "intake-jordan", custom: { keep: true }, audit: [{ label: "keep" }], output: { legacy: true }, formSnapshot: { prior: "keep", rateCalculationSnapshot: { finalRate: "40" } } };
  const result = applyCandidateReadyConfirmation(confirmArgs({ records: [existing] }));
  expect(result.records).toHaveLength(1);
  expect(result.candidate.id).toBe("existing");
  expect(result.candidate.custom).toEqual({ keep: true });
  expect(result.candidate.audit).toEqual([{ label: "keep" }]);
  expect(result.candidate.output).toEqual({ legacy: true });
  expect(result.candidate.formSnapshot.prior).toBe("keep");
});

test("double confirmation is idempotent and preserves confirmedAt, history, and output count", () => {
  const first = applyCandidateReadyConfirmation(confirmArgs());
  const second = applyCandidateReadyConfirmation(confirmArgs({ records: first.records, history: first.history, now: "2026-07-18T21:00:00.000Z" }));
  expect(second.ok).toBe(true);
  expect(second.idempotent).toBe(true);
  expect(second.records).toHaveLength(1);
  expect(second.history).toHaveLength(1);
  expect(second.candidate.reviewedSubmissionPackage.confirmedAt).toBe("2026-07-18T20:00:00.000Z");
  expect(confirmationIsIdempotent(second.candidate, confirmArgs().identity, preview().snapshotHash)).toBe(true);
});

test("confirmation has no communication, clipboard, mailto, API, template, or settings side effects", () => {
  const reviewed = preview();
  const before = JSON.stringify(reviewed);
  const fetchSpy = jest.spyOn(global, "fetch");
  const result = applyCandidateReadyConfirmation(confirmArgs({ reviewedPreview: reviewed, freshPreview: reviewed }));
  expect(result.ok).toBe(true);
  expect(JSON.stringify(reviewed)).toBe(before);
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});
