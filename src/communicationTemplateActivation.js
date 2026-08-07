import { assertTestRuntime } from "./requisitionCommunicationDetails";
import {
  DRAFT_CANDIDATE_TYPES,
  createDraftEditBaseline,
  draftRootHashes,
  stableDraftHash,
  validateDraftTemplate,
} from "./communicationTemplateDrafts";

export const TEST_PROJECT_REF = "bjverobaoujhfaylyrzi";
export const TEST_APPROVER_LABEL = "Test Owner Approval";

export const ACTIVATION_ERRORS = Object.freeze({
  root: "Root template changed unexpectedly. Activation was cancelled.",
  stale: "This draft changed after the approval screen opened. Refresh before activating it.",
  review: "Both test activation confirmations are required.",
  status: "Only a Draft or Needs Review communication can be activated.",
  validation: "Draft validation must pass before activation.",
  duplicate: "Another Active record already exists for this communication type and candidate type. Deactivate it first.",
});

export const RELEASE_CONDITIONS = Object.freeze({
  candidateReadyConfirmed: "Available after Candidate Ready confirmation",
  facilitySubmissionSent: "Available after Facility Submission is marked sent",
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function rootWithoutVariants(root = {}) {
  const { draftVariants, ...rest } = root || {};
  return rest;
}

export function releaseConditionFor({ kind, templateKey } = {}) {
  return kind !== "text" && templateKey === "hiringManager" ? "candidateReadyConfirmed" : "facilitySubmissionSent";
}

export function releaseConditionLabel(condition = "") {
  return RELEASE_CONDITIONS[condition] || "Release condition is not assigned";
}

export function activationCommunicationType({ kind, templateKey } = {}) {
  if (kind === "text") return "Candidate Follow-Up Text";
  if (templateKey === "hiringManager") return "Facility Submission";
  if (templateKey === "candidateConfirmation") return "Candidate Confirmation";
  if (templateKey === "atsUpdate") return "ATS Submission Update";
  return "";
}

export function selectedCommunicationRecord(settings = {}, { kind, templateKey, candidateType } = {}) {
  if (kind === "text") return settings.communicationTemplateDrafts?.textTemplates?.[candidateType] || null;
  return settings.templates?.[templateKey]?.draftVariants?.[candidateType] || null;
}

function currentRootHash(settings = {}, { kind, templateKey } = {}) {
  if (kind === "text") return stableDraftHash(settings.textTemplates || []);
  return stableDraftHash(rootWithoutVariants(settings.templates?.[templateKey] || {}));
}

export function finalizeApprovedCommunication(record = {}, selection = {}) {
  const next = clone(record) || {};
  const { templateKey } = selection;
  if (templateKey === "atsUpdate") {
    next.body = String(next.body || "").replace("Status: Submission package prepared for recruiter review.", "Status: Candidate submitted to facility for review.");
  }
  next.releaseCondition = releaseConditionFor(selection);
  return next;
}

function recordWithoutHistory(record = {}) {
  const { history, ...rest } = record;
  return clone(rest);
}

function replaceSelectedRecord(settings = {}, selection = {}, record = {}) {
  const { kind, templateKey, candidateType } = selection;
  if (kind === "text") {
    return {
      ...settings,
      communicationTemplateDrafts: {
        ...(settings.communicationTemplateDrafts || {}),
        textTemplates: {
          ...(settings.communicationTemplateDrafts?.textTemplates || {}),
          [candidateType]: record,
        },
      },
    };
  }
  const root = settings.templates?.[templateKey] || {};
  return {
    ...settings,
    templates: {
      ...(settings.templates || {}),
      [templateKey]: {
        ...root,
        draftVariants: { ...(root.draftVariants || {}), [candidateType]: record },
      },
    },
  };
}

function allCommunicationRecords(settings = {}) {
  const records = [];
  ["hiringManager", "candidateConfirmation", "atsUpdate"].forEach((templateKey) => {
    Object.entries(settings.templates?.[templateKey]?.draftVariants || {}).forEach(([candidateType, record]) => {
      records.push({ selection: { kind: "template", templateKey, candidateType }, record });
    });
  });
  Object.entries(settings.communicationTemplateDrafts?.textTemplates || {}).forEach(([candidateType, record]) => {
    records.push({ selection: { kind: "text", templateKey: "candidateText", candidateType }, record });
  });
  return records;
}

export function activeCombinationConflicts(settings = {}, selection = {}, selectedId = "") {
  const communicationType = activationCommunicationType(selection);
  return allCommunicationRecords(settings).filter(({ selection: itemSelection, record }) => (
    record?.status === "Active"
    && record?.id !== selectedId
    && (record.candidateType || itemSelection.candidateType) === selection.candidateType
    && activationCommunicationType(itemSelection) === communicationType
  )).map(({ record }) => ({ id: record.id, version: record.version, status: record.status }));
}

export function createActivationBaseline(settings = {}, selection = {}) {
  return createDraftEditBaseline(settings, selection);
}

export function activateCommunicationVariant({ latestSettings = {}, baseline, selection = {}, confirmations = {}, runtime = {}, now = new Date().toISOString() } = {}) {
  const guard = assertTestRuntime(runtime);
  if (!guard.ok || guard.projectRef !== TEST_PROJECT_REF) return { ok: false, error: guard.error || "WelcomeFlow Test project confirmation failed." };
  if (!confirmations.reviewed || !confirmations.testOnly) return { ok: false, error: ACTIVATION_ERRORS.review };
  if (!baseline || JSON.stringify(baseline.rootHashes) !== JSON.stringify(draftRootHashes(latestSettings))) return { ok: false, error: ACTIVATION_ERRORS.root };
  const current = selectedCommunicationRecord(latestSettings, selection);
  if (!current || stableDraftHash(current) !== baseline.selectedHash) return { ok: false, error: ACTIVATION_ERRORS.stale };
  if (!["Draft", "Needs Review"].includes(current.status)) return { ok: false, error: ACTIVATION_ERRORS.status };
  if (!DRAFT_CANDIDATE_TYPES.includes(selection.candidateType) && selection.candidateType !== "Standard") return { ok: false, error: "Candidate type is not supported." };
  if (!current.baseHash || current.baseHash !== currentRootHash(latestSettings, selection)) return { ok: false, error: ACTIVATION_ERRORS.root };
  const candidate = finalizeApprovedCommunication(current, selection);
  if (!candidate.releaseCondition) return { ok: false, error: "Release condition is not assigned." };
  const validation = validateDraftTemplate(candidate, { candidateType: selection.candidateType, templateKey: selection.templateKey, settings: latestSettings });
  if (!validation.valid || validation.rendered.unresolvedTokens.length || validation.restrictedTokens.length) return { ok: false, error: ACTIVATION_ERRORS.validation, validation };
  const conflicts = activeCombinationConflicts(latestSettings, selection, current.id);
  if (conflicts.length) return { ok: false, error: ACTIVATION_ERRORS.duplicate, conflicts };
  const activationEntry = {
    event: "Activated in WelcomeFlow Test",
    previousStatus: current.status,
    newStatus: "Active",
    version: current.version,
    candidateType: current.candidateType,
    communicationType: activationCommunicationType(selection),
    releaseCondition: candidate.releaseCondition,
    timestamp: now,
    environment: "test",
  };
  const activated = {
    ...candidate,
    status: "Active",
    approvedAt: now,
    approvedBy: TEST_APPROVER_LABEL,
    activatedAt: now,
    environment: "test",
    projectRef: TEST_PROJECT_REF,
    history: [...clone(current.history || []), recordWithoutHistory(current), activationEntry],
  };
  const settings = replaceSelectedRecord(latestSettings, selection, activated);
  if (JSON.stringify(draftRootHashes(settings)) !== JSON.stringify(baseline.rootHashes)) return { ok: false, error: ACTIVATION_ERRORS.root };
  return { ok: true, settings, record: activated, validation };
}

export function deactivateCommunicationVariant({ latestSettings = {}, baseline, selection = {}, runtime = {}, now = new Date().toISOString() } = {}) {
  const guard = assertTestRuntime(runtime);
  if (!guard.ok || guard.projectRef !== TEST_PROJECT_REF) return { ok: false, error: guard.error || "WelcomeFlow Test project confirmation failed." };
  if (!baseline || JSON.stringify(baseline.rootHashes) !== JSON.stringify(draftRootHashes(latestSettings))) return { ok: false, error: ACTIVATION_ERRORS.root };
  const current = selectedCommunicationRecord(latestSettings, selection);
  if (!current || stableDraftHash(current) !== baseline.selectedHash) return { ok: false, error: ACTIVATION_ERRORS.stale };
  if (current.status !== "Active") return { ok: false, error: "Only an Active test variant can be deactivated." };
  const entry = { event: "Deactivated in WelcomeFlow Test", previousStatus: "Active", newStatus: "Inactive", version: current.version, candidateType: current.candidateType, communicationType: activationCommunicationType(selection), releaseCondition: current.releaseCondition, timestamp: now, environment: "test" };
  const record = { ...clone(current), status: "Inactive", deactivatedAt: now, history: [...clone(current.history || []), entry] };
  const settings = replaceSelectedRecord(latestSettings, selection, record);
  if (JSON.stringify(draftRootHashes(settings)) !== JSON.stringify(baseline.rootHashes)) return { ok: false, error: ACTIVATION_ERRORS.root };
  return { ok: true, settings, record };
}
