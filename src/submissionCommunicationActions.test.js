import {
  ACTION_STATES,
  PACKAGE_STALE_MESSAGE,
  applyAtsUpdateCompleted,
  applyAtsUpdateCopied,
  applyCandidateConfirmationSent,
  applyCandidateEmailOpened,
  applyCandidateTextCopied,
  applyCandidateTextSent,
  applyCommunicationActionToWorkspace,
  applyFacilityEmailOpened,
  applyFacilitySubmissionSent,
  buildSavedEmailMailto,
  calculateSubmissionNextAction,
  normalizeReviewedCommunicationRecord,
  savedPackageFingerprint,
  validateCommunicationActionRuntime,
  validateSavedPackageForFacilityAction,
} from "./submissionCommunicationActions";

const runtime = { environment: "test", projectRef: "bjverobaoujhfaylyrzi" };
const now = "2026-07-18T12:00:00.000Z";
const decodeMailto = (value) => decodeURIComponent(String(value).replace(/\+/g, " "));

function settings() {
  return {
    requisitions: [{ id: "req-1", siteId: "site-1", siteName: "Test Facility", employmentType: "PRN", benefitsEligible: true, fte: "PRN", weeklyHours: null, shiftPreference: "As needed", workSchedule: "As Needed", contractDuration: "" }],
    sites: [{ id: "site-1", siteName: "Test Facility", hiringManagerEmail: "manager@test.example", adminContactEmail: "admin@test.example", additionalHiringManagers: [{ email: "manager@test.example" }] }],
    templates: { hiringManager: { draftVariants: { External: { id: "facility-external", candidateType: "External", version: 3, status: "Active", baseHash: "base-1", releaseCondition: "candidateReadyConfirmed" } } } },
  };
}

function reviewedPackage({ text = true } = {}) {
  return {
    schemaVersion: 1,
    snapshotHash: "fnv1a-test",
    snapshot: {
      requisition: { requisitionId: "req-1", facility: "Test Facility", employmentType: "PRN", benefitsEligible: true, fte: "PRN", weeklyHours: null, shiftPreference: "As needed", workSchedule: "As Needed", contractDuration: "" },
      facility: { facilityId: "site-1", facilityName: "Test Facility" },
    },
    recipients: { facility: { to: ["manager@test.example"], cc: ["admin@test.example"] }, candidate: { to: ["candidate@test.example"] } },
    rendered: {
      facilityEmail: { subject: "Saved facility subject", body: "Saved facility body" },
      candidateEmail: { subject: "Saved candidate subject", body: "Saved candidate body" },
      candidateText: text ? { body: "Saved candidate text" } : null,
      atsUpdate: { subject: "Saved ATS subject", body: "Saved ATS body" },
    },
    templateReferences: { facilitySubmission: { templateKey: "hiringManager", variantKey: "External", id: "facility-external", version: 3, status: "Active", baseHash: "base-1" } },
    releaseConditions: { facilitySubmission: "candidateReadyConfirmed", candidateConfirmation: "facilitySubmissionSent", candidateFollowUpText: "facilitySubmissionSent", atsSubmissionUpdate: "facilitySubmissionSent" },
    actionStates: { facilitySubmission: ACTION_STATES.facilityReady, candidateConfirmation: ACTION_STATES.locked, candidateFollowUpText: ACTION_STATES.locked, atsSubmissionUpdate: ACTION_STATES.locked },
    confirmedAt: "2026-07-18T10:00:00.000Z",
    confirmedBy: "Test Owner Confirmation",
    environment: "test",
    projectRef: runtime.projectRef,
  };
}

function record(options = {}) {
  const pkg = reviewedPackage(options);
  return {
    id: "ready-fnv1a-test",
    candidate: "Synthetic Candidate",
    position: "Licensed Practical Nurse",
    site: "Test Facility",
    reqNumber: "100",
    status: "Ready for Facility Submission",
    pipelineStage: "Submit",
    nextAction: "Send facility submission",
    waitingOn: "Recruiter",
    submissionDate: "",
    audit: [],
    reviewedSubmissionPackage: pkg,
    communicationActionStates: { ...pkg.actionStates },
    communicationActionEvents: [],
  };
}

function openFacility(source = record()) {
  return applyFacilityEmailOpened({ record: source, history: [], settings: settings(), runtime, now });
}

function sendFacility(source = openFacility().record, history = []) {
  return applyFacilitySubmissionSent({ record: source, history, runtime, acknowledgment: true, now: "2026-07-18T12:01:00.000Z" });
}

describe("submission communication actions", () => {
  test("runtime guard accepts test and rejects production, missing configuration, and a missing package", () => {
    expect(validateCommunicationActionRuntime(runtime, record()).ok).toBe(true);
    expect(validateCommunicationActionRuntime({ environment: "test", projectRef: "qfpgednixvveelgwfylv" }, record()).ok).toBe(false);
    expect(validateCommunicationActionRuntime({}, record()).ok).toBe(false);
    expect(validateCommunicationActionRuntime(runtime, {}).ok).toBe(false);
  });

  test("reviewed records missing operational fields receive pre-submission defaults without audit entries", () => {
    const normalized = normalizeReviewedCommunicationRecord({ id: "x", reviewedSubmissionPackage: reviewedPackage() });
    expect(normalized).toMatchObject({ status: "Ready for Facility Submission", pipelineStage: "Submit", nextAction: "Send facility submission", waitingOn: "Recruiter", submissionDate: "", audit: [] });
  });

  test("facility stale check compares exact requisition, facility, recipients, template, and release condition", () => {
    expect(validateSavedPackageForFacilityAction({ record: record(), settings: settings(), runtime }).ok).toBe(true);
    const changed = settings();
    changed.requisitions[0].benefitsEligible = false;
    expect(validateSavedPackageForFacilityAction({ record: record(), settings: changed, runtime })).toMatchObject({ ok: false, error: PACKAGE_STALE_MESSAGE });
    const changedRecipient = settings();
    changedRecipient.sites[0].hiringManagerEmail = "different@test.example";
    expect(validateSavedPackageForFacilityAction({ record: record(), settings: changedRecipient, runtime }).ok).toBe(false);
    const changedTemplate = settings();
    changedTemplate.templates.hiringManager.draftVariants.External.version = 4;
    expect(validateSavedPackageForFacilityAction({ record: record(), settings: changedTemplate, runtime }).ok).toBe(false);
  });

  test("mailto builder encodes exact saved To, CC, subject, and body without BCC", () => {
    const result = buildSavedEmailMailto({ to: ["manager+test@example.com"], cc: ["admin@example.com"], subject: "Saved & exact", body: "Line 1\nLine 2" });
    expect(result.ok).toBe(true);
    expect(decodeMailto(result.url)).toContain("mailto:manager+test@example.com");
    expect(result.url).toContain("cc=admin%40example.com");
    expect(result.url).not.toMatch(/bcc/i);
    expect(decodeMailto(result.url)).toContain("Saved & exact");
    expect(decodeMailto(result.url)).toContain("Line 1\nLine 2");
  });

  test("opening facility email uses saved content, records only Draft Opened, and leaves other actions locked", () => {
    const original = record();
    const fingerprint = savedPackageFingerprint(original.reviewedSubmissionPackage);
    const result = openFacility(original);
    expect(result.ok).toBe(true);
    expect(decodeMailto(result.mailtoUrl)).toContain("Saved facility subject");
    expect(decodeMailto(result.mailtoUrl)).toContain("Saved facility body");
    expect(result.record).toMatchObject({ status: "Ready for Facility Submission", submissionDate: "", facilitySubmissionSentAt: "" });
    expect(result.record.communicationActionStates).toEqual({ facilitySubmission: ACTION_STATES.facilityOpened, candidateConfirmation: ACTION_STATES.locked, candidateFollowUpText: ACTION_STATES.locked, atsSubmissionUpdate: ACTION_STATES.locked });
    expect(result.record.communicationActionEvents).toHaveLength(1);
    expect(result.history).toHaveLength(0);
    expect(savedPackageFingerprint(result.record.reviewedSubmissionPackage)).toBe(fingerprint);
  });

  test("facility completion requires opened state and acknowledgment", () => {
    expect(applyFacilitySubmissionSent({ record: record(), history: [], runtime, acknowledgment: true, now }).ok).toBe(false);
    expect(applyFacilitySubmissionSent({ record: openFacility().record, history: [], runtime, acknowledgment: false, now }).ok).toBe(false);
  });

  test("facility completion sets Submitted, dates, unlocks actions, and records one completion history", () => {
    const opened = openFacility();
    const result = sendFacility(opened.record, opened.history);
    expect(result.record).toMatchObject({ status: "Submitted", pipelineStage: "Submit", submissionDate: "2026-07-18", facilitySubmissionSentAt: "2026-07-18T12:01:00.000Z", nextAction: "Send candidate confirmation", waitingOn: "Recruiter" });
    expect(result.record.communicationActionStates).toEqual({ facilitySubmission: ACTION_STATES.facilitySent, candidateConfirmation: ACTION_STATES.candidateReady, candidateFollowUpText: ACTION_STATES.copyReady, atsSubmissionUpdate: ACTION_STATES.copyReady });
    expect(result.record.communicationActionEvents).toHaveLength(2);
    expect(result.history.map((item) => item.type)).toEqual(["Facility submission sent"]);
  });

  test("opened package hash and exact facility content must still match at completion", () => {
    const opened = openFacility().record;
    const changedPackage = { ...opened.reviewedSubmissionPackage, rendered: { ...opened.reviewedSubmissionPackage.rendered, facilityEmail: { ...opened.reviewedSubmissionPackage.rendered.facilityEmail, body: "changed" } } };
    expect(applyFacilitySubmissionSent({ record: { ...opened, reviewedSubmissionPackage: changedPackage }, history: [], runtime, acknowledgment: true, now }).ok).toBe(false);
  });

  test("candidate email cannot bypass facility lock and open does not mark sent", () => {
    expect(applyCandidateEmailOpened({ record: record(), history: [], runtime, now }).ok).toBe(false);
    const facilitySent = sendFacility().record;
    const opened = applyCandidateEmailOpened({ record: facilitySent, history: [], runtime, now });
    expect(decodeMailto(opened.mailtoUrl)).toContain("Saved candidate body");
    expect(opened.record.communicationActionStates.candidateConfirmation).toBe(ACTION_STATES.candidateOpened);
    expect(opened.record.candidateConfirmationSentAt).toBeUndefined();
  });

  test("candidate email completion requires opened state and acknowledgment", () => {
    const facilitySent = sendFacility().record;
    expect(applyCandidateConfirmationSent({ record: facilitySent, history: [], runtime, acknowledgment: true, now }).ok).toBe(false);
    const opened = applyCandidateEmailOpened({ record: facilitySent, history: [], runtime, now }).record;
    expect(applyCandidateConfirmationSent({ record: opened, history: [], runtime, acknowledgment: false, now }).ok).toBe(false);
    const sent = applyCandidateConfirmationSent({ record: opened, history: [], runtime, acknowledgment: true, now });
    expect(sent.record.communicationActionStates.candidateConfirmation).toBe(ACTION_STATES.candidateSent);
    expect(sent.record.candidateConfirmationSentAt).toBe(now);
    expect(sent.history[0].type).toBe("Candidate confirmation sent");
  });

  test("clipboard failure never advances text or ATS state", () => {
    const facilitySent = sendFacility().record;
    expect(applyCandidateTextCopied({ record: facilitySent, history: [], runtime, copied: false, now }).record).toEqual(facilitySent);
    expect(applyAtsUpdateCopied({ record: facilitySent, history: [], runtime, copied: false, now }).record).toEqual(facilitySent);
  });

  test("text copy and send require facility release, successful copy, and acknowledgment", () => {
    expect(applyCandidateTextCopied({ record: record(), history: [], runtime, copied: true, now }).ok).toBe(false);
    const facilitySent = sendFacility().record;
    const copied = applyCandidateTextCopied({ record: facilitySent, history: [], runtime, copied: true, now });
    expect(copied.record.communicationActionStates.candidateFollowUpText).toBe(ACTION_STATES.textCopied);
    expect(applyCandidateTextSent({ record: facilitySent, history: [], runtime, acknowledgment: true, now }).ok).toBe(false);
    expect(applyCandidateTextSent({ record: copied.record, history: [], runtime, acknowledgment: false, now }).ok).toBe(false);
    const sent = applyCandidateTextSent({ record: copied.record, history: [], runtime, acknowledgment: true, now });
    expect(sent.record.communicationActionStates.candidateFollowUpText).toBe(ACTION_STATES.textSent);
    expect(sent.history[0].type).toBe("Candidate follow-up text sent");
  });

  test("missing saved text becomes optional and does not block final progression", () => {
    const opened = openFacility(record({ text: false }));
    const sent = sendFacility(opened.record, opened.history);
    expect(sent.record.communicationActionStates.candidateFollowUpText).toBe(ACTION_STATES.textOptional);
  });

  test("ATS copy and completion require facility release, successful copy, and acknowledgment", () => {
    expect(applyAtsUpdateCopied({ record: record(), history: [], runtime, copied: true, now }).ok).toBe(false);
    const facilitySent = sendFacility().record;
    const copied = applyAtsUpdateCopied({ record: facilitySent, history: [], runtime, copied: true, now });
    expect(copied.record.communicationActionStates.atsSubmissionUpdate).toBe(ACTION_STATES.atsCopied);
    expect(applyAtsUpdateCompleted({ record: facilitySent, history: [], runtime, acknowledgment: true, now }).ok).toBe(false);
    expect(applyAtsUpdateCompleted({ record: copied.record, history: [], runtime, acknowledgment: false, now }).ok).toBe(false);
    const completed = applyAtsUpdateCompleted({ record: copied.record, history: [], runtime, acknowledgment: true, now });
    expect(completed.record.communicationActionStates.atsSubmissionUpdate).toBe(ACTION_STATES.atsCompleted);
    expect(completed.history[0].type).toBe("ATS submission update completed");
  });

  test("next action follows candidate email, text, ATS, then facility feedback priority", () => {
    let state = sendFacility();
    expect(calculateSubmissionNextAction(state.record).nextAction).toBe("Send candidate confirmation");
    state = applyCandidateEmailOpened({ record: state.record, history: state.history, runtime, now });
    state = applyCandidateConfirmationSent({ record: state.record, history: state.history, runtime, acknowledgment: true, now });
    expect(state.record.nextAction).toBe("Send candidate follow-up text");
    state = applyCandidateTextCopied({ record: state.record, history: state.history, runtime, copied: true, now });
    state = applyCandidateTextSent({ record: state.record, history: state.history, runtime, acknowledgment: true, now });
    expect(state.record.nextAction).toBe("Complete ATS submission update");
    state = applyAtsUpdateCopied({ record: state.record, history: state.history, runtime, copied: true, now });
    state = applyAtsUpdateCompleted({ record: state.record, history: state.history, runtime, acknowledgment: true, now });
    expect(state.record).toMatchObject({ status: "Submitted", pipelineStage: "Submit", nextAction: "Awaiting facility feedback", waitingOn: "Facility" });
  });

  test("full workflow produces eight record events, four completion histories, no audit, and immutable package", () => {
    const original = record();
    const fingerprint = savedPackageFingerprint(original.reviewedSubmissionPackage);
    let state = openFacility(original);
    state = sendFacility(state.record, state.history);
    state = applyCandidateEmailOpened({ record: state.record, history: state.history, runtime, now });
    state = applyCandidateConfirmationSent({ record: state.record, history: state.history, runtime, acknowledgment: true, now });
    state = applyCandidateTextCopied({ record: state.record, history: state.history, runtime, copied: true, now });
    state = applyCandidateTextSent({ record: state.record, history: state.history, runtime, acknowledgment: true, now });
    state = applyAtsUpdateCopied({ record: state.record, history: state.history, runtime, copied: true, now });
    state = applyAtsUpdateCompleted({ record: state.record, history: state.history, runtime, acknowledgment: true, now });
    expect(state.record.communicationActionEvents).toHaveLength(8);
    expect(state.history).toHaveLength(4);
    expect(state.record.audit).toEqual([]);
    expect(savedPackageFingerprint(state.record.reviewedSubmissionPackage)).toBe(fingerprint);
  });

  test("every completion is idempotent without duplicate timestamps, history, or action events", () => {
    let state = openFacility();
    state = sendFacility(state.record, state.history);
    const facilityAgain = applyFacilitySubmissionSent({ record: state.record, history: state.history, runtime, acknowledgment: true, now: "later" });
    expect(facilityAgain.idempotent).toBe(true);
    expect(facilityAgain.record.communicationActionEvents).toHaveLength(2);
    expect(facilityAgain.history).toHaveLength(1);
    expect(facilityAgain.record.facilitySubmissionSentAt).toBe("2026-07-18T12:01:00.000Z");
  });

  test("workspace application changes exactly one existing record and creates no output", () => {
    const existing = record();
    const workspace = { tracker: [existing], history: [], generatedOutputs: [] };
    const result = applyCommunicationActionToWorkspace({ workspace, candidateId: existing.id, transition: applyFacilityEmailOpened, transitionInput: { settings: settings(), runtime, now } });
    expect(result.ok).toBe(true);
    expect(result.workspace.tracker).toHaveLength(1);
    expect(result.workspace.generatedOutputs).toEqual([]);
    expect(result.workspace.tracker[0].communicationActionStates.facilitySubmission).toBe(ACTION_STATES.facilityOpened);
    expect(applyCommunicationActionToWorkspace({ workspace: { ...workspace, tracker: [existing, { ...existing }] }, candidateId: existing.id, transition: applyFacilityEmailOpened, transitionInput: { settings: settings(), runtime, now } }).ok).toBe(false);
  });
});
