import { assertCommunicationRuntime } from "./requisitionCommunicationDetails";
import { COMMUNICATION_MODES, normalizeCommunicationWorkflow } from "./communicationWorkflow";

export const CANDIDATE_READY_PACKAGE_SCHEMA_VERSION = 1;
export const SUPPORTED_CANDIDATE_READY_PACKAGE_SCHEMA_VERSIONS = Object.freeze([
  CANDIDATE_READY_PACKAGE_SCHEMA_VERSION,
]);

export const REVIEW_ACKNOWLEDGMENT = "I reviewed the candidate, candidate type, requisition, employment details, facility recipients, and all communication content.";
export const TEST_ACTION_ACKNOWLEDGMENT = "I understand this will mark the candidate Ready for Facility Submission in WelcomeFlow Test. It will not send or copy any communication.";
export const STALE_REVIEW_MESSAGE = "The candidate, requisition, recipient, template, or communication content changed after review. Refresh and review the package again.";

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const clean = (value) => String(value ?? "").trim();
const normalizeEmail = (value) => clean(value).toLowerCase();
const normalizePhone = (value) => clean(value).replace(/\D/g, "").slice(-10);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

export function stableConfirmationString(value) {
  return JSON.stringify(stableValue(value));
}

function safeSnapshot(snapshot = {}) {
  const next = clone(snapshot) || {};
  if (next.internalEmployee) {
    delete next.internalEmployee.employeeId;
    delete next.internalEmployee.internalEligibilityNotes;
    delete next.internalEmployee.privateManagerComments;
  }
  if (next.rehire) delete next.rehire.previousEmploymentNotes;
  delete next.backgroundInformation;
  delete next.medicalInformation;
  return next;
}

function variantFor(settings, templateKey, variantKey) {
  if (templateKey === "candidateText") return settings.communicationTemplateDrafts?.textTemplates?.[variantKey] || null;
  const root = settings.templates?.[templateKey] || {};
  if (!variantKey || variantKey === "root" || variantKey === "root-comparison") return root;
  return root.draftVariants?.[variantKey] || root;
}

export function buildTemplateReferences(preview = {}) {
  const settings = preview.snapshot?.templateSettings || {};
  const rendered = preview.rendered || {};
  const definitions = [
    ["facilitySubmission", "hiringManager", rendered.facilityEmail],
    ["candidateConfirmation", "candidateConfirmation", rendered.candidateEmail],
    ["candidateFollowUpText", "candidateText", rendered.candidateText],
    ["atsSubmissionUpdate", "atsUpdate", rendered.atsUpdate],
  ];
  return definitions.reduce((result, [key, templateKey, output]) => {
    if (!output) return result;
    const record = variantFor(settings, templateKey, output.variantKey) || {};
    result[key] = {
      templateKey: output.templateKey || templateKey,
      variantKey: output.variantKey || "",
      id: clean(record.id || output.templateKey || templateKey),
      version: Number(record.version || 0),
      status: clean(record.status || ""),
      baseHash: clean(record.baseHash || ""),
    };
    return result;
  }, {});
}

export function buildCommunicationReleaseStates(preview = {}) {
  const plan = normalizeCommunicationWorkflow(preview.communicationPlan || preview.snapshot?.templateSettings || {});
  return {
    facilitySubmission: "Ready to Send",
    candidateConfirmation: plan.candidateEmailMode === COMMUNICATION_MODES.off ? "Not Required — Workflow Off" : "Locked — Awaiting Facility Submission Sent",
    candidateFollowUpText: plan.candidateTextMode === COMMUNICATION_MODES.off ? "Not Required — Workflow Off" : "Locked — Awaiting Facility Submission Sent",
    atsSubmissionUpdate: "Locked — Awaiting Facility Submission Sent",
  };
}

export function buildReleaseConditions(preview = {}) {
  const rendered = preview.rendered || {};
  return {
    facilitySubmission: clean(rendered.facilityEmail?.releaseCondition),
    candidateConfirmation: clean(rendered.candidateEmail?.releaseCondition),
    candidateFollowUpText: clean(rendered.candidateText?.releaseCondition),
    atsSubmissionUpdate: clean(rendered.atsUpdate?.releaseCondition),
  };
}

export function reviewedPreviewSignature(preview = {}) {
  return stableConfirmationString({
    snapshotHash: clean(preview.snapshotHash),
    recipients: preview.recipients || {},
    rendered: preview.rendered || {},
    unresolvedTokens: preview.unresolvedTokens || [],
    restrictedTokens: preview.restrictedTokens || [],
    communicationPlan: normalizeCommunicationWorkflow(preview.communicationPlan || preview.snapshot?.templateSettings || {}),
    templateReferences: buildTemplateReferences(preview),
    releaseConditions: buildReleaseConditions(preview),
  });
}

export function compareReviewedPreview(reviewedPreview = {}, freshPreview = {}) {
  const matches = reviewedPreviewSignature(reviewedPreview) === reviewedPreviewSignature(freshPreview);
  return { ok: matches, error: matches ? "" : STALE_REVIEW_MESSAGE };
}

export function validateCandidateReadyEligibility({ runtime = {}, reviewedPreview = {}, freshPreview = {}, outOfDate = false, acknowledgments = {} } = {}) {
  const runtimeResult = assertCommunicationRuntime(runtime);
  const errors = [];
  if (!runtimeResult.ok) errors.push(runtimeResult.error);
  if (!reviewedPreview.canConfirm || (reviewedPreview.blockers || []).length) errors.push("The reviewed Preview still contains blocking issues.");
  if (!freshPreview.canConfirm || (freshPreview.blockers || []).length) errors.push("The current Preview contains blocking issues.");
  if ((reviewedPreview.unresolvedTokens || []).length || (freshPreview.unresolvedTokens || []).length) errors.push("Unresolved tokens must be corrected before confirmation.");
  if ((reviewedPreview.restrictedTokens || []).length || (freshPreview.restrictedTokens || []).length) errors.push("Restricted tokens must be removed before confirmation.");
  if (reviewedPreview.snapshot?.intake?.candidateTypeConfirmed !== true) errors.push("Candidate type must be explicitly confirmed.");
  if (reviewedPreview.snapshot?.intake?.intakeCompleted !== true) errors.push("The intake must be complete.");
  if (reviewedPreview.snapshot?.requisition?.benefitsEligible !== true && reviewedPreview.snapshot?.requisition?.benefitsEligible !== false) errors.push("Benefits eligibility must be confirmed.");
  if (!(reviewedPreview.recipients?.facility?.to || []).length) errors.push("A facility recipient is required.");
  if (outOfDate || !compareReviewedPreview(reviewedPreview, freshPreview).ok) errors.push(STALE_REVIEW_MESSAGE);
  if (acknowledgments.reviewed !== true || acknowledgments.testAction !== true) errors.push("Both confirmation acknowledgments are required.");
  return { ok: errors.length === 0, errors: Array.from(new Set(errors)), runtime: runtimeResult };
}

function recordIdentity(record = {}) {
  const snapshot = record.formSnapshot || {};
  return {
    id: clean(record.id),
    intakeId: clean(record.intakeId || snapshot.intakeId || snapshot.activeIntakeDraftId),
    email: normalizeEmail(record.candidateEmail || snapshot.emailAddress),
    phone: normalizePhone(record.candidatePhone || snapshot.phoneNumber),
    requisitionId: clean(record.requisitionId || snapshot.selectedRequisitionId),
  };
}

export function findCandidateForConfirmation(records = [], identity = {}) {
  const candidates = Array.isArray(records) ? records.filter((record) => record && typeof record === "object") : [];
  const priorities = [
    ["trackerId", (record) => clean(identity.trackerId) && recordIdentity(record).id === clean(identity.trackerId)],
    ["intakeId", (record) => clean(identity.intakeId) && recordIdentity(record).intakeId === clean(identity.intakeId)],
    ["emailAndRequisition", (record) => normalizeEmail(identity.email) && clean(identity.requisitionId) && recordIdentity(record).email === normalizeEmail(identity.email) && recordIdentity(record).requisitionId === clean(identity.requisitionId)],
    ["phoneAndRequisition", (record) => normalizePhone(identity.phone) && clean(identity.requisitionId) && recordIdentity(record).phone === normalizePhone(identity.phone) && recordIdentity(record).requisitionId === clean(identity.requisitionId)],
  ];
  for (const [matchedBy, predicate] of priorities) {
    const matches = candidates.filter(predicate);
    if (matches.length > 1) return { ok: false, record: null, matchedBy, error: "WelcomeFlow found more than one candidate for this confirmation. No candidate was changed." };
    if (matches.length === 1) return { ok: true, record: matches[0], matchedBy, error: "" };
  }
  return { ok: true, record: null, matchedBy: "new", error: "" };
}

export function buildConfirmedSubmissionPackage(reviewedPreview = {}, { confirmedAt, confirmedBy = "Test Owner Confirmation", runtime = {} } = {}) {
  return {
    schemaVersion: CANDIDATE_READY_PACKAGE_SCHEMA_VERSION,
    snapshotHash: clean(reviewedPreview.snapshotHash),
    snapshot: safeSnapshot(reviewedPreview.snapshot || {}),
    recipients: clone(reviewedPreview.recipients || {}),
    rendered: clone(reviewedPreview.rendered || {}),
    unresolvedTokens: clone(reviewedPreview.unresolvedTokens || []),
    restrictedTokens: clone(reviewedPreview.restrictedTokens || []),
    communicationPlan: normalizeCommunicationWorkflow(reviewedPreview.communicationPlan || reviewedPreview.snapshot?.templateSettings || {}),
    templateReferences: buildTemplateReferences(reviewedPreview),
    releaseConditions: buildReleaseConditions(reviewedPreview),
    actionStates: buildCommunicationReleaseStates(reviewedPreview),
    confirmedAt,
    confirmedBy,
    environment: runtime.environment,
    projectRef: runtime.projectRef,
  };
}

export function confirmationIdentityKey(identity = {}, snapshotHash = "") {
  const emailIdentity = normalizeEmail(identity.email) && clean(identity.requisitionId) ? `${normalizeEmail(identity.email)}|${clean(identity.requisitionId)}` : "";
  const phoneIdentity = normalizePhone(identity.phone) && clean(identity.requisitionId) ? `${normalizePhone(identity.phone)}|${clean(identity.requisitionId)}` : "";
  const stableIdentity = clean(identity.trackerId) || clean(identity.intakeId) || emailIdentity || phoneIdentity;
  return `${stableIdentity}|${clean(snapshotHash)}`;
}

export function confirmationIsIdempotent(record = {}, identity = {}, snapshotHash = "") {
  return Boolean(record.reviewedSubmissionPackage && record.candidateReadyConfirmationKey === confirmationIdentityKey(identity, snapshotHash));
}

export function buildCandidateReadyHistoryEntry(candidate = {}, reviewedPackage = {}, confirmationKey = "") {
  const snapshot = reviewedPackage.snapshot || {};
  const requisition = snapshot.requisition || {};
  const intake = snapshot.intake || {};
  return {
    id: `hist-ready-${clean(reviewedPackage.snapshotHash).replace(/[^a-z0-9-]/gi, "").slice(-18)}`,
    trackerId: candidate.id,
    type: "Submission package approved",
    subject: "Submission package approved",
    body: [
      `Candidate: ${candidate.candidate || intake.candidateName || ""}`,
      `Candidate Type: ${candidate.candidateType || intake.candidateType || ""}`,
      `Facility: ${candidate.site || requisition.facility || ""}`,
      `Position: ${candidate.position || requisition.position || ""}`,
      `Req Number: ${candidate.reqNumber || requisition.reqNumber || ""}`,
      `Snapshot Hash: ${reviewedPackage.snapshotHash}`,
      "Status: Ready for Facility Submission",
      "Next Action: Send facility submission",
      `Timestamp: ${reviewedPackage.confirmedAt}`,
      `Environment: ${reviewedPackage.environment || "test"}`,
    ].join("\n"),
    candidate: candidate.candidate || intake.candidateName || "",
    facility: candidate.site || requisition.facility || "",
    timestamp: reviewedPackage.confirmedAt,
    environment: reviewedPackage.environment || "test",
    snapshotHash: reviewedPackage.snapshotHash,
    confirmationKey,
  };
}

export function applyCandidateReadyConfirmation({ records = [], history = [], reviewedPreview = {}, freshPreview = {}, runtime = {}, acknowledgments = {}, outOfDate = false, identity = {}, intakeForm = {}, now = new Date().toISOString() } = {}) {
  const eligibility = validateCandidateReadyEligibility({ runtime, reviewedPreview, freshPreview, outOfDate, acknowledgments });
  if (!eligibility.ok) return { ok: false, error: eligibility.errors[0], errors: eligibility.errors, records, history };
  const match = findCandidateForConfirmation(records, identity);
  if (!match.ok) return { ok: false, error: match.error, errors: [match.error], records, history };
  const key = confirmationIdentityKey(identity, reviewedPreview.snapshotHash);
  if (match.record && confirmationIsIdempotent(match.record, identity, reviewedPreview.snapshotHash)) {
    return { ok: true, idempotent: true, candidate: match.record, records, history, reviewedSubmissionPackage: match.record.reviewedSubmissionPackage };
  }
  const reviewedSubmissionPackage = buildConfirmedSubmissionPackage(reviewedPreview, { confirmedAt: now, runtime });
  const requisition = reviewedSubmissionPackage.snapshot.requisition || {};
  const intake = reviewedSubmissionPackage.snapshot.intake || {};
  const existing = match.record || {};
  const id = existing.id || `ready-${clean(reviewedPreview.snapshotHash).replace(/[^a-z0-9-]/gi, "").slice(-18)}`;
  const candidate = {
    ...existing,
    id,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    candidate: intake.candidateName || existing.candidate || "Unnamed Candidate",
    candidateType: intake.candidateType || existing.candidateType || "",
    candidateEmail: intake.candidateEmail || existing.candidateEmail || "",
    candidatePhone: intake.candidatePhone || existing.candidatePhone || "",
    candidateSource: intake.candidateSource || existing.candidateSource || "",
    position: requisition.position || existing.position || "",
    site: requisition.facility || existing.site || "",
    requisitionId: requisition.requisitionId || existing.requisitionId || "",
    reqNumber: requisition.reqNumber || existing.reqNumber || "",
    uniqueIdNumber: requisition.uniqueIdNumber || existing.uniqueIdNumber || "",
    intakeId: clean(identity.intakeId || existing.intakeId),
    pipelineStage: "Submit",
    stage: "Submit",
    status: "Ready for Facility Submission",
    nextAction: "Send facility submission",
    waitingOn: "Recruiter",
    owner: "Recruiter",
    submissionDate: "",
    facilitySubmissionSentAt: "",
    candidateConfirmationSentAt: "",
    textSentAt: "",
    atsCompletedAt: "",
    formSnapshot: {
      ...(existing.formSnapshot || {}),
      ...clone(intakeForm || {}),
      fullName: intake.candidateName || intakeForm.fullName || "",
      emailAddress: intake.candidateEmail || intakeForm.emailAddress || "",
      phoneNumber: intake.candidatePhone || intakeForm.phoneNumber || "",
      candidateType: intake.candidateType,
      candidateTypeConfirmed: true,
      selectedRequisitionId: requisition.requisitionId,
      reqNumber: requisition.reqNumber,
      uniqueIdNumber: requisition.uniqueIdNumber,
      position: requisition.position,
      siteName: requisition.facility,
    },
    audit: Array.isArray(existing.audit) ? existing.audit : [],
    reviewedSubmissionPackage,
    communicationActionStates: clone(reviewedSubmissionPackage.actionStates),
    candidateReadyConfirmationKey: key,
    archived: false,
  };
  const nextRecords = match.record ? records.map((record) => record === match.record ? candidate : record) : [candidate, ...records];
  const historyExists = history.some((entry) => entry?.confirmationKey === key || (entry?.trackerId === id && entry?.snapshotHash === reviewedPreview.snapshotHash && entry?.type === "Submission package approved"));
  const nextHistory = historyExists ? history : [buildCandidateReadyHistoryEntry(candidate, reviewedSubmissionPackage, key), ...history];
  return { ok: true, idempotent: false, candidate, records: nextRecords, history: nextHistory, reviewedSubmissionPackage };
}
