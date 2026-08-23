import { ACTION_CENTER_CATEGORIES, buildActionCenterItemId } from "./actionCenterSelectors";
import {
  actionCenterItemSupportsCommunicationPreview,
  buildActionCenterCommunicationPreview,
  validateCandidateReadyFacilitySubmissionPackage,
} from "./actionCenterCommunicationPreviews";
import { CANDIDATE_READY_PACKAGE_SCHEMA_VERSION } from "./candidateReadyConfirmation";
import { CANDIDATE_READY_FACILITY_SUBMISSION_PURPOSE } from "./candidateReadyPackageValidation";

const requisition = {
  id: "req-preview",
  reqNumber: "SYN-PREVIEW",
  positionTitle: "Registered Nurse",
  facilityId: "facility-preview",
  siteName: "Synthetic Preview Facility",
  status: "Active",
};

const facility = {
  id: "facility-preview",
  siteName: "Synthetic Preview Facility",
  regionName: "Synthetic Region",
  status: "Active",
  hiringManagerName: "Synthetic Manager",
  hiringManagerEmail: "manager@example.test",
};

const candidate = {
  id: "candidate-preview",
  candidate: "Synthetic Preview Candidate",
  candidateEmail: "candidate@example.test",
  candidateType: "External",
  candidateTypeConfirmed: true,
  requisitionId: "req-preview",
  facilityId: "facility-preview",
  site: "Synthetic Preview Facility",
  position: "Registered Nurse",
  status: "Interview Completed",
  actualInterviewAt: "2026-08-09T15:00:00.000Z",
};

const settings = {
  general: { recruiterName: "Synthetic Recruiter", recruiterEmail: "recruiter@example.test" },
  templates: {
    candidate48HourFollowUp: {
      subject: "Checking in | {position} | {facility}",
      body: "Hello {candidate_name},\n\nChecking in about {position} at {facility}.\n\nThank you,\n{recruiter_name}",
    },
    managerFeedbackRequest: {
      subject: "Feedback requested | {candidate_name}",
      body: "Please share feedback for {candidate_name} after the {interview_date} interview at {facility}.",
    },
  },
};

function reviewedPackage(overrides = {}) {
  return {
    schemaVersion: CANDIDATE_READY_PACKAGE_SCHEMA_VERSION,
    purpose: CANDIDATE_READY_FACILITY_SUBMISSION_PURPOSE,
    snapshotHash: "approved-snapshot-hash",
    snapshot: {
      requisition: { requisitionId: "req-preview", facilityId: "facility-preview" },
      facility: { facilityId: "facility-preview" },
      intake: { candidateId: "candidate-preview" },
    },
    recipients: { facility: { to: ["manager@example.test"], cc: [] }, candidate: { to: ["candidate@example.test"] } },
    rendered: {
      facilityEmail: { templateKey: "hiringManager", variantKey: "External", subject: "Exact saved facility subject", body: "Exact saved facility body", releaseCondition: "candidateReadyConfirmed" },
      candidateEmail: { templateKey: "candidateConfirmation", subject: "Exact saved candidate subject", body: "Exact saved candidate body" },
      candidateText: { templateKey: "candidateText", body: "Exact saved candidate text" },
      atsUpdate: { templateKey: "atsUpdate", subject: "Exact saved ATS subject", body: "Exact saved ATS body" },
    },
    templateReferences: {
      facilitySubmission: { templateKey: "hiringManager", variantKey: "External", id: "facility-external", version: 1, status: "Active", baseHash: "base-facility" },
    },
    releaseConditions: { facilitySubmission: "candidateReadyConfirmed" },
    actionStates: { facilitySubmission: "Ready to Send" },
    unresolvedTokens: [],
    restrictedTokens: [],
    ...overrides,
  };
}

function item(category, overrides = {}) {
  const result = {
    category,
    sourceType: "candidate",
    sourceId: "candidate-preview",
    candidateId: "candidate-preview",
    requisitionId: "req-preview",
    facilityId: "facility-preview",
    explanation: "Synthetic explanation",
    context: {},
    ...overrides,
  };
  return {
    ...result,
    id: Object.prototype.hasOwnProperty.call(overrides, "id")
      ? overrides.id
      : buildActionCenterItemId(result),
  };
}

test("requires the canonical Action Center identity before resolving preview context", () => {
  const base = { tracker: [candidate], requisitions: [requisition], sites: [facility], settings };
  const validItem = item(ACTION_CENTER_CATEGORIES.followUp);
  const source = JSON.parse(JSON.stringify(validItem));

  expect(buildActionCenterCommunicationPreview({ ...base, item: validItem })).toMatchObject({ blockers: [], canReview: true });
  expect(buildActionCenterCommunicationPreview({ ...base, item: { ...validItem, candidateId: "candidate-other" } })).toMatchObject({
    blockers: expect.arrayContaining([expect.objectContaining({ code: "ACTION_CENTER_ID_MISMATCH" })]),
    canReview: false,
    documents: [],
    context: { candidateId: "", requisitionId: "", facilityId: "" },
  });
  expect(buildActionCenterCommunicationPreview({ ...base, item: { ...validItem, requisitionId: "req-other" } }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTION_CENTER_ID_MISMATCH" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, item: { ...validItem, facilityId: "facility-other" } }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTION_CENTER_ID_MISMATCH" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, item: { ...validItem, category: ACTION_CENTER_CATEGORIES.managerFeedback } }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTION_CENTER_ID_MISMATCH" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, item: { ...validItem, issueCode: "wrong-issue" } }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTION_CENTER_ID_MISMATCH" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, item: { ...validItem, id: "not-an-action-id" } }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTION_CENTER_ID_MALFORMED" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, item: { ...validItem, id: "" } }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTION_CENTER_ID_MISSING" })]));
  expect(validItem).toEqual(source);
});

test("keeps encoded candidate and requisition identities exact across multiple requisitions", () => {
  const firstRequisition = { ...requisition, id: "req/one?active", requisitionId: "req/one?active" };
  const secondRequisition = { ...requisition, id: "req two#active", requisitionId: "req two#active" };
  const firstCandidate = { ...candidate, id: "candidate/with spaces", requisitionId: firstRequisition.id };
  const secondCandidate = { ...candidate, id: "candidate/with spaces", requisitionId: secondRequisition.id };
  const firstItem = item(ACTION_CENTER_CATEGORIES.followUp, { candidateId: firstCandidate.id, sourceId: firstCandidate.id, requisitionId: firstRequisition.id });
  const secondItem = item(ACTION_CENTER_CATEGORIES.followUp, { candidateId: secondCandidate.id, sourceId: secondCandidate.id, requisitionId: secondRequisition.id });

  expect(firstItem.id).toContain("candidate%2Fwith%20spaces");
  expect(firstItem.id).toContain("req%2Fone%3Factive");
  expect(secondItem.id).toContain("req%20two%23active");
  expect(firstItem.id).not.toBe(secondItem.id);
  expect(buildActionCenterCommunicationPreview({ item: firstItem, tracker: [firstCandidate, secondCandidate], requisitions: [firstRequisition, secondRequisition], sites: [facility], settings })).toMatchObject({ blockers: [], canReview: true, context: { requisitionId: firstRequisition.id } });
  expect(buildActionCenterCommunicationPreview({ item: secondItem, tracker: [firstCandidate, secondCandidate], requisitions: [firstRequisition, secondRequisition], sites: [facility], settings })).toMatchObject({ blockers: [], canReview: true, context: { requisitionId: secondRequisition.id } });
});

test("builds a side-effect-free candidate follow-up preview from exact canonical context", () => {
  const source = JSON.parse(JSON.stringify({ candidate, requisition, facility, settings }));
  const preview = buildActionCenterCommunicationPreview({
    item: item(ACTION_CENTER_CATEGORIES.followUp),
    tracker: [candidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
  });

  expect(preview).toMatchObject({
    title: "Candidate Follow-Up Preview",
    canReview: true,
    readOnly: true,
    blockers: [],
    context: {
      candidateId: "candidate-preview",
      requisitionId: "req-preview",
      facilityId: "facility-preview",
      region: "Synthetic Region",
    },
  });
  expect(preview.documents).toEqual([expect.objectContaining({
    key: "candidate-follow-up",
    recipientLabel: "Candidate",
    to: ["candidate@example.test"],
    subject: "Checking in | Registered Nurse | Synthetic Preview Facility",
    body: expect.stringContaining("Hello Synthetic Preview Candidate"),
  })]);
  expect({ candidate, requisition, facility, settings }).toEqual(source);
});

test("builds a manager feedback preview with the exact facility recipients and interview context", () => {
  const preview = buildActionCenterCommunicationPreview({
    item: item(ACTION_CENTER_CATEGORIES.managerFeedback),
    tracker: [candidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
  });

  expect(preview).toMatchObject({ title: "Manager Feedback Preview", canReview: true, blockers: [] });
  expect(preview.documents[0]).toMatchObject({
    key: "manager-feedback",
    recipientLabel: "Facility hiring manager",
    to: ["manager@example.test"],
    subject: "Feedback requested | Synthetic Preview Candidate",
    body: expect.stringContaining("2026-08-09"),
  });
});

test("shows the exact saved Candidate Ready package without regenerating it", () => {
  const readyCandidate = {
    ...candidate,
    reviewedSubmissionPackage: reviewedPackage(),
  };
  const preview = buildActionCenterCommunicationPreview({
    item: item(ACTION_CENTER_CATEGORIES.candidateReady),
    tracker: [readyCandidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
  });

  expect(preview).toMatchObject({ title: "Candidate Ready Preview", snapshotHash: "approved-snapshot-hash", canReview: true, blockers: [] });
  expect(preview.documents.map((entry) => entry.key)).toEqual(["facility-submission", "candidate-confirmation", "candidate-text", "ats-update"]);
  expect(preview.documents[0].body).toBe("Exact saved facility body");
});

test("validates the explicit saved Candidate Ready facility-submission contract without mutation", () => {
  const expectedContext = { candidate, requisition, facility };
  const valid = reviewedPackage();
  const source = JSON.parse(JSON.stringify(valid));
  expect(validateCandidateReadyFacilitySubmissionPackage(valid, expectedContext)).toEqual({ valid: true, reasonCode: "", errors: [] });
  expect(valid).toEqual(source);

  const missingSchema = reviewedPackage();
  delete missingSchema.schemaVersion;
  expect(validateCandidateReadyFacilitySubmissionPackage(missingSchema, expectedContext)).toMatchObject({ valid: false, reasonCode: "REVIEWED_PACKAGE_SCHEMA_MISSING" });

  const missingPurpose = reviewedPackage();
  delete missingPurpose.purpose;
  expect(validateCandidateReadyFacilitySubmissionPackage(missingPurpose, expectedContext)).toMatchObject({ valid: false, reasonCode: "REVIEWED_PACKAGE_PURPOSE_INVALID" });

  const cases = [
    ["unsupported schema", { schemaVersion: 99 }, "REVIEWED_PACKAGE_SCHEMA_UNSUPPORTED"],
    ["wrong declared purpose", { purpose: "ats-note-only" }, "REVIEWED_PACKAGE_PURPOSE_INVALID"],
    ["missing facility email", { rendered: { atsUpdate: { subject: "ATS", body: "ATS only" } } }, "REVIEWED_PACKAGE_FACILITY_EMAIL_MISSING"],
    ["arbitrary documents", { rendered: {}, documents: [{ title: "ATS note", body: "Nonempty but unrelated" }] }, "REVIEWED_PACKAGE_FACILITY_EMAIL_MISSING"],
    ["empty facility email", { rendered: { facilityEmail: { templateKey: "hiringManager", releaseCondition: "candidateReadyConfirmed", subject: "", body: "" } } }, "REVIEWED_PACKAGE_FACILITY_EMAIL_INCOMPLETE"],
    ["ATS email in facility slot", { rendered: { facilityEmail: { templateKey: "atsUpdate", releaseCondition: "facilitySubmissionSent", subject: "ATS", body: "ATS only" } } }, "REVIEWED_PACKAGE_FACILITY_EMAIL_PURPOSE_INVALID"],
    ["missing recipients", { recipients: { candidate: { to: ["candidate@example.test"] } } }, "REVIEWED_PACKAGE_FACILITY_RECIPIENT_MISSING"],
    ["wrong action state", { actionStates: { facilitySubmission: "Draft Opened" } }, "REVIEWED_PACKAGE_ACTION_STATE_INVALID"],
    ["missing template metadata", { templateReferences: {} }, "REVIEWED_PACKAGE_TEMPLATE_METADATA_MISSING"],
    ["wrong template purpose", { templateReferences: { facilitySubmission: { templateKey: "atsUpdate", id: "ats", version: 1 } } }, "REVIEWED_PACKAGE_TEMPLATE_PURPOSE_INVALID"],
    ["missing release metadata", { releaseConditions: {} }, "REVIEWED_PACKAGE_RELEASE_METADATA_INVALID"],
    ["missing candidate", { snapshot: { ...valid.snapshot, intake: {} } }, "REVIEWED_PACKAGE_CANDIDATE_MISSING"],
    ["wrong candidate", { snapshot: { ...valid.snapshot, intake: { candidateId: "candidate-other" } } }, "REVIEWED_PACKAGE_CANDIDATE_MISMATCH"],
    ["wrong requisition", { snapshot: { ...valid.snapshot, requisition: { requisitionId: "req-other", facilityId: "facility-preview" } } }, "REVIEWED_PACKAGE_REQUISITION_MISMATCH"],
    ["wrong facility", { snapshot: { ...valid.snapshot, facility: { facilityId: "facility-other" } } }, "REVIEWED_PACKAGE_FACILITY_MISMATCH"],
  ];
  cases.forEach(([, overrides, code]) => {
    const packageData = reviewedPackage(overrides);
    const result = validateCandidateReadyFacilitySubmissionPackage(packageData, expectedContext);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });
});

test.each([
  ["valid string recipient", "manager@example.test", true],
  ["null recipient", null, false],
  ["object recipient", {}, false],
  ["valid recipient array", ["manager@example.test"], true],
])("handles %s without throwing", (_label, to, valid) => {
  const packageData = reviewedPackage({ recipients: { facility: { to, cc: [] } } });
  expect(() => validateCandidateReadyFacilitySubmissionPackage(packageData, { candidate, requisition, facility })).not.toThrow();
  const result = validateCandidateReadyFacilitySubmissionPackage(packageData, { candidate, requisition, facility });
  expect(result.valid).toBe(valid);
  expect(result.errors.some((error) => error.code === "REVIEWED_PACKAGE_FACILITY_RECIPIENT_MISSING")).toBe(!valid);
});

test.each(["", null, true, -1, 1.5, "1.5"])("rejects malformed facility template version %p", (version) => {
  const packageData = reviewedPackage({
    templateReferences: {
      facilitySubmission: { templateKey: "hiringManager", id: "facility-external", version },
    },
  });
  expect(validateCandidateReadyFacilitySubmissionPackage(packageData, { candidate, requisition, facility })).toMatchObject({
    valid: false,
    errors: expect.arrayContaining([expect.objectContaining({ code: "REVIEWED_PACKAGE_TEMPLATE_METADATA_MISSING" })]),
  });
});

test.each([
  ["candidate", { intake: { candidateId: "candidate-preview", trackerId: "candidate-other" } }, "REVIEWED_PACKAGE_CANDIDATE_MISMATCH"],
  ["requisition", { requisition: { requisitionId: "req-preview", id: "req-other", facilityId: "facility-preview" } }, "REVIEWED_PACKAGE_REQUISITION_MISMATCH"],
  ["facility", { requisition: { requisitionId: "req-preview", facilityId: "facility-preview" }, facility: { facilityId: "facility-preview", id: "facility-other" } }, "REVIEWED_PACKAGE_FACILITY_MISMATCH"],
])("rejects contradictory %s identities", (_label, snapshotChange, code) => {
  const valid = reviewedPackage();
  const packageData = reviewedPackage({ snapshot: { ...valid.snapshot, ...snapshotChange } });
  expect(validateCandidateReadyFacilitySubmissionPackage(packageData, { candidate, requisition, facility })).toMatchObject({
    valid: false,
    errors: expect.arrayContaining([expect.objectContaining({ code })]),
  });
});

test("allows supplemental ATS content only alongside the required saved facility package", () => {
  const packageData = reviewedPackage({
    rendered: {
      ...reviewedPackage().rendered,
      atsUpdate: { templateKey: "atsUpdate", subject: "Supplemental ATS note", body: "Supplemental saved ATS body" },
    },
  });
  expect(validateCandidateReadyFacilitySubmissionPackage(packageData, { candidate, requisition, facility })).toMatchObject({ valid: true, errors: [] });
});

test("blocks Candidate Ready packages with missing or mismatched saved identity and packages already sent", () => {
  const base = { item: item(ACTION_CENTER_CATEGORIES.candidateReady), requisitions: [requisition], sites: [facility], settings };
  const build = (record) => buildActionCenterCommunicationPreview({ ...base, tracker: [{ ...candidate, reviewedSubmissionPackage: record, communicationActionStates: { facilitySubmission: "Ready to Send" } }] });

  expect(build(reviewedPackage({ snapshot: { requisition: {}, facility: {} } })).blockers).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: "REVIEWED_PACKAGE_REQUISITION_MISSING" }),
    expect.objectContaining({ code: "REVIEWED_PACKAGE_FACILITY_MISSING" }),
  ]));
  expect(build(reviewedPackage({ snapshot: { requisition: { requisitionId: "req-other" }, facility: { facilityId: "facility-preview" } } })).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "REVIEWED_PACKAGE_REQUISITION_MISMATCH" })]));
  expect(build(reviewedPackage({ snapshot: { requisition: { requisitionId: "req-preview" }, facility: { facilityId: "facility-other" } } })).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "REVIEWED_PACKAGE_FACILITY_MISMATCH" })]));
  expect(build(reviewedPackage({ snapshot: { requisition: { requisitionId: "req-preview" }, facility: { facilityId: "facility-preview" }, intake: { candidateId: "candidate-other" } } })).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "REVIEWED_PACKAGE_CANDIDATE_MISMATCH" })]));

  const sent = buildActionCenterCommunicationPreview({
    ...base,
    tracker: [{ ...candidate, reviewedSubmissionPackage: reviewedPackage(), communicationActionStates: { facilitySubmission: "Sent" }, facilitySubmissionSentAt: "2026-08-10T12:00:00.000Z" }],
  });
  expect(sent.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "REVIEWED_PACKAGE_ALREADY_SENT" })]));
  expect(sent.documents).toEqual([]);
});

test("requires confirmed completed interviews and suppresses resolved Manager Feedback previews", () => {
  const base = { item: item(ACTION_CENTER_CATEGORIES.managerFeedback), requisitions: [requisition], sites: [facility], settings, now: new Date("2026-08-10T12:00:00.000Z") };
  const build = (record) => buildActionCenterCommunicationPreview({ ...base, tracker: [{ ...candidate, ...record }] });

  expect(build({ actualInterviewAt: "", status: "Interview Scheduled", interviewDate: "2026-08-11T12:00:00.000Z" }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INTERVIEW_COMPLETION_REQUIRED" })]));
  expect(build({ actualInterviewAt: "2026-08-11T12:00:00.000Z" }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INTERVIEW_COMPLETION_REQUIRED" })]));
  expect(build({ actualInterviewAt: "2026-08-09T12:00:00.000Z", interviewFeedback: "Strong interview" }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MANAGER_FEEDBACK_ALREADY_RESOLVED" })]));
  expect(build({ actualInterviewAt: "2026-08-09T12:00:00.000Z", finalCandidateOutcome: "Offer accepted" }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "MANAGER_FEEDBACK_ALREADY_RESOLVED" })]));
  expect(build({ actualInterviewAt: "2026-08-09T12:00:00.000Z", interviewFeedback: "Feedback pending" })).toMatchObject({ blockers: [], canReview: true });
  expect(build({ actualInterviewAt: "2026-08-10T11:00:00.000Z", interviewFeedback: "Manager reviewing" })).toMatchObject({ blockers: [], canReview: true });
  expect(build({ actualInterviewAt: "2026-08-01T12:00:00.000Z", interviewFeedback: "Manager reviewing" })).toMatchObject({ blockers: [], canReview: true });
  expect(build({ actualInterviewAt: "2026-08-09T12:00:00.000Z", interviewFeedback: "Still Active" })).toMatchObject({ blockers: [], canReview: true });
  expect(build({ actualInterviewAt: "2026-08-09T12:00:00.000Z", interviewFeedback: "Pending" })).toMatchObject({ blockers: [], canReview: true });
  expect(build({ actualInterviewAt: "2026-08-09T12:00:00.000Z", interviewFeedback: "" })).toMatchObject({ blockers: [], canReview: true });
});

test("fails closed for stale, inactive, ambiguous, or incomplete communication context", () => {
  const base = { item: item(ACTION_CENTER_CATEGORIES.followUp), tracker: [candidate], requisitions: [requisition], sites: [facility], settings };
  expect(buildActionCenterCommunicationPreview({ ...base, requisitions: [{ ...requisition, status: "Closed" }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTIVE_REQUISITION_NOT_FOUND" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, tracker: [candidate, { ...candidate }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CANDIDATE_CONTEXT_AMBIGUOUS" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, sites: [{ ...facility, id: "different-facility" }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "FACILITY_CONTEXT_UNRESOLVED" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, tracker: [{ ...candidate, candidateEmail: "" }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PREVIEW_RECIPIENT_MISSING" })]));
});

test("supports only the three approved Action Center communication categories", () => {
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.followUp))).toBe(true);
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.managerFeedback))).toBe(true);
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.candidateReady))).toBe(true);
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.dataBlocker))).toBe(false);
});

test("produces deterministic preview identity in New York and UTC-compatible execution", () => {
  const input = { item: item(ACTION_CENTER_CATEGORIES.managerFeedback), tracker: [candidate], requisitions: [requisition], sites: [facility], settings };
  const first = buildActionCenterCommunicationPreview(input);
  const second = buildActionCenterCommunicationPreview(input);
  expect(second.id).toBe(first.id);
  expect(second.snapshotHash).toBe(first.snapshotHash);
  expect(second.documents).toEqual(first.documents);
});
