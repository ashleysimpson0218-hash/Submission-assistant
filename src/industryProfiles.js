// Industry packs add recruiter prompts; they never certify eligibility or replace records.
const question = (id, label, options = "") => ({ id, question: label, type: options ? "Dropdown" : "Text", options, matchText: "", source: "Industry" });

export const INDUSTRY_PROFILES = [
  { id: "healthcare", name: "Healthcare", location: "Facility", category: "Healthcare", description: "Clinical and nonclinical hiring across facilities.", roles: ["Registered Nurse", "Licensed Practical Nurse", "Certified Nursing Assistant"], questions: [] },
  { id: "trucking", name: "Trucking & Logistics", location: "Terminal", category: "Transportation", description: "Driver recruiting with route, equipment, and home-time fit.", roles: ["CDL Class A Driver", "CDL Class B Driver", "Dispatcher"], questions: [
    question("license-class", "License class reported by candidate", "Class A;Class B;Class C;Non-CDL;Needs clarification"),
    question("endorsements", "Endorsements and restrictions to verify"),
    question("driving-experience", "Relevant driving experience and equipment operated"),
    question("route", "Preferred route type", "Local;Regional;Over the road;Dedicated;Open to discussion"),
    question("home-time", "Home-time expectations and schedule availability"),
    question("pay-basis", "Expected pay and basis (hour, mile, trip, or salary)"),
    question("verification", "Outstanding employer verification steps and next owner"),
  ] },
  { id: "manufacturing", name: "Manufacturing & Skilled Trades", location: "Site", category: "Manufacturing", description: "Skills, equipment, shift coverage, and site requirements.", roles: ["Production Operator", "Maintenance Technician", "Electrician"], questions: [
    question("skills", "Equipment, trade experience, and certifications to verify"),
    question("schedule", "Shift, overtime, and location fit"),
  ] },
  { id: "hospitality", name: "Hospitality & Retail", location: "Location", category: "Hospitality", description: "Customer-facing hiring, availability, and seasonal staffing.", roles: ["Guest Services Associate", "Retail Associate", "Restaurant Manager"], questions: [
    question("service", "Relevant service experience and role strengths"),
    question("availability", "Weekend, holiday, and shift availability"),
  ] },
  { id: "professional", name: "Professional & Technology", location: "Team", category: "Professional", description: "Skills, portfolio evidence, work arrangement, and compensation.", roles: ["Software Engineer", "Project Manager", "Account Executive"], questions: [
    question("skills", "Relevant skills, projects, and evidence to review"),
    question("arrangement", "Work arrangement, location, and compensation expectations"),
  ] },
  { id: "general", name: "Other / Mixed Industries", location: "Location", category: "Other", description: "A shared workflow with your own roles and screening questions.", roles: [], questions: [] },
];

export function industryProfile(settings = {}) {
  return INDUSTRY_PROFILES.find((item) => item.id === settings.recruiterExperience?.industryId) || INDUSTRY_PROFILES.find((item) => item.id === "general");
}

export function resolveIndustryRole(settings = {}, position = "") {
  const matches = (settings.roles || []).filter((role) => role.status === "Active" && role.positionTitle === position);
  return matches.length === 1 ? matches[0] : {};
}

export function applyIndustryProfile(settings, industryId) {
  const profile = INDUSTRY_PROFILES.find((item) => item.id === industryId);
  if (!profile) return settings;
  const existing = Array.isArray(settings.roles) ? settings.roles : [];
  const roleTitles = new Set(existing.map((role) => String(role.positionTitle || "").trim().toLowerCase()));
  const ids = new Set(existing.map((role) => role.id));
  const addedRoles = profile.roles.filter((title) => !roleTitles.has(title.toLowerCase())).map((title) => {
    const baseId = `industry-${profile.id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    let id = baseId;
    for (let suffix = 2; ids.has(id); suffix += 1) id = `${baseId}-${suffix}`;
    ids.add(id);
    const requiresLicense = /^(CDL|Registered Nurse|Licensed Practical Nurse|Certified Nursing Assistant)/.test(title);
    return {
      id, positionTitle: title, industryId: profile.id, roleCategory: profile.category,
      roleCredentialType: requiresLicense ? "Credentialed" : "Non-credentialed",
      roleScopeType: "All", roleScopeValue: "All", status: "Active",
      requiresLicense, requiresCpr: profile.id === "healthcare", requiresFte: false,
      requiresShift: false, requiresWorkExpectations: true, requiresManagerApproval: true,
      requiresStartDate: true,
    };
  });
  return {
    ...settings,
    recruiterExperience: { ...settings.recruiterExperience, industryId: profile.id },
    roles: [...existing, ...addedRoles],
    options: { ...settings.options, roleTypes: [...new Set([...(settings.options?.roleTypes || []), profile.category])] },
  };
}

export function industryScreeningQuestions(role, requisition) {
  // Only an explicitly configured role gets prompts. Workspace branding must not
  // attach driver questions to nurses, or invent requirements from job-title text.
  if (!role || (requisition?.positionTitle && requisition.positionTitle !== role.positionTitle)) return [];
  const profile = INDUSTRY_PROFILES.find((item) => item.id === role.industryId);
  if (!profile) return [];
  // Dispatchers use the general logistics conversation, not driver credential prompts.
  const prompts = profile.id === "trucking" && !role.requiresLicense && !role.positionTitle.startsWith("CDL ")
    ? profile.questions.filter((item) => ["route", "home-time", "pay-basis"].includes(item.id))
    : profile.questions;
  return prompts.map((item) => ({ ...item, id: `industry-${profile.id}-${item.id}` }));
}

export function notesWithIndustryScreening(form = {}) {
  const context = form.industryScreeningContext;
  if (!context || context.position !== form.position || !Array.isArray(context.questions)) return form.candidateNotes || "";
  const answers = form.siteSpecificAnswers || {};
  const lines = context.questions.filter((item) => typeof item.id === "string" && item.id.startsWith("industry-") && typeof item.question === "string")
    .filter((item) => typeof answers[item.id] === "string" && answers[item.id].trim())
    .map((item) => `${item.question}: ${answers[item.id].trim()}`);
  return [form.candidateNotes || "", lines.length ? `Industry screening (candidate reported; verify as required):\n${lines.join("\n")}` : ""].filter(Boolean).join("\n\n");
}

export function workspaceSaveStatus({ cloudStatus = "", cloudEnabled = false, browserEnabled = false } = {}) {
  if (!cloudEnabled && !browserEnabled) return { label: "Session only", detail: "Changes last for this session. Workspace saving is disabled.", tone: "attention" };
  if (/blocked|paused|not ready|failed|error/i.test(cloudStatus)) return { label: "Save needs attention", detail: cloudStatus, tone: "attention" };
  if (/saving|loading|confirming/i.test(cloudStatus)) return { label: "Saving / loading", detail: cloudStatus, tone: "attention" };
  if (cloudEnabled && /saved|connected/i.test(cloudStatus)) return { label: "Cloud connected", detail: cloudStatus, tone: "ready" };
  return { label: browserEnabled ? "Browser backup" : "Save not confirmed", detail: cloudStatus || "A successful cloud save has not been confirmed.", tone: "attention" };
}

export function recruiterSetupSteps(settings = {}) {
  const general = settings.general || {};
  return [
    { id: "identity", title: "Add your recruiter identity", detail: "Your name and email feed candidate and leadership messages.", done: Boolean(general.recruiterName?.trim() && general.recruiterEmail?.trim() && general.companyName?.trim()), target: "general" },
    { id: "locations", title: "Add locations and decision makers", detail: "Give each opening a location and the right manager contact.", done: (settings.sites || []).some((item) => item.status !== "Inactive" && item.siteName?.trim() && item.hiringManagerEmail?.trim()), target: "sites" },
    { id: "roles", title: "Review role requirements", detail: "Review licenses, screening prompts, and work expectations for each role.", done: (settings.roles || []).some((item) => item.status === "Active" && item.positionTitle?.trim()), target: "roles" },
    { id: "openings", title: "Add active openings", detail: "Use a unique requisition number to keep candidates and reports connected.", done: (settings.requisitions || []).some((item) => ["Active", "Open", "Approved", "Posted"].includes(item.status) && item.reqNumber && item.siteName && item.positionTitle), target: "requisitions" },
    { id: "follow-up", title: "Set follow-up timing", detail: "Decide when candidate and manager follow-ups should appear in Work.", done: Number(settings.options?.workflowRules?.candidateFollowUpDays) > 0 && Number(settings.options?.workflowRules?.managerNudgeDays) > 0, target: "workflow" },
  ];
}

export function mobilePageValue(activePage, reportsTab) {
  if (activePage === "reports" && ["exports", "hub"].includes(reportsTab)) return "reporting";
  if (["hot", "hotLegacy", "hotMockup"].includes(activePage)) return "hot";
  if (["tracker", "workspace"].includes(activePage)) return "workspace";
  if (["actions", "homeLegacy"].includes(activePage)) return "home";
  return activePage;
}
