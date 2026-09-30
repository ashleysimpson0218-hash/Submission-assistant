import { INDUSTRY_PROFILES } from "./industryProfiles";

const nonHealthcareIndustryIds = new Set(INDUSTRY_PROFILES.filter((profile) => profile.id !== "healthcare").map((profile) => profile.id));

const roadmap = {
  subject: "Your next hiring steps | {position} | {facility}",
  body: "Hello {candidate_name},\n\nYour hiring team will confirm the next steps for the {position} opportunity with {facility}.\n\nPlease review the instructions provided by the hiring team and let me know if you have questions or changes to your availability. Required documents, checks, and timing depend on the position and employer.\n\nHiring team contacts:\n{facility_contacts}\n\nThank you,\n{recruiter_name}",
};

const status = {
  subject: "Onboarding status review | {candidate_name} | {position}",
  body: "Hello Team,\n\nPlease review the current onboarding status for this candidate.\n\nCandidate: {candidate_name}\nPosition: {position}\nLocation: {facility}\nRequisition: {req_number}\n\nPlease confirm any outstanding requirements, the person responsible for each next step, and when the candidate should expect an update. Confirm the start date only after the required reviews are complete.\n\nThank you,\n{recruiter_name}",
};

const neutralBuiltIns = {
  onboardingRoadmapCredentialed: roadmap,
  onboardingRoadmapNonCredentialed: roadmap,
  onboardingStatusCredentialed: status,
  onboardingStatusNonCredentialed: status,
  onboardingApplicationEmail: {
    subject: "Application next steps | {position} | {facility}",
    body: "Hello {candidate_name},\n\nPlease review the application instructions for the {position} opportunity with {facility}.\n\nApplication link: {application_link}\n\nComplete the steps requested in the application and let me know if you need help or have already completed it. I will confirm the next step with the hiring team.\n\nThank you,\n{recruiter_name}",
  },
  onboardingBackgroundCheck: {
    subject: "Onboarding requirements review | {candidate_name} | {position}",
    body: "Hello Team,\n\nPlease confirm the onboarding requirements and next steps for this candidate.\n\nCandidate: {candidate_name}\nEmail: {candidate_email}\nPhone: {candidate_phone}\nPosition: {position}\nLocation: {facility}\nRequisition: {req_number}\n\nPlease confirm which checks or documents are required, their current status, and who will coordinate the next candidate update.\n\nThank you,\n{recruiter_name}",
  },
  "candidate-onboarding-text": {
    body: "Hi {candidate_first_name}, this is {recruiter_name}. I am following up on the next hiring steps for the {position} opportunity with {facility}. Please review any instructions from the hiring team and let me know if you need help or your availability has changed.",
  },
};

/** A supplied candidate role is authoritative, including an unclassified role. */
export function hasExplicitNonHealthcareIndustry({ settings = {}, role } = {}) {
  const industryId = role === undefined || role === null
    ? settings?.recruiterExperience?.industryId
    : role.industryId;
  return nonHealthcareIndustryIds.has(industryId);
}

function hasConfiguredVariants(record) {
  return [record.draftVariants, record.variants].some((variants) => variants && typeof variants === "object" && Object.keys(variants).length > 0)
    || Boolean(record.activeVariant || record.activeVariantId || record.approvedAt || record.approvedBy || record.activatedAt || record.activatedBy);
}

/**
 * Derive employer-neutral wording without migrating saved templates or approvals.
 * The caller supplies the exact built-in default so edits cannot be mistaken for
 * defaults. Eligibility never enables, approves, sends, or records a message.
 */
export function resolveIndustryCommunicationTemplate({ settings = {}, role, templateKey = "", template, defaultTemplate } = {}) {
  const replacement = Object.prototype.hasOwnProperty.call(neutralBuiltIns, templateKey) ? neutralBuiltIns[templateKey] : null;
  if (!replacement || !template || !defaultTemplate || !hasExplicitNonHealthcareIndustry({ settings, role })) return template;
  if (template.useCustom || hasConfiguredVariants(template)) return template;
  if (typeof defaultTemplate.body !== "string" || !defaultTemplate.body.trim()) return template;
  if (template.body !== defaultTemplate.body || template.subject !== defaultTemplate.subject) return template;
  return { ...template, ...replacement };
}
