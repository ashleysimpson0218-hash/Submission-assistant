const fs = require("fs");
const path = require("path");

const PRODUCTION_PROJECT_REF = "qfpgednixvveelgwfylv";
const SAFE_EMAIL = "test.manager@example.com";
const SAFE_PHONE = "(404) 555-0100";

function decodeCopyText(value = "") {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      result += character;
      continue;
    }
    const next = value[index + 1];
    index += 1;
    const replacements = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v", "\\": "\\" };
    result += Object.prototype.hasOwnProperty.call(replacements, next) ? replacements[next] : next;
  }
  return result;
}

function extractWorkspaceFromDump(sourceDump) {
  const content = fs.readFileSync(sourceDump, "utf8");
  const lines = content.split(/\r?\n/);
  const copyIndex = lines.findIndex((line) => /^COPY public\.welcomeflow_workspace_state \(workspace_id, data, updated_at\) FROM stdin;$/.test(line));
  if (copyIndex < 0) throw new Error("The backup does not contain the expected WelcomeFlow workspace COPY block.");
  const row = lines.slice(copyIndex + 1).find((line) => line && line !== "\\.");
  if (!row) throw new Error("The backup does not contain a workspace row.");
  const fields = row.split("\t");
  if (fields.length !== 3) throw new Error("The workspace backup row has an unexpected shape.");
  return { workspaceId: decodeCopyText(fields[0]), data: JSON.parse(decodeCopyText(fields[1])), updatedAt: decodeCopyText(fields[2]) };
}

function candidateNamesFromWorkspace(workspace = {}) {
  const names = new Set();
  const add = (value) => {
    const name = String(value || "").trim();
    if (name.length >= 4 && name.split(/\s+/).length >= 2) names.add(name);
  };
  (workspace.tracker || []).forEach((row) => { add(row?.candidate); add(row?.fullName); add(row?.formSnapshot?.fullName); });
  (workspace.hotLeads || []).forEach((row) => { add(row?.candidateName); add(row?.fullName); });
  (workspace.manualQueueItems || []).forEach((row) => { add(row?.candidate); add(row?.candidateName); });
  (workspace.intakeDrafts || []).forEach((row) => { add(row?.form?.fullName); add(row?.candidateName); });
  add(workspace.intakeDraft?.form?.fullName);
  return [...names];
}

function sanitizeString(value, candidateNames = []) {
  let clean = String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, SAFE_EMAIL)
    .replace(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g, SAFE_PHONE)
    .replace(/https?:\/\/[^\s"'<>]+/gi, "https://example.com/test")
    .replace(new RegExp(PRODUCTION_PROJECT_REF, "gi"), "test-project-ref")
    .replace(/https:\/\/qfpgednixvveelgwfylv\.supabase\.co/gi, "https://test-project-ref.supabase.co");
  candidateNames.forEach((name) => {
    clean = clean.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "Test Candidate");
  });
  return clean;
}

const OMIT_KEY = /(?:^|_)(?:notes?|history|resume|upload(?:ed)?|attachment|document|employee_?id|background|candidate_?compensation|ats_?output)(?:$|_)/i;
const EMAIL_KEY = /email/i;
const PHONE_KEY = /phone|mobile|fax/i;
const PERSON_NAME_KEY = /(?:contact|manager|recruiter|director|administrator|scheduler|coordinator|owner)Name$/i;

function sanitizeConfigurationValue(value, candidateNames = [], key = "") {
  if (OMIT_KEY.test(key)) return undefined;
  if (EMAIL_KEY.test(key)) return SAFE_EMAIL;
  if (PHONE_KEY.test(key)) return SAFE_PHONE;
  if (PERSON_NAME_KEY.test(key)) return "Test Contact";
  if (Array.isArray(value)) return value.map((item) => sanitizeConfigurationValue(item, candidateNames, key)).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .map(([childKey, childValue]) => [childKey, sanitizeConfigurationValue(childValue, candidateNames, childKey)])
      .filter(([, childValue]) => childValue !== undefined));
  }
  return typeof value === "string" ? sanitizeString(value, candidateNames) : value;
}

function syntheticContacts(contacts = [], candidateNames = []) {
  return contacts.map((contact, index) => ({
    id: `test-contact-${index + 1}`,
    department: sanitizeString(contact?.department || "Test Department", candidateNames),
    duty: sanitizeString(contact?.duty || contact?.role || "Test Contact", candidateNames),
    title: sanitizeString(contact?.title || "Test Contact", candidateNames),
    status: contact?.status || "Active",
    name: `Test Contact ${index + 1}`,
    email: index % 2 ? "test.recruiter@example.com" : SAFE_EMAIL,
    phone: SAFE_PHONE,
  }));
}

function buildSanitizedWorkspace(workspace = {}, destinationRef) {
  if (!destinationRef) throw new Error("A destination project ref is required.");
  if (destinationRef === PRODUCTION_PROJECT_REF) throw new Error("Refusing to sanitize for the production Supabase project.");
  const settings = workspace.settings || {};
  const candidateNames = candidateNamesFromWorkspace(workspace);
  return {
    settings: {
      sites: sanitizeConfigurationValue(settings.sites || [], candidateNames, "sites"),
      roles: sanitizeConfigurationValue(settings.roles || [], candidateNames, "roles"),
      requisitions: sanitizeConfigurationValue(settings.requisitions || [], candidateNames, "requisitions"),
      options: sanitizeConfigurationValue(settings.options || {}, candidateNames, "options"),
      intakeRules: sanitizeConfigurationValue(settings.intakeRules || {}, candidateNames, "intakeRules"),
      templates: sanitizeConfigurationValue(settings.templates || {}, candidateNames, "templates"),
      textTemplates: sanitizeConfigurationValue(settings.textTemplates || [], candidateNames, "textTemplates"),
      compensationStructure: sanitizeConfigurationValue(settings.compensationStructure || {}, candidateNames, "compensationStructure"),
      contacts: syntheticContacts(settings.contacts || [], candidateNames),
      featureFlags: { communicationReadinessAudit: true },
    },
    tracker: [], history: [], notesText: "", manualQueueItems: [], hotLeads: [], reportHistory: [],
    intakeDraft: null, intakeDrafts: [], hotLeadBulkDrafts: [],
    testMetadata: { environment: "test", destinationProjectRef: destinationRef, syntheticDataOnly: true },
  };
}

function validateSanitizedWorkspace(sanitized, candidateNames = []) {
  const serialized = JSON.stringify(sanitized);
  const outsideExampleEmails = [...serialized.matchAll(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi)].filter((match) => match[1].toLowerCase() !== "example.com");
  const disallowedPhones = [...serialized.matchAll(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g)].filter((match) => !/555[\s.-]?01\d{2}/.test(match[0]));
  const lower = serialized.toLowerCase();
  const candidateMatches = candidateNames.filter((name) => lower.includes(name.toLowerCase()));
  const forbiddenKeys = [];
  const walk = (value, currentPath = "") => {
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, child]) => {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      const containsData = Array.isArray(child) ? child.length > 0 : (child && typeof child === "object" ? Object.keys(child).length > 0 : Boolean(child));
      if (OMIT_KEY.test(key) && containsData) forbiddenKeys.push(childPath);
      walk(child, childPath);
    });
  };
  walk(sanitized);
  const failures = [];
  if (outsideExampleEmails.length) failures.push("non-example email");
  if (disallowedPhones.length) failures.push("non-555 phone");
  if (candidateMatches.length) failures.push("production candidate name");
  if (forbiddenKeys.length) failures.push("forbidden data key");
  const disallowedUrls = [...serialized.matchAll(/https?:\/\/[^\s"'<>]+/gi)].filter((match) => {
    try { return new URL(match[0]).hostname.toLowerCase() !== "example.com"; } catch { return true; }
  });
  if (disallowedUrls.length) failures.push("production or non-test URL");
  if (lower.includes(PRODUCTION_PROJECT_REF) || lower.includes(`https://${PRODUCTION_PROJECT_REF}.supabase.co`)) failures.push("production project reference");
  return { passed: failures.length === 0, failures };
}

function summaryFor(sanitized, outputPath, piiScan) {
  return {
    sanitizedFileLocation: outputPath,
    fileSize: fs.statSync(outputPath).size,
    categoriesPreserved: ["facility setup", "position setup", "requisition setup", "options and workflow settings", "intake structure", "communication template structure", "non-candidate rate rules", "synthetic contacts"],
    categoriesRemoved: ["candidates", "tracker records", "hot leads", "intake drafts", "history", "reports", "communications", "resume and uploads", "candidate notes and compensation", "real contact details"],
    facilityConfigurations: sanitized.settings.sites.length,
    positions: sanitized.settings.roles.length,
    requisitions: sanitized.settings.requisitions.length,
    piiScanPassed: piiScan.passed,
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function main() {
  const sourceDump = argument("--source-dump");
  const destinationRef = argument("--destination-ref");
  const outputPath = argument("--output");
  if (!sourceDump) throw new Error("--source-dump is required.");
  const source = extractWorkspaceFromDump(sourceDump);
  if (process.argv.includes("--inspect")) {
    const settings = source.data.settings || {};
    console.log(JSON.stringify({ sourceProjectRef: PRODUCTION_PROJECT_REF, workspaceId: source.workspaceId, workspaceKeys: Object.keys(source.data).sort(), settingsKeys: Object.keys(settings).sort(), siteKeys: Object.keys(settings.sites?.[0] || {}).sort(), roleKeys: Object.keys(settings.roles?.[0] || {}).sort(), requisitionKeys: Object.keys(settings.requisitions?.[0] || {}).sort() }));
    return;
  }
  if (!destinationRef || !outputPath) throw new Error("--destination-ref and --output are required.");
  console.log(JSON.stringify({ sourceProjectRef: PRODUCTION_PROJECT_REF, destinationProjectRef: destinationRef, refsAreDifferent: destinationRef !== PRODUCTION_PROJECT_REF }));
  if (destinationRef === PRODUCTION_PROJECT_REF) throw new Error("Refusing to run because the destination equals production.");
  const sanitized = buildSanitizedWorkspace(source.data, destinationRef);
  const piiScan = validateSanitizedWorkspace(sanitized, candidateNamesFromWorkspace(source.data));
  if (!piiScan.passed) throw new Error(`PII scan failed: ${piiScan.failures.join(", ")}.`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(sanitized, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify(summaryFor(sanitized, outputPath, piiScan)));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { PRODUCTION_PROJECT_REF, buildSanitizedWorkspace, candidateNamesFromWorkspace, validateSanitizedWorkspace };
