import { hasExplicitNonHealthcareIndustry, resolveIndustryCommunicationTemplate } from "./industryCommunicationTemplates";

const healthcare = { recruiterExperience: { industryId: "healthcare" } };
const trucking = { recruiterExperience: { industryId: "trucking" } };
const legacyDefault = { subject: "Legacy onboarding subject", body: "Legacy employer-specific instructions", useCustom: false };

function resolve(overrides = {}) {
  return resolveIndustryCommunicationTemplate({ settings: trucking, templateKey: "onboardingRoadmapCredentialed", template: { ...legacyDefault }, defaultTemplate: legacyDefault, ...overrides });
}

test("candidate role controls industry in a mixed-industry workspace", () => {
  expect(hasExplicitNonHealthcareIndustry({ settings: healthcare, role: { industryId: "trucking" } })).toBe(true);
  for (const role of [{ industryId: "healthcare" }, { roleCategory: "Healthcare" }, {}, { industryId: "unknown" }]) {
    const template = { ...legacyDefault };
    expect(resolve({ template, role })).toBe(template);
  }
});

test.each([{}, healthcare, { recruiterExperience: { industryId: "unknown" } }])("requires an explicit supported non-healthcare selection: %j", (settings) => {
  const template = { ...legacyDefault };
  expect(resolve({ settings, template })).toBe(template);
});

test.each(["trucking", "manufacturing", "hospitality", "professional", "general"])("supports the %s profile without rewriting saved settings", (industryId) => {
  const template = Object.freeze({ ...legacyDefault, id: "saved-template", version: 3, status: "Inactive", to: "{candidate_email}", cc: "review@example.test", from: "{recruiter_email}", conditionalBlocks: Object.freeze({ companyRule: "Keep this rule" }) });
  const settings = Object.freeze({ recruiterExperience: Object.freeze({ industryId }), templates: Object.freeze({ onboardingRoadmapCredentialed: template }) });
  const output = resolve({ settings, template });
  expect(output).not.toBe(template);
  expect(output.body).toContain("{candidate_name}");
  expect(output.body).toContain("{recruiter_name}");
  expect(output).toEqual({ ...template, subject: output.subject, body: output.body });
  expect(output.conditionalBlocks).toBe(template.conditionalBlocks);
  expect(settings.templates.onboardingRoadmapCredentialed).toBe(template);
  expect(template.body).toBe(legacyDefault.body);
});

test.each([
  { useCustom: true },
  { body: "A recruiter-edited body", useCustom: false },
  { subject: "A recruiter-edited subject", useCustom: false },
  { draftVariants: { External: { status: "Draft" } } },
  { draftVariants: { External: { status: "Active", approvedAt: "2026-09-22" } } },
  { variants: { External: { status: "Inactive" } } },
  { activeVariantId: "approved-external" },
  { approvedAt: "2026-09-22" },
  { activatedAt: "2026-09-22" },
])("preserves configured or approved content: %j", (configuration) => {
  const template = { ...legacyDefault, ...configuration };
  expect(resolve({ template })).toBe(template);
});

test.each([
  "onboardingRoadmapCredentialed", "onboardingRoadmapNonCredentialed",
  "onboardingStatusCredentialed", "onboardingStatusNonCredentialed",
  "onboardingApplicationEmail", "onboardingBackgroundCheck",
])("neutral %s wording avoids unverified employer actions and timelines", (templateKey) => {
  const output = resolve({ templateKey });
  expect(output.body).not.toBe(legacyDefault.body);
  expect(`${output.subject} ${output.body}`).not.toMatch(/Centurion|Paycom|DocuSign|\bAsh\b|attached|have been sent|I sent|must.*(?:hours|weeks)|\b\d+[-–]\d+\s*(?:hours|weeks)/i);
  expect(output.body).toContain("{position}");
  expect(output.body).toContain("{facility}");
});

test("text adaptation preserves status, channel and saved body", () => {
  const defaultTemplate = Object.freeze({ id: "candidate-onboarding-text", body: "Legacy text", status: "Active", channel: "Text" });
  const output = resolve({ templateKey: defaultTemplate.id, template: defaultTemplate, defaultTemplate });
  expect(output).toEqual({ ...defaultTemplate, body: output.body });
  expect(output.subject).toBeUndefined();
  expect(output.body).toContain("{candidate_first_name}");
  expect(defaultTemplate.body).toBe("Legacy text");
  expect(resolve({ templateKey: defaultTemplate.id, template: { ...defaultTemplate, body: "Custom text" }, defaultTemplate }).body).toBe("Custom text");
});

test("unknown keys or missing exact defaults do not introduce messages", () => {
  const template = { ...legacyDefault };
  expect(resolve({ templateKey: "hiringManager", template })).toBe(template);
  expect(resolve({ templateKey: "toString", template })).toBe(template);
  expect(resolve({ template, defaultTemplate: undefined })).toBe(template);
  expect(resolve({ template, defaultTemplate: { ...legacyDefault, body: "" } })).toBe(template);
  expect(resolveIndustryCommunicationTemplate()).toBeUndefined();
});
