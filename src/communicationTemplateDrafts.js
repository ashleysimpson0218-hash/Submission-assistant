import {
  ATS_RESTRICTED_TOKENS,
  buildCommunicationTokenMap,
  createCommunicationSnapshot,
  renderCommunicationTemplate,
} from "./communicationGeneration";

export const DRAFT_CANDIDATE_TYPES = Object.freeze(["External", "Internal", "Rehire"]);
export const DRAFT_STATUSES = Object.freeze(["Draft", "Needs Review", "Active", "Inactive"]);
export const EDITABLE_DRAFT_STATUSES = Object.freeze(["Draft", "Needs Review"]);

export const CANONICAL_DRAFT_TOKENS = Object.freeze([
  "candidate_name", "candidate_first_name", "candidate_type", "candidate_email", "candidate_phone", "candidate_source",
  "position", "facility", "req_number", "unique_id_number", "employment_type", "benefits_eligible", "benefits_statement",
  "fte", "weekly_hours", "shift", "schedule", "contract_duration", "employment_details", "schedule_statement", "contract_statement",
  "experience", "education", "credentials", "final_compensation", "interview_availability", "candidate_notes",
  "recruiter_name", "recruiter_email", "hiring_manager_name", "hiring_manager_email", "facility_contacts",
  "current_position", "current_facility", "internal_move_type", "internal_eligibility_status", "current_manager_aware", "reason_for_transfer",
  "previous_employee", "previous_facility", "prior_employment_dates", "rehire_eligibility", "rehire_section", "internal_employee_section",
]);

const EXTERNAL_FACILITY_BODY = `Hello {hiring_manager_name},

Please review the external candidate submission below.

Candidate: {candidate_name}
Position: {position}
Facility: {facility}
Req Number: {req_number}
Unique ID: {unique_id_number}

Employment Details:
{employment_details}

Experience:
{experience}

Credentials:
{credentials}

Expected / Final Rate:
{final_compensation}

Interview Availability:
{interview_availability}

Recruiter Notes:
{candidate_notes}

Please review and advise regarding next steps within 24–48 hours.

Thank you,

{recruiter_name}
{recruiter_email}`;

const INTERNAL_FACILITY_BODY = `Hello {hiring_manager_name},

Please review the internal employee submission below.

Employee: {candidate_name}
Current Position: {current_position}
Current Facility: {current_facility}

Position Submitted For: {position}
Facility: {facility}
Req Number: {req_number}
Unique ID: {unique_id_number}

Employment Details:
{employment_details}

Internal Move:
{internal_move_type}

Internal Eligibility:
{internal_eligibility_status}

Current Manager Aware:
{current_manager_aware}

Relevant Experience:
{experience}

Credentials:
{credentials}

Interview Availability:
{interview_availability}

Reason for Transfer or Change:
{reason_for_transfer}

Recruiter Notes:
{candidate_notes}

Please review and advise regarding next steps within 24–48 hours.

Thank you,

{recruiter_name}
{recruiter_email}`;

const CONFIRMATION_NEXT_STEPS = {
  External: `• The hiring team will review your information.
• If selected, the facility may contact you regarding an interview.
• Please monitor your phone, voicemail, email, and spam folder.
• I will share updates as they become available.`,
  Internal: `• The facility will review the internal submission.
• Additional transfer or eligibility review may be required.
• If selected, the facility or recruiter will coordinate next steps.
• I will share an update once feedback is received.`,
  Rehire: `• Rehire eligibility and facility review must be completed.
• Additional information may be requested.
• If selected, the recruiter or facility will coordinate next steps.
• I will share an update as information becomes available.`,
};

const CONFIRMATION_OPENING = {
  External: "Thank you for taking the time to speak with me. Your profile has been prepared for submission",
  Internal: "Your information has been prepared for internal consideration",
  Rehire: "Your information has been prepared for rehire consideration",
};

const CONFIRMATION_CLOSING = {
  External: "If your availability or interest changes, please contact me directly.",
  Internal: "Please notify me if your interest or availability changes.",
  Rehire: "",
};

function confirmationBody(candidateType) {
  return `Hello {candidate_first_name},

${CONFIRMATION_OPENING[candidateType]} for the {position} opportunity with {facility}.

Position Details:

{employment_details}

Next Steps:

${CONFIRMATION_NEXT_STEPS[candidateType]}

${CONFIRMATION_CLOSING[candidateType]}

Thank you,

{recruiter_name}
{recruiter_email}`.replace(/\n{3,}/g, "\n\n");
}

export const DRAFT_TEMPLATE_SPECS = Object.freeze({
  "facility:External": { templateKey: "hiringManager", communicationType: "Facility Submission", candidateType: "External", subject: "Candidate Submission: {candidate_name} | {position} | {facility}", body: EXTERNAL_FACILITY_BODY, conditionalBlocks: {} },
  "facility:Internal": { templateKey: "hiringManager", communicationType: "Facility Submission", candidateType: "Internal", subject: "Internal Employee Submission: {candidate_name} | {position} | {facility}", body: INTERNAL_FACILITY_BODY, conditionalBlocks: {} },
  "facility:Rehire": { templateKey: "hiringManager", communicationType: "Rehire Review Section", candidateType: "Rehire", subject: "", body: "", conditionalBlocks: { rehireSection: "Previous Employee: {previous_employee}\nPrevious Facility: {previous_facility}\nRehire Eligibility: {rehire_eligibility}" } },
  "candidate:External": { templateKey: "candidateConfirmation", communicationType: "Candidate Confirmation", candidateType: "External", subject: "Submission Confirmation: {position} | {facility}", body: confirmationBody("External"), conditionalBlocks: {} },
  "candidate:Internal": { templateKey: "candidateConfirmation", communicationType: "Candidate Confirmation", candidateType: "Internal", subject: "Internal Submission Review: {position} | {facility}", body: confirmationBody("Internal"), conditionalBlocks: {} },
  "candidate:Rehire": { templateKey: "candidateConfirmation", communicationType: "Candidate Confirmation", candidateType: "Rehire", subject: "Rehire Consideration Review: {position} | {facility}", body: confirmationBody("Rehire"), conditionalBlocks: {} },
  "ats:Standard": { templateKey: "atsUpdate", communicationType: "ATS Submission Update", candidateType: "Standard", subject: "Submission Prepared: {candidate_name} | {position} | {facility}", body: "Candidate: {candidate_name}\nCandidate Type: {candidate_type}\nPosition: {position}\nFacility: {facility}\nReq Number: {req_number}\nUnique ID: {unique_id_number}\nEmployment Details: {employment_details}\nExperience: {experience}\nCredentials: {credentials}\nExpected / Final Rate: {final_compensation}\nInterview Availability: {interview_availability}\n\nStatus: Submission package prepared for recruiter review.", conditionalBlocks: {} },
});

export const DRAFT_TEXT_SPECS = Object.freeze({
  External: { id: "submission-text-draft-external", candidateType: "External", body: "Hi {candidate_first_name}, your submission package for the {position} opportunity with {facility} has been prepared for review. I will share next steps as they become available. – {recruiter_name}" },
  Internal: { id: "submission-text-draft-internal", candidateType: "Internal", body: "Hi {candidate_first_name}, your internal submission package for the {position} opportunity with {facility} has been prepared for review. I will share next steps once facility and eligibility review is complete. – {recruiter_name}" },
  Rehire: { id: "submission-text-draft-rehire", candidateType: "Rehire", body: "Hi {candidate_first_name}, your rehire consideration package for the {position} opportunity with {facility} has been prepared for review. I will share next steps after eligibility and facility review. – {recruiter_name}" },
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function stableDraftHash(value) {
  const stable = (item) => Array.isArray(item) ? item.map(stable) : item && typeof item === "object" ? Object.keys(item).sort().reduce((result, key) => ({ ...result, [key]: stable(item[key]) }), {}) : item;
  const text = JSON.stringify(stable(value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function rootWithoutVariants(root = {}) {
  const { draftVariants, ...rest } = root || {};
  return rest;
}

export const DRAFT_SAVE_ERRORS = Object.freeze({
  stale: "This draft changed after you opened it. Refresh before saving to avoid overwriting newer changes.",
  root: "Root template changed unexpectedly. Draft save was cancelled.",
  coverage: "Draft coverage changed unexpectedly. Refresh and try again.",
});

export function applyDefaultRootPreservingDraftVariants(defaultRoot = {}, currentRoot = {}) {
  const next = { ...defaultRoot };
  if (currentRoot?.draftVariants) next.draftVariants = currentRoot.draftVariants;
  return next;
}

export function draftRootHashes(settings = {}) {
  return {
    hiringManager: stableDraftHash(rootWithoutVariants(settings.templates?.hiringManager || {})),
    candidateConfirmation: stableDraftHash(rootWithoutVariants(settings.templates?.candidateConfirmation || {})),
    atsUpdate: stableDraftHash(rootWithoutVariants(settings.templates?.atsUpdate || {})),
    textTemplates: stableDraftHash(settings.textTemplates || []),
  };
}

export function draftInventory(settings = {}) {
  const inventory = {};
  ["hiringManager", "candidateConfirmation", "atsUpdate"].forEach((templateKey) => {
    Object.entries(settings.templates?.[templateKey]?.draftVariants || {}).forEach(([candidateType, record]) => {
      inventory[`template:${templateKey}:${candidateType}`] = stableDraftHash(record);
    });
  });
  Object.entries(settings.communicationTemplateDrafts?.textTemplates || {}).forEach(([candidateType, record]) => {
    inventory[`text:${candidateType}`] = stableDraftHash(record);
  });
  return inventory;
}

export function draftRecordCount(settings = {}) {
  return Object.keys(draftInventory(settings)).length;
}

function draftInventoryKey({ kind, templateKey, candidateType } = {}) {
  return kind === "text" ? `text:${candidateType}` : `template:${templateKey}:${candidateType}`;
}

function selectedDraftRecord(settings = {}, { kind, templateKey, candidateType } = {}) {
  if (kind === "text") return settings.communicationTemplateDrafts?.textTemplates?.[candidateType] || null;
  return settings.templates?.[templateKey]?.draftVariants?.[candidateType] || null;
}

export function createDraftEditBaseline(settings = {}, selection = {}) {
  const selected = selectedDraftRecord(settings, selection);
  return {
    selection: clone(selection),
    rootHashes: draftRootHashes(settings),
    selectedHash: selected ? stableDraftHash(selected) : "",
    selectedExists: Boolean(selected),
    draftCount: draftRecordCount(settings),
  };
}

export function verifyDraftSaveIntegrity(beforeSettings = {}, afterSettings = {}, selection = {}) {
  if (JSON.stringify(draftRootHashes(beforeSettings)) !== JSON.stringify(draftRootHashes(afterSettings))) {
    return { ok: false, error: DRAFT_SAVE_ERRORS.root };
  }
  const before = draftInventory(beforeSettings);
  const after = draftInventory(afterSettings);
  const selectedKey = draftInventoryKey(selection);
  const unrelatedChanged = Object.keys(before).some((key) => !after[key] || (key !== selectedKey && before[key] !== after[key]));
  const beforeMappings = beforeSettings.communicationTemplateDrafts?.submissionTextTemplateByCandidateType || {};
  const afterMappings = afterSettings.communicationTemplateDrafts?.submissionTextTemplateByCandidateType || {};
  const unrelatedMappingChanged = Object.keys(beforeMappings).some((key) => {
    const selectedMapping = selection.kind === "text" && key === selection.candidateType;
    return !selectedMapping && beforeMappings[key] !== afterMappings[key];
  });
  if (Object.keys(after).length < Object.keys(before).length || unrelatedChanged || unrelatedMappingChanged) {
    return { ok: false, error: DRAFT_SAVE_ERRORS.coverage };
  }
  return { ok: true };
}

export function saveCommunicationDraftSafely({ latestSettings = {}, baseline, kind, templateKey, candidateType, draft, status = "Draft", now = new Date().toISOString() } = {}) {
  if (!baseline || JSON.stringify(baseline.rootHashes) !== JSON.stringify(draftRootHashes(latestSettings))) {
    return { ok: false, error: DRAFT_SAVE_ERRORS.root };
  }
  const latestSelected = selectedDraftRecord(latestSettings, { kind, templateKey, candidateType });
  const latestSelectedHash = latestSelected ? stableDraftHash(latestSelected) : "";
  if (Boolean(latestSelected) !== Boolean(baseline.selectedExists) || latestSelectedHash !== baseline.selectedHash) {
    return { ok: false, error: DRAFT_SAVE_ERRORS.stale };
  }
  const nextStatus = EDITABLE_DRAFT_STATUSES.includes(status) ? status : "Draft";
  const result = kind === "text"
    ? saveTextDraft(latestSettings, { candidateType, draft, status: nextStatus, now })
    : saveDraftVariant(latestSettings, { templateKey, candidateType, draft, status: nextStatus, now });
  const integrity = verifyDraftSaveIntegrity(latestSettings, result.settings, { kind, templateKey, candidateType });
  if (!integrity.ok) return integrity;
  return { ok: true, settings: result.settings, draft: result.draft, coverageBefore: draftRecordCount(latestSettings), coverageAfter: draftRecordCount(result.settings) };
}

function historyEntry(record = {}) {
  const { history, ...rest } = record;
  return clone(rest);
}

export function createInitialDraft(specKey, now = new Date().toISOString()) {
  const spec = DRAFT_TEMPLATE_SPECS[specKey];
  if (!spec) throw new Error(`Unknown draft specification: ${specKey}`);
  return {
    id: `draft-${spec.templateKey}-${String(spec.candidateType).toLowerCase()}`,
    candidateType: spec.candidateType,
    communicationType: spec.communicationType,
    status: "Draft",
    version: 1,
    subject: spec.subject,
    body: spec.body,
    conditionalBlocks: clone(spec.conditionalBlocks),
    baseHash: "",
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    approvedBy: "",
    history: [],
  };
}

export function draftVariantFor(settings = {}, templateKey = "", candidateType = "") {
  return clone(settings.templates?.[templateKey]?.draftVariants?.[candidateType] || null);
}

export function saveDraftVariant(settings = {}, { templateKey, candidateType, draft, status, now = new Date().toISOString() } = {}) {
  const currentRoot = settings.templates?.[templateKey] || {};
  const current = currentRoot.draftVariants?.[candidateType] || null;
  const nextStatus = EDITABLE_DRAFT_STATUSES.includes(status || draft?.status) ? (status || draft.status) : "Draft";
  const next = {
    ...clone(draft || {}),
    id: current?.id || draft?.id || `draft-${templateKey}-${String(candidateType).toLowerCase()}`,
    candidateType,
    status: nextStatus,
    version: current ? Number(current.version || 1) + 1 : Number(draft?.version || 1),
    conditionalBlocks: clone(draft?.conditionalBlocks || {}),
    baseHash: stableDraftHash(rootWithoutVariants(currentRoot)),
    createdAt: current?.createdAt || draft?.createdAt || now,
    updatedAt: now,
    approvedAt: null,
    approvedBy: "",
    history: current ? [...clone(current.history || []), historyEntry(current)] : clone(draft?.history || []),
  };
  return {
    settings: {
      ...settings,
      templates: {
        ...(settings.templates || {}),
        [templateKey]: {
          ...currentRoot,
          draftVariants: { ...(currentRoot.draftVariants || {}), [candidateType]: next },
        },
      },
    },
    draft: next,
  };
}

export function restoreDraftVersionAsNew(settings = {}, { templateKey, candidateType, version, now = new Date().toISOString() } = {}) {
  const current = draftVariantFor(settings, templateKey, candidateType);
  const selected = (current?.history || []).find((item) => Number(item.version) === Number(version));
  if (!selected) return { settings, draft: null, error: "Previous version not found." };
  return saveDraftVariant(settings, { templateKey, candidateType, draft: { ...selected, status: "Draft" }, status: "Draft", now });
}

export function createInitialTextDraft(candidateType, now = new Date().toISOString()) {
  const spec = DRAFT_TEXT_SPECS[candidateType];
  if (!spec) throw new Error(`Unsupported candidate type: ${candidateType}`);
  return { ...clone(spec), status: "Draft", version: 1, subject: "", conditionalBlocks: {}, baseHash: "", createdAt: now, updatedAt: now, approvedAt: null, approvedBy: "", history: [] };
}

export function saveTextDraft(settings = {}, { candidateType, draft, status, now = new Date().toISOString() } = {}) {
  const container = settings.communicationTemplateDrafts || {};
  const existing = container.textTemplates?.[candidateType] || null;
  const nextStatus = EDITABLE_DRAFT_STATUSES.includes(status || draft?.status) ? (status || draft.status) : "Draft";
  const next = {
    ...clone(draft || {}),
    id: existing?.id || draft?.id || DRAFT_TEXT_SPECS[candidateType]?.id,
    candidateType,
    status: nextStatus,
    version: existing ? Number(existing.version || 1) + 1 : Number(draft?.version || 1),
    conditionalBlocks: {},
    baseHash: stableDraftHash(settings.textTemplates || []),
    createdAt: existing?.createdAt || draft?.createdAt || now,
    updatedAt: now,
    approvedAt: null,
    approvedBy: "",
    history: existing ? [...clone(existing.history || []), historyEntry(existing)] : clone(draft?.history || []),
  };
  return {
    settings: {
      ...settings,
      communicationTemplateDrafts: {
        ...container,
        textTemplates: { ...(container.textTemplates || {}), [candidateType]: next },
        submissionTextTemplateByCandidateType: { ...(container.submissionTextTemplateByCandidateType || {}), [candidateType]: next.id },
      },
    },
    draft: next,
  };
}

export function syntheticDraftScenario(candidateType = "External", settings = {}) {
  const normalizedType = DRAFT_CANDIDATE_TYPES.includes(candidateType) ? candidateType : "External";
  const intake = {
    candidateType: normalizedType,
    candidateTypeConfirmed: true,
    candidateName: "Synthetic Preview Candidate",
    candidateEmail: "candidate@example.test",
    candidatePhone: "(555) 010-0200",
    candidateSource: "Synthetic Fixture",
    experience: "Five years of synthetic experience",
    education: "Synthetic degree",
    credentials: "Synthetic active credential",
    interviewAvailability: "Weekdays after 10 AM",
    finalCompensation: "Approved synthetic compensation",
    recruiterNotes: "Synthetic recruiter note",
    intakeCompleted: true,
    missingRequiredIntakeFields: [],
    currentPosition: "Staff Nurse",
    currentFacility: "Synthetic Current Facility",
    internalMoveType: "Transfer",
    internalEligibilityStatus: "Eligible",
    currentManagerAware: true,
    reasonForTransfer: "Synthetic career growth",
    previousEmployee: true,
    previousFacility: "Synthetic Prior Facility",
    priorEmploymentDates: "2020–2023",
    rehireEligibility: "Eligible for rehire",
    rehireEligibilityConfirmed: true,
  };
  const requisition = { id: "req-synthetic", reqNumber: "REQ-SYNTH-001", uniqueIdNumber: "SYNTH-001", siteName: "Synthetic Test Facility", positionTitle: "Registered Nurse", employmentType: "Full-time", benefitsEligible: false, weeklyHours: 36, fte: 0.9, shiftPreference: "Day", workSchedule: "Monday–Friday", status: "Active" };
  const facility = { id: "site-synthetic", siteName: "Synthetic Test Facility", hiringManagerName: "Synthetic Hiring Manager", hiringManagerEmail: "manager@example.test", adminContactName: "Synthetic Administrator", adminContactEmail: "admin@example.test" };
  return createCommunicationSnapshot({ requisition, facility, intake, settings: { ...settings, general: { recruiterName: "Synthetic Recruiter", recruiterEmail: "recruiter@example.test", ...(settings.general || {}) } } });
}

function tokensIn(value = "") {
  return String(value || "").match(/\{\{[a-zA-Z0-9_]+\}\}|\{[a-zA-Z0-9_]+\}/g) || [];
}

export function validateDraftTemplate(draft = {}, { candidateType = draft.candidateType, templateKey = "", settings = {}, snapshot } = {}) {
  const blockers = [];
  if (!DRAFT_CANDIDATE_TYPES.includes(candidateType) && candidateType !== "Standard") blockers.push("Candidate type is not supported.");
  if (!EDITABLE_DRAFT_STATUSES.includes(draft.status)) blockers.push("Draft status must be Draft or Needs Review.");
  const rawTokens = [...tokensIn(draft.subject), ...tokensIn(draft.body), ...Object.values(draft.conditionalBlocks || {}).flatMap(tokensIn)];
  const unsupportedTokens = Array.from(new Set(rawTokens.filter((token) => token.startsWith("{{") || !CANONICAL_DRAFT_TOKENS.includes(token.slice(1, -1)))));
  if (unsupportedTokens.length) blockers.push(`Unsupported tokens: ${unsupportedTokens.join(", ")}`);
  const restrictedTokens = templateKey === "atsUpdate" ? Array.from(new Set(rawTokens.map((token) => token.replace(/[{}]/g, "")).filter((token) => ATS_RESTRICTED_TOKENS.includes(token)))) : [];
  if (restrictedTokens.length) blockers.push(`Restricted ATS tokens: ${restrictedTokens.join(", ")}`);
  const scenario = snapshot || syntheticDraftScenario(candidateType === "Standard" ? "External" : candidateType, settings);
  const tokenMap = buildCommunicationTokenMap(scenario);
  let record = draft;
  if (candidateType === "Rehire" && draft.conditionalBlocks?.rehireSection && !draft.body) record = { ...draft, body: `Rehire Review:\n${draft.conditionalBlocks.rehireSection}` };
  const rendered = renderCommunicationTemplate(record, tokenMap, { restrictedTokens: templateKey === "atsUpdate" ? ATS_RESTRICTED_TOKENS : [] });
  if (rendered.unresolvedTokens.length) blockers.push(`Unresolved tokens: ${rendered.unresolvedTokens.join(", ")}`);
  if (rendered.restrictedTokens.length) blockers.push(`Restricted ATS tokens: ${rendered.restrictedTokens.join(", ")}`);
  return { valid: blockers.length === 0, status: blockers.length ? "Blocked" : draft.status, blockers: Array.from(new Set(blockers)), unsupportedTokens, restrictedTokens: Array.from(new Set([...restrictedTokens, ...rendered.restrictedTokens])), rendered, snapshot: scenario, label: "DRAFT PREVIEW — NOT ACTIVE" };
}

export function draftCoverage(settings = {}) {
  const status = (templateKey, candidateType) => settings.templates?.[templateKey]?.draftVariants?.[candidateType]?.status || "Not Configured";
  const textStatus = (candidateType) => settings.communicationTemplateDrafts?.textTemplates?.[candidateType]?.status || "Not Configured";
  return {
    facility: { External: status("hiringManager", "External"), Internal: status("hiringManager", "Internal"), Rehire: status("hiringManager", "Rehire") },
    candidate: { External: status("candidateConfirmation", "External"), Internal: status("candidateConfirmation", "Internal"), Rehire: status("candidateConfirmation", "Rehire") },
    text: { External: textStatus("External"), Internal: textStatus("Internal"), Rehire: textStatus("Rehire") },
    ats: { Standard: status("atsUpdate", "Standard") },
  };
}

export function templateCoverageWarnings(settings = {}) {
  const coverage = draftCoverage(settings);
  const warnings = [];
  if (coverage.facility.Internal === "Not Configured") warnings.push("Internal Employee Facility Submission is not configured.");
  if (coverage.candidate.External === "Draft") warnings.push("External Candidate Confirmation is still Draft.");
  if (!settings.communicationTemplateDrafts?.submissionTextTemplateByCandidateType?.Rehire) warnings.push("No submission text has been explicitly selected for Rehire candidates.");
  const atsDraft = settings.templates?.atsUpdate?.draftVariants?.Standard;
  if (atsDraft && !validateDraftTemplate(atsDraft, { candidateType: "Standard", templateKey: "atsUpdate", settings }).valid) warnings.push("ATS Submission Update contains a restricted token.");
  return warnings;
}
