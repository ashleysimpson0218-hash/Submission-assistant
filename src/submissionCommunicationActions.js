import { resolveExactFacility, resolveExactRequisition, resolveFacilitySubmissionRecipients } from "./communicationGeneration";
import { assertTestRuntime } from "./requisitionCommunicationDetails";
import { COMMUNICATION_MODES, normalizeCommunicationWorkflow } from "./communicationWorkflow";

export const TEST_ACTION_OWNER = "Test Owner Action";
export const PACKAGE_STALE_MESSAGE = "This submission package no longer matches the current requisition, recipient, or template configuration. Return to Intake and review a new submission package.";

export const ACTION_STATES = Object.freeze({
  facilityReady: "Ready to Send",
  facilityOpened: "Draft Opened",
  facilitySent: "Sent",
  locked: "Locked — Awaiting Facility Submission Sent",
  candidateReady: "Ready to Send",
  candidateOpened: "Draft Opened",
  candidateSent: "Sent",
  copyReady: "Ready to Copy",
  textCopied: "Copied — Awaiting Send Confirmation",
  textSent: "Sent",
  textOptional: "Not Configured — Optional",
  optionalReady: "Optional — Ready",
  notRequired: "Not Required — Workflow Off",
  skipped: "Skipped",
  atsCopied: "Copied — Awaiting Completion",
  atsCompleted: "Completed",
});

const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const clean = (value) => String(value ?? "").trim();

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = stableValue(value[key]);
    return result;
  }, {});
  return value;
}

export function stableActionString(value) {
  return JSON.stringify(stableValue(value));
}

function hashText(value = "") {
  let hash = 2166136261;
  const source = String(value);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function savedPackageFingerprint(reviewedPackage = {}) {
  return hashText(stableActionString(reviewedPackage));
}

function packageFor(record = {}) {
  return record.reviewedSubmissionPackage && typeof record.reviewedSubmissionPackage === "object" ? record.reviewedSubmissionPackage : null;
}

function textConfigured(record = {}) {
  return Boolean(clean(packageFor(record)?.rendered?.candidateText?.body));
}

function communicationPlanFor(record = {}) {
  const reviewedPackage = packageFor(record) || {};
  const storedPlan = reviewedPackage.communicationPlan || reviewedPackage.snapshot?.templateSettings?.communicationWorkflow;
  if (!storedPlan) {
    return {
      candidateCommunicationPlan: "Legacy Reviewed Package",
      candidateEmailMode: COMMUNICATION_MODES.required,
      candidateTextMode: textConfigured(record) ? COMMUNICATION_MODES.required : COMMUNICATION_MODES.optional,
    };
  }
  return normalizeCommunicationWorkflow(reviewedPackage.communicationPlan || reviewedPackage.snapshot?.templateSettings || {});
}

function channelState(record, channel, facilitySent) {
  const mode = communicationPlanFor(record)[`${channel}Mode`];
  if (mode === COMMUNICATION_MODES.off) return ACTION_STATES.notRequired;
  if (!facilitySent) return ACTION_STATES.locked;
  if (mode === COMMUNICATION_MODES.optional) return ACTION_STATES.optionalReady;
  return channel === "candidateEmail" ? ACTION_STATES.candidateReady : ACTION_STATES.copyReady;
}

export function normalizeReviewedCommunicationRecord(record = {}) {
  if (!packageFor(record)) return record;
  const facilitySent = clean(record.communicationActionStates?.facilitySubmission) === ACTION_STATES.facilitySent || Boolean(record.facilitySubmissionSentAt);
  const candidateState = channelState(record, "candidateEmail", facilitySent);
  const copyState = facilitySent ? ACTION_STATES.copyReady : ACTION_STATES.locked;
  return {
    ...record,
    status: record.status || (facilitySent ? "Submitted" : "Ready for Facility Submission"),
    pipelineStage: record.pipelineStage || "Submit",
    stage: record.stage || "Submit",
    nextAction: record.nextAction || (facilitySent ? "Send candidate confirmation" : "Send facility submission"),
    waitingOn: record.waitingOn || "Recruiter",
    submissionDate: record.submissionDate || "",
    audit: Array.isArray(record.audit) ? record.audit : [],
    communicationActionEvents: Array.isArray(record.communicationActionEvents) ? record.communicationActionEvents : [],
    communicationActionStates: {
      facilitySubmission: record.communicationActionStates?.facilitySubmission || (facilitySent ? ACTION_STATES.facilitySent : ACTION_STATES.facilityReady),
      candidateConfirmation: record.communicationActionStates?.candidateConfirmation || candidateState,
      candidateFollowUpText: record.communicationActionStates?.candidateFollowUpText || (textConfigured(record) ? channelState(record, "candidateText", facilitySent) : communicationPlanFor(record).candidateTextMode === COMMUNICATION_MODES.off ? ACTION_STATES.notRequired : ACTION_STATES.textOptional),
      atsSubmissionUpdate: record.communicationActionStates?.atsSubmissionUpdate || copyState,
    },
  };
}

export function validateCommunicationActionRuntime(runtime = {}, record = {}) {
  const checked = assertTestRuntime(runtime);
  if (!checked.ok) return checked;
  const reviewedPackage = packageFor(record);
  if (!reviewedPackage) return { ok: false, error: "A reviewed submission package is required." };
  if (reviewedPackage.environment && reviewedPackage.environment !== "test") return { ok: false, error: "The reviewed package is not a WelcomeFlow Test package." };
  if (reviewedPackage.projectRef && reviewedPackage.projectRef !== checked.projectRef) return { ok: false, error: "The reviewed package belongs to a different Supabase project." };
  return checked;
}

function requisitionComparable(requisition = {}) {
  return {
    requisitionId: clean(requisition.requisitionId || requisition.id),
    employmentType: clean(requisition.employmentType),
    benefitsEligible: requisition.benefitsEligible === true ? true : requisition.benefitsEligible === false ? false : null,
    fte: clean(requisition.fte),
    weeklyHours: Number.isFinite(Number(requisition.weeklyHours)) && clean(requisition.weeklyHours) !== "" ? Number(requisition.weeklyHours) : null,
    shiftPreference: clean(requisition.shiftPreference),
    workSchedule: clean(requisition.workSchedule),
    contractDuration: clean(requisition.contractDuration),
  };
}

function facilityComparable(facility = {}) {
  return {
    facilityId: clean(facility.facilityId || facility.id),
    facilityName: clean(facility.facilityName || facility.siteName),
  };
}

function normalizedRecipients(recipients = {}) {
  return {
    to: Array.from(new Set((recipients.to || []).map((value) => clean(value).toLowerCase()).filter(Boolean))),
    cc: Array.from(new Set((recipients.cc || []).map((value) => clean(value).toLowerCase()).filter(Boolean))),
  };
}

function currentFacilityTemplate(settings = {}, reference = {}) {
  const root = settings.templates?.hiringManager || {};
  const variantKey = clean(reference.variantKey);
  if (!variantKey || variantKey === "root" || variantKey === "root-comparison") return root;
  return root.draftVariants?.[variantKey] || null;
}

function templateComparable(template = {}, reference = {}) {
  return {
    templateKey: clean(reference.templateKey || "hiringManager"),
    variantKey: clean(reference.variantKey),
    id: clean(template?.id),
    version: Number(template?.version || 0),
    status: clean(template?.status),
    baseHash: clean(template?.baseHash),
  };
}

export function validateSavedPackageForFacilityAction({ record = {}, settings = {}, runtime = {} } = {}) {
  const runtimeResult = validateCommunicationActionRuntime(runtime, record);
  if (!runtimeResult.ok) return runtimeResult;
  const reviewedPackage = packageFor(record);
  const savedRequisition = reviewedPackage.snapshot?.requisition || {};
  const requisitionResult = resolveExactRequisition(settings.requisitions || [], savedRequisition.requisitionId);
  if (!requisitionResult.value) return { ok: false, error: PACKAGE_STALE_MESSAGE };
  const facilityResult = resolveExactFacility(settings.sites || [], requisitionResult.value);
  if (!facilityResult.value) return { ok: false, error: PACKAGE_STALE_MESSAGE };
  const recipientResult = resolveFacilitySubmissionRecipients(facilityResult.value);
  if (recipientResult.blockers?.length) return { ok: false, error: PACKAGE_STALE_MESSAGE };
  const savedReference = reviewedPackage.templateReferences?.facilitySubmission || {};
  const currentTemplate = currentFacilityTemplate(settings, savedReference);
  if (!currentTemplate) return { ok: false, error: PACKAGE_STALE_MESSAGE };
  const savedComparable = {
    requisition: requisitionComparable(savedRequisition),
    facility: facilityComparable(reviewedPackage.snapshot?.facility || {}),
    recipients: normalizedRecipients(reviewedPackage.recipients?.facility || {}),
    template: {
      templateKey: clean(savedReference.templateKey),
      variantKey: clean(savedReference.variantKey),
      id: clean(savedReference.id),
      version: Number(savedReference.version || 0),
      status: clean(savedReference.status),
      baseHash: clean(savedReference.baseHash),
    },
    releaseCondition: clean(reviewedPackage.releaseConditions?.facilitySubmission),
  };
  const currentComparable = {
    requisition: requisitionComparable(requisitionResult.value),
    facility: facilityComparable(facilityResult.value),
    recipients: normalizedRecipients(recipientResult.recipients || {}),
    template: templateComparable(currentTemplate, savedReference),
    releaseCondition: clean(currentTemplate.releaseCondition || "candidateReadyConfirmed"),
  };
  if (stableActionString(savedComparable) !== stableActionString(currentComparable)) return { ok: false, error: PACKAGE_STALE_MESSAGE, savedComparable, currentComparable };
  return { ok: true, savedComparable, currentComparable };
}

export function buildSavedEmailMailto(email = {}) {
  const to = (email.to || []).map(clean).filter(Boolean);
  const cc = (email.cc || []).map(clean).filter(Boolean);
  if (!to.length) return { ok: false, error: "The saved package does not contain a recipient." };
  const params = new URLSearchParams();
  if (cc.length) params.set("cc", cc.join(","));
  params.set("subject", clean(email.subject));
  params.set("body", String(email.body || ""));
  return { ok: true, url: `mailto:${to.map(encodeURIComponent).join(",")}?${params.toString()}` };
}

function facilityEmail(record = {}) {
  const reviewedPackage = packageFor(record) || {};
  return {
    to: reviewedPackage.recipients?.facility?.to || [],
    cc: reviewedPackage.recipients?.facility?.cc || [],
    subject: reviewedPackage.rendered?.facilityEmail?.subject || "",
    body: reviewedPackage.rendered?.facilityEmail?.body || "",
  };
}

function candidateEmail(record = {}) {
  const reviewedPackage = packageFor(record) || {};
  return {
    to: reviewedPackage.recipients?.candidate?.to || [],
    cc: [],
    subject: reviewedPackage.rendered?.candidateEmail?.subject || "",
    body: reviewedPackage.rendered?.candidateEmail?.body || "",
  };
}

function actionKey(record = {}, action = "", result = "") {
  return `${clean(record.id)}|${clean(packageFor(record)?.snapshotHash)}|${clean(action)}|${clean(result)}`;
}

export function communicationActionIsIdempotent(record = {}, action = "", result = "") {
  const key = actionKey(record, action, result);
  return (record.communicationActionEvents || []).some((event) => event?.idempotencyKey === key);
}

function eventFor(record, action, result, now) {
  const reviewedPackage = packageFor(record) || {};
  const key = actionKey(record, action, result);
  return {
    id: `communication-${hashText(key)}`,
    idempotencyKey: key,
    candidateId: record.id,
    snapshotHash: reviewedPackage.snapshotHash,
    action,
    result,
    timestamp: now,
    environment: "test",
    projectRef: reviewedPackage.projectRef,
    completedBy: TEST_ACTION_OWNER,
  };
}

function appendActionEvent(record, action, result, now) {
  if (communicationActionIsIdempotent(record, action, result)) return record;
  return { ...record, communicationActionEvents: [...(record.communicationActionEvents || []), eventFor(record, action, result, now)] };
}

function historyKey(record, type) {
  return actionKey(record, type, "completed");
}

function historyEntry(record, type, now) {
  const reviewedPackage = packageFor(record) || {};
  const key = historyKey(record, type);
  return {
    id: `history-${hashText(key)}`,
    trackerId: record.id,
    type,
    subject: type,
    body: `${record.candidate || "Candidate"} | ${record.position || "Position"} | Snapshot ${reviewedPackage.snapshotHash}`,
    candidate: record.candidate || "",
    facility: record.site || "",
    timestamp: now,
    environment: "test",
    snapshotHash: reviewedPackage.snapshotHash,
    communicationActionKey: key,
  };
}

function appendHistory(history = [], record = {}, type = "", now = "") {
  const key = historyKey(record, type);
  return history.some((item) => item?.communicationActionKey === key) ? history : [historyEntry(record, type, now), ...history];
}

function baseTransition({ record = {}, history = [], runtime = {} } = {}) {
  const runtimeResult = validateCommunicationActionRuntime(runtime, record);
  if (!runtimeResult.ok) return { ok: false, error: runtimeResult.error, record, history };
  return { ok: true, record: normalizeReviewedCommunicationRecord(clone(record)), history: clone(history || []) };
}

function result(record, history, idempotent = false, extra = {}) {
  return { ok: true, record: { ...record, updatedAt: extra.now || record.updatedAt }, history, idempotent, ...extra };
}

export function calculateSubmissionNextAction(record = {}) {
  const states = normalizeReviewedCommunicationRecord(record).communicationActionStates;
  const completeOrSkipped = (state, completed) => [completed, ACTION_STATES.notRequired, ACTION_STATES.skipped, ACTION_STATES.textOptional].includes(state);
  if (states.facilitySubmission !== ACTION_STATES.facilitySent) return { nextAction: "Send facility submission", waitingOn: "Recruiter" };
  if (!completeOrSkipped(states.candidateConfirmation, ACTION_STATES.candidateSent)) return { nextAction: states.candidateConfirmation === ACTION_STATES.optionalReady ? "Send or skip optional candidate email" : "Send candidate confirmation", waitingOn: "Recruiter" };
  if (!completeOrSkipped(states.candidateFollowUpText, ACTION_STATES.textSent)) return { nextAction: states.candidateFollowUpText === ACTION_STATES.optionalReady ? "Send or skip optional candidate text" : "Send candidate follow-up text", waitingOn: "Recruiter" };
  if (states.atsSubmissionUpdate !== ACTION_STATES.atsCompleted) return { nextAction: "Complete ATS submission update", waitingOn: "Recruiter" };
  return { nextAction: "Awaiting facility feedback", waitingOn: "Facility" };
}

export function applyFacilityEmailOpened({ record = {}, history = [], settings = {}, runtime = {}, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  const staleCheck = validateSavedPackageForFacilityAction({ record: base.record, settings, runtime });
  if (!staleCheck.ok) return { ...base, ok: false, error: staleCheck.error };
  if (base.record.communicationActionStates.facilitySubmission === ACTION_STATES.facilitySent || communicationActionIsIdempotent(base.record, "Facility email draft opened", "opened")) return result(base.record, base.history, true);
  const email = facilityEmail(base.record);
  const mailto = buildSavedEmailMailto(email);
  if (!mailto.ok) return { ...base, ok: false, error: mailto.error };
  let next = {
    ...base.record,
    status: "Ready for Facility Submission",
    pipelineStage: "Submit",
    stage: "Submit",
    nextAction: "Send facility submission",
    waitingOn: "Recruiter",
    submissionDate: "",
    facilitySubmissionSentAt: "",
    facilitySubmissionDraftOpenedAt: now,
    facilitySubmissionDraftOpenedPackageHash: packageFor(base.record).snapshotHash,
    facilitySubmissionDraftOpenedContentHash: hashText(stableActionString(email)),
    communicationActionStates: { ...base.record.communicationActionStates, facilitySubmission: ACTION_STATES.facilityOpened },
    updatedAt: now,
  };
  next = appendActionEvent(next, "Facility email draft opened", "opened", now);
  return result(next, base.history, false, { now, mailtoUrl: mailto.url });
}

export function applyFacilitySubmissionSent({ record = {}, history = [], runtime = {}, acknowledgment = false, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  if (base.record.communicationActionStates.facilitySubmission === ACTION_STATES.facilitySent || communicationActionIsIdempotent(base.record, "Facility submission marked sent", "sent")) return result(base.record, base.history, true);
  if (base.record.communicationActionStates.facilitySubmission !== ACTION_STATES.facilityOpened) return { ...base, ok: false, error: "Open the exact saved facility email before marking it sent." };
  if (!acknowledgment) return { ...base, ok: false, error: "Confirm that the exact saved facility email was sent to the listed recipients." };
  const reviewedPackage = packageFor(base.record);
  if (base.record.facilitySubmissionDraftOpenedPackageHash !== reviewedPackage.snapshotHash || base.record.facilitySubmissionDraftOpenedContentHash !== hashText(stableActionString(facilityEmail(base.record)))) return { ...base, ok: false, error: "The saved facility email changed after the draft was opened. Reopen the exact saved draft before marking it sent." };
  let next = {
    ...base.record,
    status: "Submitted",
    pipelineStage: "Submit",
    stage: "Submit",
    submissionDate: now.slice(0, 10),
    facilitySubmissionSentAt: now,
    waitingOn: "Recruiter",
    communicationActionStates: {
      ...base.record.communicationActionStates,
      facilitySubmission: ACTION_STATES.facilitySent,
      candidateConfirmation: channelState(base.record, "candidateEmail", true),
      candidateFollowUpText: textConfigured(base.record) ? channelState(base.record, "candidateText", true) : communicationPlanFor(base.record).candidateTextMode === COMMUNICATION_MODES.off ? ACTION_STATES.notRequired : ACTION_STATES.textOptional,
      atsSubmissionUpdate: ACTION_STATES.copyReady,
    },
    updatedAt: now,
  };
  Object.assign(next, calculateSubmissionNextAction(next));
  next = appendActionEvent(next, "Facility submission marked sent", "sent", now);
  return result(next, appendHistory(base.history, next, "Facility submission sent", now), false, { now });
}

export function applyCandidateEmailOpened({ record = {}, history = [], runtime = {}, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  if (base.record.communicationActionStates.candidateConfirmation === ACTION_STATES.notRequired) return { ...base, ok: false, error: "Candidate email is turned off for this reviewed communication plan." };
  if (base.record.communicationActionStates.facilitySubmission !== ACTION_STATES.facilitySent) return { ...base, ok: false, error: "Candidate confirmation remains locked until the facility submission is marked sent." };
  if (base.record.communicationActionStates.candidateConfirmation === ACTION_STATES.candidateSent || communicationActionIsIdempotent(base.record, "Candidate email draft opened", "opened")) return result(base.record, base.history, true);
  const email = candidateEmail(base.record);
  const mailto = buildSavedEmailMailto(email);
  if (!mailto.ok) return { ...base, ok: false, error: mailto.error };
  let next = { ...base.record, candidateConfirmationDraftOpenedAt: now, communicationActionStates: { ...base.record.communicationActionStates, candidateConfirmation: ACTION_STATES.candidateOpened }, updatedAt: now };
  next = appendActionEvent(next, "Candidate email draft opened", "opened", now);
  Object.assign(next, calculateSubmissionNextAction(next));
  return result(next, base.history, false, { now, mailtoUrl: mailto.url });
}

export function applyCandidateConfirmationSent({ record = {}, history = [], runtime = {}, acknowledgment = false, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  if (base.record.communicationActionStates.candidateConfirmation === ACTION_STATES.candidateSent || communicationActionIsIdempotent(base.record, "Candidate confirmation marked sent", "sent")) return result(base.record, base.history, true);
  if (base.record.communicationActionStates.candidateConfirmation !== ACTION_STATES.candidateOpened) return { ...base, ok: false, error: "Open the exact saved candidate email before marking it sent." };
  if (!acknowledgment) return { ...base, ok: false, error: "Confirm that the exact saved candidate email was sent to the listed candidate address." };
  let next = { ...base.record, candidateConfirmationSentAt: now, communicationActionStates: { ...base.record.communicationActionStates, candidateConfirmation: ACTION_STATES.candidateSent }, updatedAt: now };
  next = appendActionEvent(next, "Candidate confirmation marked sent", "sent", now);
  Object.assign(next, calculateSubmissionNextAction(next));
  return result(next, appendHistory(base.history, next, "Candidate confirmation sent", now), false, { now });
}

export function applyCandidateTextCopied({ record = {}, history = [], runtime = {}, copied = false, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  if (base.record.communicationActionStates.candidateFollowUpText === ACTION_STATES.notRequired) return { ...base, ok: false, error: "Candidate text is turned off for this reviewed communication plan." };
  if (base.record.communicationActionStates.facilitySubmission !== ACTION_STATES.facilitySent) return { ...base, ok: false, error: "Candidate text remains locked until the facility submission is marked sent." };
  if (!textConfigured(base.record)) return result({ ...base.record, communicationActionStates: { ...base.record.communicationActionStates, candidateFollowUpText: ACTION_STATES.textOptional } }, base.history, true);
  if (!copied) return { ...base, ok: false, error: "The candidate text was not copied. No action state was changed." };
  if (base.record.communicationActionStates.candidateFollowUpText === ACTION_STATES.textSent || communicationActionIsIdempotent(base.record, "Candidate text copied", "copied")) return result(base.record, base.history, true);
  let next = { ...base.record, candidateTextCopiedAt: now, communicationActionStates: { ...base.record.communicationActionStates, candidateFollowUpText: ACTION_STATES.textCopied }, updatedAt: now };
  next = appendActionEvent(next, "Candidate text copied", "copied", now);
  Object.assign(next, calculateSubmissionNextAction(next));
  return result(next, base.history, false, { now });
}

export function applyCandidateTextSent({ record = {}, history = [], runtime = {}, acknowledgment = false, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  if (base.record.communicationActionStates.candidateFollowUpText === ACTION_STATES.textOptional) return result(base.record, base.history, true);
  if (base.record.communicationActionStates.candidateFollowUpText === ACTION_STATES.textSent || communicationActionIsIdempotent(base.record, "Candidate text marked sent", "sent")) return result(base.record, base.history, true);
  if (base.record.communicationActionStates.candidateFollowUpText !== ACTION_STATES.textCopied) return { ...base, ok: false, error: "Copy the exact saved candidate text before marking it sent." };
  if (!acknowledgment) return { ...base, ok: false, error: "Confirm that the exact saved text message was sent to the candidate." };
  let next = { ...base.record, textSentAt: now, communicationActionStates: { ...base.record.communicationActionStates, candidateFollowUpText: ACTION_STATES.textSent }, updatedAt: now };
  next = appendActionEvent(next, "Candidate text marked sent", "sent", now);
  Object.assign(next, calculateSubmissionNextAction(next));
  return result(next, appendHistory(base.history, next, "Candidate follow-up text sent", now), false, { now });
}

function skipOptionalCommunication({ record = {}, history = [], runtime = {}, channel = "", now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  const stateKey = channel === "candidateEmail" ? "candidateConfirmation" : "candidateFollowUpText";
  if (communicationPlanFor(base.record)[`${channel}Mode`] !== COMMUNICATION_MODES.optional) return { ...base, ok: false, error: "Only an optional communication may be skipped." };
  if (base.record.communicationActionStates.facilitySubmission !== ACTION_STATES.facilitySent) return { ...base, ok: false, error: "Optional candidate communication remains locked until the facility submission is marked sent." };
  if (base.record.communicationActionStates[stateKey] === ACTION_STATES.skipped) return result(base.record, base.history, true);
  let next = { ...base.record, communicationActionStates: { ...base.record.communicationActionStates, [stateKey]: ACTION_STATES.skipped }, updatedAt: now };
  const label = channel === "candidateEmail" ? "Optional candidate email skipped" : "Optional candidate text skipped";
  next = appendActionEvent(next, label, "skipped", now);
  Object.assign(next, calculateSubmissionNextAction(next));
  return result(next, appendHistory(base.history, next, label, now), false, { now });
}

export function applyCandidateConfirmationSkipped(input = {}) {
  return skipOptionalCommunication({ ...input, channel: "candidateEmail" });
}

export function applyCandidateTextSkipped(input = {}) {
  return skipOptionalCommunication({ ...input, channel: "candidateText" });
}

export function applyAtsUpdateCopied({ record = {}, history = [], runtime = {}, copied = false, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  if (base.record.communicationActionStates.facilitySubmission !== ACTION_STATES.facilitySent) return { ...base, ok: false, error: "The ATS update remains locked until the facility submission is marked sent." };
  if (!clean(packageFor(base.record)?.rendered?.atsUpdate?.body)) return { ...base, ok: false, error: "The saved package does not contain an ATS update." };
  if (!copied) return { ...base, ok: false, error: "The ATS update was not copied. No action state was changed." };
  if (base.record.communicationActionStates.atsSubmissionUpdate === ACTION_STATES.atsCompleted || communicationActionIsIdempotent(base.record, "ATS update copied", "copied")) return result(base.record, base.history, true);
  let next = { ...base.record, atsCopiedAt: now, communicationActionStates: { ...base.record.communicationActionStates, atsSubmissionUpdate: ACTION_STATES.atsCopied }, updatedAt: now };
  next = appendActionEvent(next, "ATS update copied", "copied", now);
  Object.assign(next, calculateSubmissionNextAction(next));
  return result(next, base.history, false, { now });
}

export function applyAtsUpdateCompleted({ record = {}, history = [], runtime = {}, acknowledgment = false, now = new Date().toISOString() } = {}) {
  const base = baseTransition({ record, history, runtime });
  if (!base.ok) return base;
  if (base.record.communicationActionStates.atsSubmissionUpdate === ACTION_STATES.atsCompleted || communicationActionIsIdempotent(base.record, "ATS update marked complete", "completed")) return result(base.record, base.history, true);
  if (base.record.communicationActionStates.atsSubmissionUpdate !== ACTION_STATES.atsCopied) return { ...base, ok: false, error: "Copy the exact saved ATS update before marking it complete." };
  if (!acknowledgment) return { ...base, ok: false, error: "Confirm that the exact reviewed ATS update was pasted and saved in the ATS." };
  let next = { ...base.record, atsCompletedAt: now, communicationActionStates: { ...base.record.communicationActionStates, atsSubmissionUpdate: ACTION_STATES.atsCompleted }, updatedAt: now };
  next = appendActionEvent(next, "ATS update marked complete", "completed", now);
  Object.assign(next, calculateSubmissionNextAction(next));
  return result(next, appendHistory(base.history, next, "ATS submission update completed", now), false, { now });
}

export function applyCommunicationActionToWorkspace({ workspace = {}, candidateId = "", transition, transitionInput = {} } = {}) {
  const records = Array.isArray(workspace.tracker) ? workspace.tracker : [];
  const matches = records.filter((record) => record?.id === candidateId);
  if (matches.length !== 1) return { ok: false, error: matches.length ? "WelcomeFlow found more than one candidate record for this action." : "The reviewed candidate record could not be found.", workspace };
  const actionResult = transition({ ...transitionInput, record: matches[0], history: Array.isArray(workspace.history) ? workspace.history : [] });
  if (!actionResult.ok) return { ...actionResult, workspace };
  const tracker = records.map((record) => record === matches[0] ? actionResult.record : record);
  return { ...actionResult, workspace: { ...workspace, tracker, history: actionResult.history, savedAt: transitionInput.now || new Date().toISOString() } };
}
