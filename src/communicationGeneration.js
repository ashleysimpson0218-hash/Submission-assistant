import {
  assertCommunicationRuntime,
  normalizeBenefitsEligible,
  normalizeOptionalText,
  normalizeWeeklyHours,
} from "./requisitionCommunicationDetails";
import {
  communicationIsOff,
  communicationIsOptional,
  communicationIsRequired,
  normalizeCommunicationWorkflow,
} from "./communicationWorkflow";

export const LEGACY_TOKEN_ALIASES = Object.freeze({
  candidateName: "candidate_name",
  candidateFirstName: "candidate_first_name",
  facilityName: "facility",
  positionTitle: "position",
  employmentType: "employment_type",
  benefitsEligible: "benefits_eligible",
  reqNumber: "req_number",
  uniqueIdNumber: "unique_id_number",
  candidateType: "candidate_type",
  candidateSource: "candidate_source",
  candidateEmail: "candidate_email",
  candidatePhone: "candidate_phone",
  interviewAvailability: "interview_availability",
  hiringManagerName: "hiring_manager_name",
  hiringManagerEmail: "hiring_manager_email",
  employmentLanguage: "employment_details",
  rate: "final_compensation",
});

export const GENERATED_COMMUNICATION_TOKENS = Object.freeze([
  "benefits_eligible",
  "benefits_statement",
  "weekly_hours",
  "contract_duration",
  "employment_details",
  "schedule_statement",
  "contract_statement",
]);

export const ATS_RESTRICTED_TOKENS = Object.freeze([
  "employee_id",
  "internal_eligibility_notes",
  "previous_employment_notes",
  "background_information",
  "private_manager_comments",
  "rehire_details",
]);

const CANDIDATE_TYPES = Object.freeze({
  external: "External",
  internal: "Internal",
  rehire: "Rehire",
});

const OPTIONAL_SECTION_TOKENS = new Set([
  "experience",
  "credentials",
  "education",
  "final_compensation",
  "interview_availability",
  "candidate_notes",
  "current_position",
  "current_facility",
  "internal_move_type",
  "internal_eligibility_status",
  "current_manager_aware",
  "reason_for_transfer",
  "previous_employee",
  "previous_facility",
  "rehire_eligibility",
  "prior_employment_dates",
  "rehire_section",
  "internal_employee_section",
  "contract_statement",
]);

function blocker(code, message, source, field = "") {
  return { code, message, source, field };
}

function warning(code, message, source, field = "") {
  return { code, message, source, field };
}

function clean(value) {
  return String(value ?? "").trim();
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

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

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function deterministicHash(value) {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function listText(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join("; ");
  return clean(value);
}

function firstName(value) {
  return clean(value).split(/\s+/)[0] || "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function uniqueEmails(values = []) {
  const seen = new Set();
  return values.flatMap((value) => String(value || "").split(/[;,]/)).map(clean).filter((email) => {
    const key = email.toLowerCase();
    if (!validEmail(email) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusIsActive(record = {}, { root = false } = {}) {
  const status = clean(record.status);
  if (!status) return root;
  return status.toLowerCase() === "active";
}

function mergeTemplate(root = {}, variant = {}) {
  return {
    ...clone(root),
    ...clone(variant),
    conditionalBlocks: {
      ...(clone(root.conditionalBlocks) || {}),
      ...(clone(variant.conditionalBlocks) || {}),
    },
  };
}

export function normalizeCandidateType(value) {
  return CANDIDATE_TYPES[clean(value).toLowerCase()] || "";
}

export function resolveExactRequisition(requisitions = [], requisitionId = "") {
  const stableId = clean(requisitionId);
  if (!stableId) return { value: null, blockers: [blocker("REQUISITION_ID_MISSING", "A stable requisition ID is required.", "requisition", "requisitionId")] };
  const matches = (Array.isArray(requisitions) ? requisitions : []).filter((item) => clean(item?.id || item?.requisitionId) === stableId);
  if (matches.length !== 1) {
    return { value: null, blockers: [blocker(matches.length ? "REQUISITION_AMBIGUOUS" : "REQUISITION_NOT_FOUND", matches.length ? "More than one requisition matched the stable ID." : "No requisition matched the stable ID.", "requisition", "requisitionId")] };
  }
  return { value: clone(matches[0]), blockers: [] };
}

export function resolveExactFacility(facilities = [], requisition = {}) {
  const records = Array.isArray(facilities) ? facilities : [];
  const facilityId = clean(requisition.facilityId || requisition.siteId);
  const facilityName = clean(requisition.siteName || requisition.facilityName || requisition.facility);
  let matches = [];
  if (facilityId) matches = records.filter((item) => clean(item?.id || item?.facilityId) === facilityId);
  else if (facilityName) matches = records.filter((item) => clean(item?.siteName || item?.facilityName || item?.name).toLowerCase() === facilityName.toLowerCase());
  if (!facilityId && !facilityName) return { value: null, blockers: [blocker("FACILITY_REFERENCE_MISSING", "The requisition does not contain a stable facility reference.", "facility", "facilityId")] };
  if (matches.length !== 1) {
    return { value: null, blockers: [blocker(matches.length ? "FACILITY_AMBIGUOUS" : "FACILITY_NOT_FOUND", matches.length ? "More than one facility matched the requisition." : "No facility matched the requisition.", "facility", facilityId ? "facilityId" : "facilityName")] };
  }
  return { value: clone(matches[0]), blockers: [] };
}

function contactSnapshot(contact = {}, fallback = {}) {
  return {
    name: clean(contact.name ?? fallback.name),
    title: clean(contact.title ?? fallback.title),
    email: clean(contact.email ?? fallback.email),
    phone: clean(contact.phone ?? fallback.phone),
  };
}

export function resolveFacilitySubmissionRecipients(facility = {}) {
  const primary = contactSnapshot(facility.primaryHiringManager, {
    name: facility.hiringManagerName,
    title: facility.hiringManagerTitle,
    email: facility.hiringManagerEmail,
    phone: facility.hiringManagerPhone,
  });
  const administrative = contactSnapshot(facility.administrativeContact, {
    name: facility.adminContactName,
    title: facility.adminContactTitle,
    email: facility.adminContactEmail,
    phone: facility.adminContactPhone,
  });
  const additional = (Array.isArray(facility.additionalHiringManagers) ? facility.additionalHiringManagers : []).map((item) => contactSnapshot(item));
  const to = uniqueEmails([primary.email, ...additional.map((item) => item.email)]);
  const cc = uniqueEmails([administrative.email]).filter((email) => !to.some((item) => item.toLowerCase() === email.toLowerCase()));
  return {
    recipients: { to, cc },
    contacts: { primaryHiringManager: primary, administrativeContact: administrative, additionalHiringManagers: additional },
    blockers: to.length || cc.length ? [] : [blocker("FACILITY_RECIPIENT_MISSING", "No valid recipient exists on the exact selected facility.", "facility", "recipients")],
  };
}

export function buildScheduleStatement(requisition = {}) {
  const hours = normalizeWeeklyHours(requisition.weeklyHours);
  const shift = clean(requisition.shiftPreference);
  const schedule = clean(requisition.workSchedule);
  const employmentType = clean(requisition.employmentType).toLowerCase();
  const parts = [];
  if (hours !== null) parts.push(`This position is scheduled for approximately ${hours} hours per week.`);
  else if (employmentType === "prn" && /as needed|facility need/i.test(schedule)) parts.push("Hours are scheduled according to facility needs.");
  else if (schedule) parts.push(`The work schedule is ${schedule}.`);
  if (shift) parts.push(`The assigned shift is ${shift}.`);
  return parts.join(" ");
}

export function buildContractStatement(requisition = {}) {
  const duration = normalizeOptionalText(requisition.contractDuration);
  return clean(requisition.employmentType).toLowerCase() === "contract" && duration
    ? `This contract position has an expected duration of ${duration}.`
    : "";
}

export function buildEmploymentDetails(requisition = {}) {
  const employmentType = clean(requisition.employmentType);
  const normalizedType = employmentType.toLowerCase();
  const benefits = normalizeBenefitsEligible(requisition.benefitsEligible);
  const hours = normalizeWeeklyHours(requisition.weeklyHours);
  const shift = clean(requisition.shiftPreference);
  const schedule = clean(requisition.workSchedule);
  const duration = normalizeOptionalText(requisition.contractDuration);
  const typeLabel = employmentType ? employmentType.toLowerCase() : "position";
  const sentences = [];
  if (normalizedType === "contract" && duration) sentences.push(`This is a contract position with an expected duration of ${duration}.`);
  else if (normalizedType === "prn") sentences.push("This is a PRN position.");
  else if (employmentType) sentences.push(`This is a ${typeLabel} position${hours !== null ? ` scheduled for approximately ${hours} hours per week` : ""}.`);
  if (normalizedType === "prn" && /as needed|facility need/i.test(schedule)) sentences.push("Hours are scheduled according to facility needs.");
  else if (hours === null && schedule) sentences.push(`The work schedule is ${schedule}.`);
  if (shift) sentences.push(`The assigned shift is ${shift}.`);
  if (benefits === true) sentences.push("This position is benefits eligible.");
  else if (benefits === false) sentences.push("This position is not benefits eligible.");
  else sentences.push("Benefits eligibility has not been confirmed.");
  return sentences.join(" ");
}

function candidateTypeBlockers(intake = {}, candidateType = "") {
  const result = [];
  if (!candidateType) result.push(blocker("CANDIDATE_TYPE_INVALID", "Candidate type is missing or unrecognized.", "intake", "candidateType"));
  if (intake.candidateTypeConfirmed !== true) result.push(blocker("CANDIDATE_TYPE_UNCONFIRMED", "Candidate type must be explicitly confirmed.", "intake", "candidateTypeConfirmed"));
  if (candidateType === "Internal") {
    if (!clean(intake.currentPosition) || !clean(intake.currentFacility)) result.push(blocker("INTERNAL_MOVEMENT_DATA_MISSING", "Internal movement requires the current position and facility.", "intake", "internalMovement"));
    if (!clean(intake.internalEligibilityStatus)) result.push(blocker("INTERNAL_ELIGIBILITY_MISSING", "Internal movement eligibility has not been confirmed.", "intake", "internalEligibilityStatus"));
  }
  if (candidateType === "Rehire") {
    if (intake.rehireEligibilityConfirmed !== true || !clean(intake.rehireEligibility)) result.push(blocker("REHIRE_ELIGIBILITY_MISSING", "Rehire eligibility must be confirmed with a result.", "intake", "rehireEligibility"));
    if (!clean(intake.previousFacility) && !clean(intake.priorEmploymentDates)) result.push(blocker("REHIRE_HISTORY_MISSING", "Required prior-employment information is missing.", "intake", "previousFacility"));
  }
  return result;
}

export function createCommunicationSnapshot({ requisition, facility, intake = {}, positionRequirements = {}, settings = {} } = {}) {
  const candidateType = normalizeCandidateType(intake.candidateType);
  const benefitsEligible = normalizeBenefitsEligible(requisition?.benefitsEligible);
  const facilityRecipients = resolveFacilitySubmissionRecipients(facility || {});
  const snapshot = {
    requisition: {
      requisitionId: clean(requisition?.id || requisition?.requisitionId),
      reqNumber: clean(requisition?.reqNumber),
      uniqueIdNumber: clean(requisition?.uniqueIdNumber),
      facility: clean(requisition?.siteName || requisition?.facilityName || requisition?.facility),
      facilityId: clean(requisition?.facilityId || requisition?.siteId),
      position: clean(requisition?.positionTitle || requisition?.position),
      employmentType: clean(requisition?.employmentType),
      benefitsEligible,
      fte: requisition?.fte ?? null,
      weeklyHours: normalizeWeeklyHours(requisition?.weeklyHours),
      shiftPreference: clean(requisition?.shiftPreference),
      workSchedule: clean(requisition?.workSchedule),
      contractDuration: normalizeOptionalText(requisition?.contractDuration),
    },
    intake: {
      candidateType,
      candidateTypeConfirmed: intake.candidateTypeConfirmed === true,
      candidateName: clean(intake.candidateName || intake.fullName),
      candidateEmail: clean(intake.candidateEmail || intake.emailAddress),
      candidatePhone: clean(intake.candidatePhone || intake.phoneNumber),
      candidateSource: clean(intake.candidateSource),
      experience: clone(intake.experience ?? intake.yearsExperience ?? ""),
      education: clone(intake.education ?? []),
      credentials: clone(intake.credentials ?? intake.certifications ?? []),
      interviewAvailability: clean(intake.interviewAvailability),
      finalCompensation: clean(intake.finalCompensation),
      recruiterNotes: clean(intake.recruiterNotes || intake.candidateNotes),
      intakeCompleted: intake.intakeCompleted === true,
      intakeCompletedAt: clean(intake.intakeCompletedAt),
      submissionDate: clean(intake.submissionDate),
      missingRequiredIntakeFields: clone(Array.isArray(intake.missingRequiredIntakeFields) ? intake.missingRequiredIntakeFields : []),
    },
    internalEmployee: candidateType === "Internal" ? {
      employeeId: clean(intake.employeeId),
      currentPosition: clean(intake.currentPosition),
      currentFacility: clean(intake.currentFacility),
      currentManager: clean(intake.currentManager),
      internalMoveType: clean(intake.internalMoveType),
      internalEligibilityStatus: clean(intake.internalEligibilityStatus),
      currentManagerAware: intake.currentManagerAware === true,
      reasonForTransfer: clean(intake.reasonForTransfer),
    } : null,
    rehire: candidateType === "Rehire" ? {
      previousEmployee: intake.previousEmployee === true || clean(intake.previousEmployee).toLowerCase() === "yes",
      previousFacility: clean(intake.previousFacility),
      priorEmploymentDates: clean(intake.priorEmploymentDates),
      rehireEligibility: clean(intake.rehireEligibility),
      rehireEligibilityConfirmed: intake.rehireEligibilityConfirmed === true,
    } : null,
    facility: {
      facilityId: clean(facility?.id || facility?.facilityId),
      facilityName: clean(facility?.siteName || facility?.facilityName || facility?.name),
      ...facilityRecipients.contacts,
    },
    positionRequirements: clone(positionRequirements || {}),
    templateSettings: clone(settings || {}),
  };
  return snapshot;
}

function rehireSection(snapshot = {}) {
  if (!snapshot.rehire) return "";
  return [
    "Prior Employment",
    snapshot.rehire.previousFacility ? `Previous facility: ${snapshot.rehire.previousFacility}` : "",
    snapshot.rehire.priorEmploymentDates ? `Prior employment dates: ${snapshot.rehire.priorEmploymentDates}` : "",
    snapshot.rehire.rehireEligibility ? `Rehire eligibility: ${snapshot.rehire.rehireEligibility}` : "",
  ].filter(Boolean).join("\n");
}

function internalEmployeeSection(snapshot = {}) {
  if (!snapshot.internalEmployee) return "";
  return [
    "Internal Employee Movement",
    snapshot.internalEmployee.currentPosition ? `Current position: ${snapshot.internalEmployee.currentPosition}` : "",
    snapshot.internalEmployee.currentFacility ? `Current facility: ${snapshot.internalEmployee.currentFacility}` : "",
    snapshot.internalEmployee.internalMoveType ? `Move type: ${snapshot.internalEmployee.internalMoveType}` : "",
    snapshot.internalEmployee.internalEligibilityStatus ? `Internal eligibility: ${snapshot.internalEmployee.internalEligibilityStatus}` : "",
  ].filter(Boolean).join("\n");
}

export function buildCommunicationTokenMap(snapshot = {}) {
  const req = snapshot.requisition || {};
  const intake = snapshot.intake || {};
  const facility = snapshot.facility || {};
  const benefits = normalizeBenefitsEligible(req.benefitsEligible);
  const internal = snapshot.internalEmployee || null;
  const rehire = snapshot.rehire || null;
  const primary = facility.primaryHiringManager || {};
  const contacts = [primary, facility.administrativeContact, ...(facility.additionalHiringManagers || [])].filter((item) => item?.name || item?.email);
  return {
    candidate_name: intake.candidateName || "",
    candidate_first_name: firstName(intake.candidateName),
    candidate_email: intake.candidateEmail || "",
    candidate_phone: intake.candidatePhone || "",
    candidate_source: intake.candidateSource || "",
    candidate_type: intake.candidateType || "",
    facility: facility.facilityName || req.facility || "",
    position: req.position || "",
    req_number: req.reqNumber || "",
    unique_id_number: req.uniqueIdNumber || "",
    employment_type: req.employmentType || "",
    benefits_eligible: benefits === true ? "Benefits Eligible" : benefits === false ? "No Benefits" : "Benefits eligibility has not been confirmed.",
    benefits_statement: benefits === true ? "This position is benefits eligible." : benefits === false ? "This position is not benefits eligible." : "Benefits eligibility has not been confirmed.",
    fte: req.fte ?? "",
    weekly_hours: req.weeklyHours ?? "",
    shift: req.shiftPreference || "",
    schedule: req.workSchedule || "",
    contract_duration: req.contractDuration || "",
    employment_details: buildEmploymentDetails(req),
    schedule_statement: buildScheduleStatement(req),
    contract_statement: buildContractStatement(req),
    experience: listText(intake.experience),
    education: listText(intake.education),
    credentials: listText(intake.credentials),
    interview_availability: intake.interviewAvailability || "",
    final_compensation: intake.finalCompensation || "",
    candidate_notes: intake.recruiterNotes || "",
    recruiter_name: clean(snapshot.templateSettings?.general?.recruiterName),
    recruiter_email: clean(snapshot.templateSettings?.general?.recruiterEmail),
    hiring_manager_name: primary.name || "",
    hiring_manager_email: primary.email || "",
    facility_contacts: contacts.map((item) => [item.name, item.title, item.email, item.phone].filter(Boolean).join(" | ")).join("\n"),
    intake_completion_date: intake.intakeCompletedAt || "",
    submission_date: intake.submissionDate || "",
    current_position: internal?.currentPosition || "",
    current_facility: internal?.currentFacility || "",
    internal_move_type: internal?.internalMoveType || "",
    internal_eligibility_status: internal?.internalEligibilityStatus || "",
    current_manager_aware: internal ? (internal.currentManagerAware === true ? "Yes" : internal.currentManagerAware === false ? "No" : "") : "",
    reason_for_transfer: internal?.reasonForTransfer || "",
    previous_employee: rehire ? (rehire.previousEmployee === true ? "Yes" : rehire.previousEmployee === false ? "No" : "") : "",
    previous_facility: rehire?.previousFacility || "",
    rehire_eligibility: rehire?.rehireEligibility || "",
    prior_employment_dates: rehire?.priorEmploymentDates || "",
    rehire_section: rehireSection(snapshot),
    internal_employee_section: internalEmployeeSection(snapshot),
  };
}

function tokenName(rawToken = "") {
  const inner = rawToken.startsWith("{{") ? rawToken.slice(2, -2) : rawToken.slice(1, -1);
  return LEGACY_TOKEN_ALIASES[inner] || inner;
}

export function normalizeTemplateTokenSyntax(template = "") {
  return String(template || "")
    .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, name) => `{${LEGACY_TOKEN_ALIASES[name] || name}}`);
}

function removeEmptyOptionalSections(template, tokens) {
  let result = String(template || "");
  OPTIONAL_SECTION_TOKENS.forEach((name) => {
    if (clean(tokens[name])) return;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result
      .replace(new RegExp(`(^|\\n)[^\\n{}:]{1,80}:\\s*\\n\\s*\\{\\{?${escaped}\\}?\\}\\s*(?=\\n|$)`, "gi"), "$1")
      .replace(new RegExp(`(^|\\n)[^\\n{}]{0,80}:\\s*\\{\\{?${escaped}\\}?\\}\\s*(?=\\n|$)`, "gi"), "$1")
      .replace(new RegExp(`(^|\\n)\\s*\\{\\{?${escaped}\\}?\\}\\s*(?=\\n|$)`, "gi"), "$1");
  });
  return result.replace(/\n{3,}/g, "\n\n").trim();
}

export function renderCommunicationTemplate(template = {}, tokens = {}, { restrictedTokens = [] } = {}) {
  const unresolvedTokens = [];
  const restricted = [];
  const restrictedSet = new Set(restrictedTokens);
  const renderPart = (value = "") => {
    const prepared = removeEmptyOptionalSections(value, tokens);
    return prepared.replace(/\{\{[a-zA-Z0-9_]+\}\}|\{[a-zA-Z0-9_]+\}/g, (raw) => {
      const name = tokenName(raw);
      if (restrictedSet.has(name)) {
        if (!restricted.includes(name)) restricted.push(name);
        return `[RESTRICTED TOKEN: ${raw}]`;
      }
      if (!Object.prototype.hasOwnProperty.call(tokens, name)) {
        if (!unresolvedTokens.includes(raw)) unresolvedTokens.push(raw);
        return `[UNRESOLVED TOKEN: ${raw}]`;
      }
      return String(tokens[name] ?? "");
    }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  };
  return {
    subject: renderPart(template.subject || ""),
    body: renderPart(template.body || ""),
    unresolvedTokens,
    restrictedTokens: restricted,
  };
}

export function resolveCandidateTypeTemplate(rootTemplate = {}, candidateType = "") {
  const rootActive = statusIsActive(rootTemplate, { root: true });
  const variants = rootTemplate.draftVariants || {};
  if (candidateType === "Internal") {
    const variant = variants.Internal;
    if (!variant || !statusIsActive(variant)) {
      return { template: clone(rootTemplate), variantKey: "root-comparison", active: false, blockers: [blocker("INTERNAL_VARIANT_NOT_APPROVED", "The Internal submission variant is not approved and Active.", "template", "hiringManager.draftVariants.Internal")] };
    }
    return { template: mergeTemplate(rootTemplate, variant), variantKey: "Internal", active: rootActive, blockers: rootActive ? [] : [blocker("ROOT_TEMPLATE_INACTIVE", "The root facility submission template is not Active.", "template", "hiringManager")] };
  }
  if (candidateType === "External") {
    const variant = variants.External;
    if (variant && statusIsActive(variant)) return { template: mergeTemplate(rootTemplate, variant), variantKey: "External", active: rootActive, blockers: rootActive ? [] : [blocker("ROOT_TEMPLATE_INACTIVE", "The root facility submission template is not Active.", "template", "hiringManager")] };
    if (!Object.keys(variants).length) return { template: clone(rootTemplate), variantKey: "root", active: rootActive, blockers: rootActive ? [] : [blocker("FACILITY_TEMPLATE_INACTIVE", "The facility submission template is not Active.", "template", "hiringManager")] };
    return { template: clone(rootTemplate), variantKey: "root-comparison", active: false, blockers: [blocker("EXTERNAL_VARIANT_NOT_APPROVED", "The External facility submission variant is not approved and Active.", "template", "hiringManager.draftVariants.External")] };
  }
  if (candidateType === "Rehire") {
    const variant = variants.Rehire;
    const legacyRootOnly = !Object.keys(variants).length;
    const approvedBlocks = variant && statusIsActive(variant) ? variant.conditionalBlocks : legacyRootOnly ? rootTemplate.conditionalBlocks : {};
    const approvedSection = clean(approvedBlocks?.rehireSection);
    const template = variant && statusIsActive(variant)
      ? mergeTemplate(rootTemplate, {
        conditionalBlocks: variant.conditionalBlocks,
        body: clean(rootTemplate.body).includes("{rehire_section}")
          ? rootTemplate.body
          : `${clean(rootTemplate.body)}\n\nRehire Review:\n${approvedSection}`,
      })
      : clone(rootTemplate);
    return {
      template,
      variantKey: variant && statusIsActive(variant) ? "Rehire" : legacyRootOnly ? "root+rehire" : "root-comparison",
      active: rootActive && Boolean(approvedSection),
      blockers: [
        ...(rootActive ? [] : [blocker("FACILITY_TEMPLATE_INACTIVE", "The facility submission template is not Active.", "template", "hiringManager")]),
        ...(approvedSection ? [] : [blocker("REHIRE_SECTION_NOT_APPROVED", "An Active Rehire conditional section is required.", "template", "conditionalBlocks.rehireSection")]),
      ],
    };
  }
  return { template: clone(rootTemplate), variantKey: "none", active: false, blockers: [] };
}

function applyConditionalBlocks(record = {}, tokens = {}) {
  const next = { ...tokens };
  const blocks = record.conditionalBlocks || {};
  if (tokens.rehire_section && clean(blocks.rehireSection)) next.rehire_section = `${clean(blocks.rehireSection)}\n${tokens.rehire_section}`;
  if (tokens.internal_employee_section && clean(blocks.internalEmployeeSection)) next.internal_employee_section = `${clean(blocks.internalEmployeeSection)}\n${tokens.internal_employee_section}`;
  return next;
}

function resolveActiveVariant(settings = {}, key = "", variantKey = "") {
  const root = settings.templates?.[key] || {};
  const variant = root.draftVariants?.[variantKey];
  if (!Object.keys(root.draftVariants || {}).length) {
    if (!statusIsActive(root, { root: true })) return { record: clone(root), variantKey: "root", blockers: [blocker("TEMPLATE_INACTIVE", `Required template ${key} is not Active.`, "template", key)] };
    return { record: clone(root), variantKey: "root", blockers: [] };
  }
  if (!variant || !statusIsActive(variant)) {
    return { record: {}, variantKey, blockers: [blocker("ACTIVE_VARIANT_MISSING", `The ${variantKey} ${key} variant is not Active in WelcomeFlow Test.`, "template", `${key}.draftVariants.${variantKey}`)] };
  }
  return { record: mergeTemplate(root, variant), variantKey, blockers: [] };
}

export function validateCommunicationPreview(preview = {}) {
  const blockers = Array.isArray(preview.blockers) ? preview.blockers : [];
  return { ...preview, canConfirm: blockers.length === 0 };
}

export function buildCommunicationPreview({
  runtime = {},
  requisitions = [],
  facilities = [],
  intake = {},
  positionRequirements = {},
  settings = {},
  requisitionId = "",
  selectedTextTemplateId = "",
  textRequired = false,
} = {}) {
  const blockers = [];
  const warnings = [];
  const runtimeResult = assertCommunicationRuntime(runtime);
  if (!runtimeResult.ok) blockers.push(blocker("TEST_RUNTIME_REJECTED", runtimeResult.error, "runtime", "projectRef"));

  const requisitionResult = resolveExactRequisition(requisitions, requisitionId);
  blockers.push(...requisitionResult.blockers);
  const facilityResult = requisitionResult.value ? resolveExactFacility(facilities, requisitionResult.value) : { value: null, blockers: [] };
  blockers.push(...facilityResult.blockers);

  const candidateType = normalizeCandidateType(intake.candidateType);
  blockers.push(...candidateTypeBlockers(intake, candidateType));
  if (intake.intakeCompleted !== true) blockers.push(blocker("INTAKE_NOT_COMPLETED", "The intake must be completed before confirmation.", "intake", "intakeCompleted"));
  const missingRequired = Array.isArray(intake.missingRequiredIntakeFields) ? intake.missingRequiredIntakeFields : [];
  if (missingRequired.length) blockers.push(blocker("INTAKE_FIELDS_MISSING", `Required intake fields are missing: ${missingRequired.join(", ")}.`, "intake", "missingRequiredIntakeFields"));

  const snapshot = requisitionResult.value && facilityResult.value
    ? createCommunicationSnapshot({ requisition: requisitionResult.value, facility: facilityResult.value, intake, positionRequirements, settings })
    : {};
  if (requisitionResult.value && normalizeBenefitsEligible(requisitionResult.value.benefitsEligible) === null) {
    blockers.push(blocker("BENEFITS_UNCONFIRMED", "Benefits eligibility has not been confirmed.", "requisition", "benefitsEligible"));
    warnings.push(warning("BENEFITS_PREVIEW_WARNING", "Benefits eligibility has not been confirmed.", "requisition", "benefitsEligible"));
  }

  const facilityRecipientResult = facilityResult.value ? resolveFacilitySubmissionRecipients(facilityResult.value) : { recipients: { to: [], cc: [] }, blockers: [] };
  blockers.push(...facilityRecipientResult.blockers);
  const communicationPlan = normalizeCommunicationWorkflow(settings);
  const candidateEmailOff = communicationIsOff(communicationPlan, "candidateEmail");
  const candidateEmailOptional = communicationIsOptional(communicationPlan, "candidateEmail");
  const candidateTextOff = communicationIsOff(communicationPlan, "candidateText");
  const candidateTextRequired = textRequired || communicationIsRequired(communicationPlan, "candidateText");
  const candidateTo = !candidateEmailOff && validEmail(snapshot.intake?.candidateEmail) ? [snapshot.intake.candidateEmail] : [];
  if (!candidateEmailOff && !candidateTo.length) {
    const issue = warning("CANDIDATE_EMAIL_INVALID", "A valid candidate email is not available, so the optional candidate email was omitted.", "intake", "candidateEmail");
    if (candidateEmailOptional) warnings.push(issue);
    else blockers.push(blocker(issue.code, "A valid candidate email is required for the candidate confirmation.", issue.source, issue.field));
  }

  const tokens = buildCommunicationTokenMap(snapshot);
  const rendered = {
    facilityEmail: { templateKey: "hiringManager", variantKey: "none", subject: "", body: "" },
    candidateEmail: null,
    candidateText: null,
    atsUpdate: { templateKey: "atsUpdate", variantKey: "none", subject: "", body: "", releaseCondition: "facilitySubmissionSent" },
  };
  const unresolvedTokens = [];
  const restrictedTokens = [];

  const rootFacility = settings.templates?.hiringManager || {};
  const facilityTemplate = resolveCandidateTypeTemplate(rootFacility, candidateType);
  blockers.push(...facilityTemplate.blockers);
  rendered.facilityEmail.variantKey = facilityTemplate.variantKey;
  rendered.facilityEmail.releaseCondition = facilityTemplate.template?.releaseCondition || "candidateReadyConfirmed";
  if (facilityTemplate.template && typeof facilityTemplate.template === "object") {
    const result = renderCommunicationTemplate(facilityTemplate.template, applyConditionalBlocks(facilityTemplate.template, tokens));
    rendered.facilityEmail.subject = result.subject;
    rendered.facilityEmail.body = result.body;
    unresolvedTokens.push(...result.unresolvedTokens);
  }

  if (!candidateEmailOff && candidateTo.length) {
    const resolution = resolveActiveVariant(settings, "candidateConfirmation", candidateType);
    const candidateTemplateProblems = [...resolution.blockers];
    const result = renderCommunicationTemplate(resolution.record, applyConditionalBlocks(resolution.record, tokens));
    candidateTemplateProblems.push(...result.unresolvedTokens.map((token) => blocker("UNRESOLVED_CANDIDATE_EMAIL_TOKEN", `Candidate email contains unresolved token ${token}.`, "template", "candidateConfirmation")));
    if (candidateEmailOptional && candidateTemplateProblems.length) {
      warnings.push(warning("OPTIONAL_CANDIDATE_EMAIL_OMITTED", candidateTemplateProblems.map((item) => item.message).join(" "), "template", "candidateConfirmation"));
    } else {
      blockers.push(...candidateTemplateProblems);
      unresolvedTokens.push(...result.unresolvedTokens);
      rendered.candidateEmail = {
        templateKey: "candidateConfirmation",
        variantKey: resolution.variantKey,
        subject: result.subject,
        body: result.body,
        releaseCondition: resolution.record.releaseCondition || "facilitySubmissionSent",
      };
    }
  }

  const atsResolution = resolveActiveVariant(settings, "atsUpdate", "Standard");
  blockers.push(...atsResolution.blockers);
  const atsResult = renderCommunicationTemplate(atsResolution.record, applyConditionalBlocks(atsResolution.record, tokens), { restrictedTokens: ATS_RESTRICTED_TOKENS });
  rendered.atsUpdate.variantKey = atsResolution.variantKey;
  rendered.atsUpdate.releaseCondition = atsResolution.record.releaseCondition || "facilitySubmissionSent";
  rendered.atsUpdate.subject = atsResult.subject;
  rendered.atsUpdate.body = atsResult.body;
  unresolvedTokens.push(...atsResult.unresolvedTokens);
  restrictedTokens.push(...atsResult.restrictedTokens);

  const textMappingId = settings.communicationTemplateDrafts?.submissionTextTemplateByCandidateType?.[candidateType];
  const candidateTypeText = settings.communicationTemplateDrafts?.textTemplates?.[candidateType];
  const textTemplates = Array.isArray(settings.textTemplates) ? settings.textTemplates : [];
  const selectedRootText = selectedTextTemplateId ? textTemplates.find((item) => clean(item?.id) === clean(selectedTextTemplateId)) : null;
  const selectedText = textMappingId && candidateTypeText?.id === textMappingId ? candidateTypeText : selectedRootText;
  if (candidateTextOff) {
    // An intentionally disabled channel is absent from the reviewed package and never blocks progression.
  } else if (!selectedText) {
    const message = "No explicit candidate submission text template is configured.";
    if (candidateTextRequired) blockers.push(blocker("TEXT_TEMPLATE_REQUIRED", message, "template", "selectedTextTemplateId"));
    else warnings.push(warning("TEXT_TEMPLATE_NOT_CONFIGURED", message, "template", "selectedTextTemplateId"));
  } else if (!statusIsActive(selectedText, { root: true })) {
    const issue = blocker("TEXT_TEMPLATE_INACTIVE", "The selected text template is not Active.", "template", "selectedTextTemplateId");
    if (candidateTextRequired) blockers.push(issue);
    else warnings.push(warning(issue.code, issue.message, issue.source, issue.field));
  } else {
    const textResult = renderCommunicationTemplate(selectedText, tokens);
    if (textResult.unresolvedTokens.length && !candidateTextRequired) {
      warnings.push(warning("OPTIONAL_TEXT_OMITTED", `Optional candidate text contains unresolved tokens: ${textResult.unresolvedTokens.join(", ")}.`, "template", "selectedTextTemplateId"));
    } else {
      rendered.candidateText = { templateKey: selectedText.id, variantKey: candidateType, body: textResult.body, releaseCondition: selectedText.releaseCondition || "facilitySubmissionSent" };
      unresolvedTokens.push(...textResult.unresolvedTokens);
    }
  }

  const uniqueUnresolved = Array.from(new Set(unresolvedTokens));
  const uniqueRestricted = Array.from(new Set(restrictedTokens));
  if (uniqueUnresolved.length) blockers.push(blocker("UNRESOLVED_TEMPLATE_TOKENS", `Active required communications contain unresolved tokens: ${uniqueUnresolved.join(", ")}.`, "template", "tokens"));
  if (uniqueRestricted.length) blockers.push(blocker("ATS_RESTRICTED_TOKENS", `The ATS template requests restricted tokens: ${uniqueRestricted.join(", ")}.`, "template", "atsUpdate"));

  return validateCommunicationPreview({
    canConfirm: false,
    blockers,
    warnings,
    snapshot,
    recipients: {
      facility: facilityRecipientResult.recipients,
      candidate: { to: candidateTo },
    },
    rendered,
    communicationPlan,
    unresolvedTokens: uniqueUnresolved,
    restrictedTokens: uniqueRestricted,
    snapshotHash: Object.keys(snapshot).length ? deterministicHash(snapshot) : "",
  });
}
