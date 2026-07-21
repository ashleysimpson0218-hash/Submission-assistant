import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
const queueSource = appSource.slice(appSource.indexOf("const renderConnectQueueCards"), appSource.indexOf("function publicBookingLeadId"));
const roleMatchSource = appSource.slice(appSource.indexOf(">2. Role Match<"), appSource.indexOf(">3. Facility Submission Summary<"));
const submissionSource = appSource.slice(appSource.indexOf(">3. Facility Submission Summary<"), appSource.indexOf(">4. Submission Readiness<"));
const managementSource = appSource.slice(appSource.indexOf("function CandidateManagementPage"), appSource.indexOf("function FacilityPositionSetupPage"));

test("candidate section selector opens the primary working pages", () => {
  expect(managementSource).toContain('if (value === "connect") onOpenConnect()');
  expect(managementSource).toContain('if (value === "add") onOpenAdd()');
  expect(managementSource).toContain('if (value === "active") onOpenCandidateProfiles()');
  expect(managementSource).toContain('onChange={(event) => goToCandidateSection(event.target.value)}');
});

test("Candidate Queue keeps Add Lead with New Leads and uses compact cards", () => {
  expect(queueSource).toContain('label === "New Leads"');
  expect(queueSource).toContain('>Add Lead to Opening</button>');
  expect(queueSource).toContain('minHeight: 46');
  expect(queueSource).toContain('isNarrow ? "repeat(2, minmax(0, 1fr))"');
  const queueHeader = queueSource.slice(queueSource.indexOf("<h1"), queueSource.indexOf("renderConnectQueueCards(\"Automation Working\""));
  expect(queueHeader).not.toContain("Add Lead to Opening");
});

test("Role Match hides manual opening fields and does not duplicate submission fields", () => {
  expect(roleMatchSource).toContain("Matched opening");
  expect(roleMatchSource).toContain("manualRoleMatchOpen");
  expect(roleMatchSource).toContain("Can't find a matching requisition? Enter opening details");
  expect(roleMatchSource).not.toContain("yearsExperience");
  expect(roleMatchSource).not.toContain("estimatedCompensation");
  expect(roleMatchSource).not.toContain("startAvailability");
});

test("Facility Submission uses the approved grouped review layout", () => {
  [
    "License / Certification",
    "License / Certification Year",
    "Experience Years*",
    "Pay Rate",
    "Verification Complete",
    "Additional License / Certification",
    "Experience Summary*",
    "Why a Fit*",
    "Strengths",
    "Weaknesses / Watchouts",
    "Site-Specific Screening Questions",
    "Confirmed Available for Posted Schedule?",
    "Interview Availability Notes*",
    "Start Date Availability Notes",
    "Recruiter Notes and Observation",
    "Recruiter Recommendation*",
    "Mark as Hot Candidate",
  ].forEach((label) => expect(submissionSource).toContain(label));
  expect(submissionSource).not.toContain("Submission Notes");
  expect((submissionSource.match(/form\.yearsExperience/g) || []).length).toBe(1);
});
