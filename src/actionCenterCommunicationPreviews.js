import {
  buildCommunicationTokenMap,
  createCommunicationSnapshot,
  renderCommunicationTemplate,
  resolveFacilitySubmissionRecipients,
} from "./communicationGeneration";
import { ACTION_CENTER_CATEGORIES } from "./actionCenterSelectors";
import { getLocalCalendarDateKey } from "./calendarDate";
import { ACTION_STATES, normalizeReviewedCommunicationRecord } from "./submissionCommunicationActions";
import { buildFacilityIndex, resolveCanonicalFacility, resolveRequisition } from "./weeklyCleanupReporting";

const PREVIEWABLE_CATEGORIES = new Set([
  ACTION_CENTER_CATEGORIES.followUp,
  ACTION_CENTER_CATEGORIES.managerFeedback,
  ACTION_CENTER_CATEGORIES.candidateReady,
]);

const text = (value) => String(value ?? "").trim();
const lower = (value) => text(value).toLowerCase();

const NON_FINAL_FEEDBACK_VALUES = new Set([
  "",
  "active",
  "awaiting decision",
  "awaiting feedback",
  "decision pending",
  "feedback pending",
  "interview completed",
  "needs feedback",
  "no decision",
  "pending",
  "still active",
  "undecided",
]);

const FINAL_FEEDBACK_OUTCOMES = new Set([
  "archived",
  "candidate withdrew",
  "closed",
  "do not rehire / do not hire",
  "duplicate",
  "future consideration",
  "hired",
  "ineligible",
  "no response",
  "no show",
  "not interested",
  "not moving forward",
  "not selected",
  "not selected by leadership",
  "offer",
  "offer accepted",
  "offer declined",
  "offer rescinded",
  "offered",
  "placed",
  "position closed",
  "position no longer available",
  "rejected",
  "unresponsive",
  "verbal offer",
  "withdrew",
  "withdrawn",
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
}

function uniqueEmails(values = []) {
  const seen = new Set();
  return values.flatMap((value) => String(value || "").split(/[;,]/)).map(text).filter((email) => {
    const key = email.toLowerCase();
    if (!validEmail(email) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function activeRequisition(requisition = {}) {
  return !requisition.archived && text(requisition.status || "Active").toLowerCase() === "active";
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function previewFingerprint(value) {
  const source = stableSerialize(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `action-preview-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function resolveExactContext(item, tracker, requisitions, sites) {
  const candidateId = text(item?.candidateId || item?.sourceId);
  const requisitionId = text(item?.requisitionId || item?.context?.requisitionId);
  const blockers = [];
  if (!candidateId) blockers.push({ code: "CANDIDATE_ID_MISSING", message: "The Action Center item has no stable candidate identifier." });
  if (!requisitionId) blockers.push({ code: "REQUISITION_ID_MISSING", message: "The Action Center item has no exact requisition identifier." });
  if (blockers.length) return { candidate: null, requisition: null, facility: null, blockers };

  const candidateMatches = (Array.isArray(tracker) ? tracker : []).filter((candidate) => {
    if (text(candidate?.id) !== candidateId) return false;
    const resolution = resolveRequisition(candidate, requisitions);
    return resolution.status === "resolved"
      && text(resolution.requisition?.id || resolution.requisition?.requisitionId) === requisitionId;
  });
  if (candidateMatches.length !== 1) {
    blockers.push({ code: candidateMatches.length ? "CANDIDATE_CONTEXT_AMBIGUOUS" : "CANDIDATE_CONTEXT_NOT_FOUND", message: candidateMatches.length ? "More than one candidate record matched this exact requisition context." : "The exact candidate and requisition context is no longer available." });
    return { candidate: null, requisition: null, facility: null, blockers };
  }

  const candidate = candidateMatches[0];
  const requisitionResolution = resolveRequisition(candidate, requisitions);
  const requisition = requisitionResolution.requisition;
  if (requisitionResolution.status !== "resolved" || !requisition || !activeRequisition(requisition)) {
    blockers.push({ code: "ACTIVE_REQUISITION_NOT_FOUND", message: "The exact requisition is not active or could not be resolved." });
    return { candidate, requisition: null, facility: null, blockers };
  }

  const facilityResolution = resolveCanonicalFacility({
    candidate,
    requisition,
    sites,
    facilityIndex: buildFacilityIndex(sites),
  });
  const resolvedFacilityId = text(facilityResolution.facility?.id || facilityResolution.facility?.facilityId);
  const expectedFacilityIds = [item?.facilityId, item?.context?.facilityId, requisition?.facilityId, requisition?.siteId, candidate?.facilityId, candidate?.siteId]
    .map(text)
    .filter(Boolean);
  if (facilityResolution.status !== "resolved" || expectedFacilityIds.some((id) => id !== resolvedFacilityId)) {
    blockers.push({ code: "FACILITY_CONTEXT_UNRESOLVED", message: "The candidate and requisition do not resolve to one canonical facility." });
    return { candidate, requisition, facility: null, blockers };
  }
  return { candidate, requisition, facility: facilityResolution.facility, blockers };
}

function candidateIntake(candidate = {}) {
  const snapshot = candidate.formSnapshot || {};
  return {
    candidateType: candidate.candidateType || snapshot.candidateType || "External",
    candidateTypeConfirmed: candidate.candidateTypeConfirmed === true || snapshot.candidateTypeConfirmed === true,
    candidateName: candidate.candidate || candidate.candidateName || snapshot.fullName,
    candidateEmail: candidate.candidateEmail || candidate.email || snapshot.emailAddress,
    candidatePhone: candidate.candidatePhone || candidate.phone || snapshot.phoneNumber,
    candidateSource: candidate.candidateSource || snapshot.candidateSource,
    recruiterNotes: candidate.candidateNotes || snapshot.candidateNotes,
    submissionDate: candidate.submissionDate || snapshot.submissionDate,
  };
}

function interviewDateFor(candidate = {}) {
  const value = candidate.actualInterviewAt
    || candidate.interviewCompletedAt
    || candidate.rescheduledInterviewDate
    || candidate.interviewDate
    || candidate.facilityInterviewDate
    || candidate.bookingRecord?.rescheduledDate
    || candidate.bookingRecord?.interviewDate
    || candidate.formSnapshot?.interviewDate;
  return getLocalCalendarDateKey(value);
}

function parsedLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  const source = text(value);
  const dateOnly = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsed = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function confirmedCompletedInterview(candidate = {}, now = new Date()) {
  const completionStatus = [candidate.status, candidate.interviewCompletionStatus, candidate.bookingStatus, candidate.bookingRecord?.bookingStatus]
    .some((value) => ["completed", "interview completed"].includes(lower(value)));
  const source = candidate.actualInterviewAt || candidate.interviewCompletedAt || (completionStatus ? candidate.interviewDate : "");
  const completedAt = parsedLocalDate(source);
  const current = parsedLocalDate(now);
  return completedAt && current && completedAt.getTime() <= current.getTime() ? completedAt : null;
}

function managerFeedbackAlreadyResolved(candidate = {}) {
  const recordedAt = text(candidate.hiringDecisionReceivedAt || candidate.managerFeedbackReceivedAt || candidate.facilityFeedbackReceivedAt);
  const substantiveFeedback = !NON_FINAL_FEEDBACK_VALUES.has(lower(candidate.interviewFeedback));
  const finalOutcome = [candidate.interviewOutcome, candidate.finalCandidateOutcome, candidate.hiringDecisionOutcome, candidate.archiveOutcome]
    .some((value) => FINAL_FEEDBACK_OUTCOMES.has(lower(value)));
  return Boolean(recordedAt || substantiveFeedback || finalOutcome || FINAL_FEEDBACK_OUTCOMES.has(lower(candidate.status)));
}

function candidateReadyPackageBlockers(candidate = {}, requisition = {}, facility = {}) {
  const packageData = candidate.reviewedSubmissionPackage;
  if (!packageData || typeof packageData !== "object") {
    return [{ code: "REVIEWED_PACKAGE_MISSING", message: "The reviewed Candidate Ready communication package is no longer available." }];
  }
  const result = [];
  const snapshot = packageData.snapshot || {};
  const packageRequisitionId = text(snapshot.requisition?.requisitionId || snapshot.requisition?.id);
  const packageFacilityId = text(snapshot.facility?.facilityId || snapshot.facility?.id || snapshot.requisition?.facilityId);
  const resolvedRequisitionId = text(requisition.id || requisition.requisitionId);
  const resolvedFacilityId = text(facility.id || facility.facilityId);
  const packageCandidateId = text(snapshot.intake?.candidateId || snapshot.intake?.trackerId || snapshot.candidate?.candidateId || snapshot.candidate?.id);

  if (!text(packageData.snapshotHash)) result.push({ code: "REVIEWED_PACKAGE_HASH_MISSING", message: "The saved Candidate Ready package has no stable snapshot hash." });
  if (!packageRequisitionId) result.push({ code: "REVIEWED_PACKAGE_REQUISITION_MISSING", message: "The saved Candidate Ready package has no stable requisition identity." });
  else if (packageRequisitionId !== resolvedRequisitionId) result.push({ code: "REVIEWED_PACKAGE_REQUISITION_MISMATCH", message: "The saved Candidate Ready package belongs to a different requisition." });
  if (!packageFacilityId) result.push({ code: "REVIEWED_PACKAGE_FACILITY_MISSING", message: "The saved Candidate Ready package has no stable facility identity." });
  else if (packageFacilityId !== resolvedFacilityId) result.push({ code: "REVIEWED_PACKAGE_FACILITY_MISMATCH", message: "The saved Candidate Ready package belongs to a different facility." });
  if (packageCandidateId && packageCandidateId !== text(candidate.id)) result.push({ code: "REVIEWED_PACKAGE_CANDIDATE_MISMATCH", message: "The saved Candidate Ready package belongs to a different candidate." });

  const normalized = normalizeReviewedCommunicationRecord(candidate);
  if (normalized.communicationActionStates?.facilitySubmission === ACTION_STATES.facilitySent || text(candidate.facilitySubmissionSentAt)) {
    result.push({ code: "REVIEWED_PACKAGE_ALREADY_SENT", message: "The saved Candidate Ready facility submission has already been recorded as sent." });
  }
  return result;
}

function document({ key, title, channel = "Email", recipientLabel, to = [], cc = [], subject = "", body = "", templateKey = "", templateVariant = "" }) {
  return { key, title, channel, recipientLabel, to: uniqueEmails(to), cc: uniqueEmails(cc), subject: text(subject), body: text(body), templateKey, templateVariant };
}

function renderedDocument({ category, snapshot, settings, facility }) {
  const tokens = {
    ...buildCommunicationTokenMap(snapshot),
    interview_date: interviewDateFor(snapshot.sourceCandidate),
  };
  if (category === ACTION_CENTER_CATEGORIES.followUp) {
    const templateKey = "candidate48HourFollowUp";
    const template = settings?.templates?.[templateKey] || {};
    const rendered = renderCommunicationTemplate(template, tokens);
    return {
      documents: [document({ key: "candidate-follow-up", title: "Candidate Follow-Up Email", recipientLabel: "Candidate", to: [snapshot.intake.candidateEmail], subject: rendered.subject, body: rendered.body, templateKey })],
      unresolvedTokens: rendered.unresolvedTokens,
      restrictedTokens: rendered.restrictedTokens,
    };
  }
  const templateKey = "managerFeedbackRequest";
  const template = settings?.templates?.[templateKey] || {};
  const rendered = renderCommunicationTemplate(template, tokens);
  const recipientResolution = resolveFacilitySubmissionRecipients(facility);
  return {
    documents: [document({ key: "manager-feedback", title: "Manager Feedback Request", recipientLabel: "Facility hiring manager", to: recipientResolution.recipients.to, cc: recipientResolution.recipients.cc, subject: rendered.subject, body: rendered.body, templateKey })],
    unresolvedTokens: rendered.unresolvedTokens,
    restrictedTokens: rendered.restrictedTokens,
    recipientBlockers: recipientResolution.blockers,
  };
}

function savedCandidateReadyDocuments(candidate = {}) {
  const packageData = candidate.reviewedSubmissionPackage || {};
  const rendered = packageData.rendered || {};
  const recipients = packageData.recipients || {};
  return [
    rendered.facilityEmail ? document({ key: "facility-submission", title: "Facility Submission Email", recipientLabel: "Facility contacts", to: recipients.facility?.to, cc: recipients.facility?.cc, subject: rendered.facilityEmail.subject, body: rendered.facilityEmail.body, templateKey: rendered.facilityEmail.templateKey, templateVariant: rendered.facilityEmail.variantKey }) : null,
    rendered.candidateEmail ? document({ key: "candidate-confirmation", title: "Candidate Confirmation Email", recipientLabel: "Candidate", to: recipients.candidate?.to, subject: rendered.candidateEmail.subject, body: rendered.candidateEmail.body, templateKey: rendered.candidateEmail.templateKey, templateVariant: rendered.candidateEmail.variantKey }) : null,
    rendered.candidateText ? document({ key: "candidate-text", title: "Candidate Follow-Up Text", channel: "Text", recipientLabel: "Candidate", body: rendered.candidateText.body, templateKey: rendered.candidateText.templateKey, templateVariant: rendered.candidateText.variantKey }) : null,
    rendered.atsUpdate ? document({ key: "ats-update", title: "ATS Submission Update", channel: "ATS note", recipientLabel: "ATS record", subject: rendered.atsUpdate.subject, body: rendered.atsUpdate.body, templateKey: rendered.atsUpdate.templateKey, templateVariant: rendered.atsUpdate.variantKey }) : null,
  ].filter(Boolean);
}

export function actionCenterItemSupportsCommunicationPreview(item = {}) {
  return PREVIEWABLE_CATEGORIES.has(item.category) && item.sourceType === "candidate";
}

export function buildActionCenterCommunicationPreview({ item = {}, tracker = [], requisitions = [], sites = [], settings = {}, now = new Date() } = {}) {
  const context = resolveExactContext(item, tracker, requisitions, sites);
  const blockers = [...context.blockers];
  const candidate = context.candidate;
  const requisition = context.requisition;
  const facility = context.facility;
  if (!actionCenterItemSupportsCommunicationPreview(item)) blockers.push({ code: "PREVIEW_CATEGORY_UNSUPPORTED", message: "This Action Center category does not have a communication preview." });

  let documents = [];
  let unresolvedTokens = [];
  let restrictedTokens = [];
  if (!blockers.length && item.category === ACTION_CENTER_CATEGORIES.candidateReady) {
    blockers.push(...candidateReadyPackageBlockers(candidate, requisition, facility));
    if (!blockers.length) documents = savedCandidateReadyDocuments(candidate);
    if (!blockers.length && !documents.length) blockers.push({ code: "REVIEWED_PACKAGE_MISSING", message: "The reviewed Candidate Ready communication package is no longer available." });
  } else if (!blockers.length) {
    if (item.category === ACTION_CENTER_CATEGORIES.managerFeedback) {
      if (!confirmedCompletedInterview(candidate, now)) blockers.push({ code: "INTERVIEW_COMPLETION_REQUIRED", message: "Manager Feedback communication remains unavailable until the interview is confirmed complete." });
      if (managerFeedbackAlreadyResolved(candidate)) blockers.push({ code: "MANAGER_FEEDBACK_ALREADY_RESOLVED", message: "Manager feedback or a final candidate outcome has already been recorded." });
    }
  }
  if (!blockers.length && item.category !== ACTION_CENTER_CATEGORIES.candidateReady) {
    const snapshot = createCommunicationSnapshot({ requisition, facility, intake: candidateIntake(candidate), settings });
    snapshot.sourceCandidate = clone(candidate);
    const rendered = renderedDocument({ category: item.category, snapshot, settings, facility });
    documents = rendered.documents;
    unresolvedTokens = rendered.unresolvedTokens || [];
    restrictedTokens = rendered.restrictedTokens || [];
    blockers.push(...(rendered.recipientBlockers || []));
    if (!documents[0]?.to.length) blockers.push({ code: "PREVIEW_RECIPIENT_MISSING", message: `No valid ${documents[0]?.recipientLabel?.toLowerCase() || "recipient"} is available for this preview.` });
    if (!documents[0]?.subject || !documents[0]?.body) blockers.push({ code: "PREVIEW_TEMPLATE_INCOMPLETE", message: "The selected communication template must include a subject and body." });
    if (unresolvedTokens.length) blockers.push({ code: "PREVIEW_TOKEN_UNRESOLVED", message: `The template contains unresolved tokens: ${unresolvedTokens.join(", ")}.` });
    if (restrictedTokens.length) blockers.push({ code: "PREVIEW_TOKEN_RESTRICTED", message: `The template contains restricted tokens: ${restrictedTokens.join(", ")}.` });
  }

  const previewContext = {
    candidate: text(candidate?.candidate || candidate?.candidateName || candidate?.formSnapshot?.fullName || item.context?.candidate),
    candidateId: text(candidate?.id || item.candidateId),
    requisition: text(requisition?.positionTitle || requisition?.position || item.context?.requisition),
    requisitionId: text(requisition?.id || requisition?.requisitionId || item.requisitionId),
    requisitionNumber: text(requisition?.reqNumber || item.context?.requisitionNumber),
    facility: text(facility?.siteName || facility?.facilityName || item.context?.facility),
    facilityId: text(facility?.id || facility?.facilityId || item.facilityId),
    region: text(facility?.regionName || facility?.region || item.context?.region),
  };
  const fingerprintSource = { actionId: item.id, category: item.category, context: previewContext, documents, blockers };
  return {
    id: `communication-preview-v1:${text(item.id)}`,
    actionId: text(item.id),
    category: text(item.category),
    title: item.category === ACTION_CENTER_CATEGORIES.followUp
      ? "Candidate Follow-Up Preview"
      : item.category === ACTION_CENTER_CATEGORIES.managerFeedback
        ? "Manager Feedback Preview"
        : "Candidate Ready Preview",
    explanation: text(item.explanation),
    context: previewContext,
    documents,
    blockers,
    warnings: [],
    snapshotHash: item.category === ACTION_CENTER_CATEGORIES.candidateReady
      ? text(candidate?.reviewedSubmissionPackage?.snapshotHash) || previewFingerprint(fingerprintSource)
      : previewFingerprint(fingerprintSource),
    canReview: blockers.length === 0,
    readOnly: true,
  };
}
