import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
const queueSource = appSource.slice(appSource.indexOf("const renderConnectQueueCards"), appSource.indexOf("function publicBookingLeadId"));
const roleMatchSource = appSource.slice(appSource.indexOf(">2. Role Match<"), appSource.indexOf(">3. Facility Submission Summary<"));
const submissionSource = appSource.slice(appSource.indexOf(">3. Facility Submission Summary<"), appSource.indexOf(">4. Submission Readiness<"));
const readinessSource = appSource.slice(appSource.indexOf(">4. Submission Readiness<"), appSource.indexOf('>Clear Form</Button>'));

test("shared candidate section selector opens the primary working pages", () => {
  expect(appSource).toContain('if (section === "queue")');
  expect(appSource).toContain('if (section === "intake")');
  expect(appSource).toContain('if (section === "profiles")');
  expect(appSource).toContain('if (section === "archived")');
  expect(appSource).toContain('if (section === "screening")');
  expect(appSource).toContain('onChange={navigateToCandidateSection}');
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
  expect(roleMatchSource).not.toContain("Matched opening");
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
    "License / Certification Note",
    "Experience Summary*",
    "Why a Fit*",
    "Strengths",
    "Weaknesses / Watchouts",
    "Site-Specific Screening Questions",
    "Confirmed Working Schedule?",
    "Schedule Conflicts?",
    "Interview Availability",
    "Start Date Availability",
    "Recruiter Notes and Observation",
    "Recruiter Recommendation*",
    "Mark as Hot Candidate",
  ].forEach((label) => expect(submissionSource).toContain(label));
  expect(submissionSource).not.toContain("Additional License / Certification");
  expect(submissionSource).not.toContain("Schedule Availability Notes");
  expect(submissionSource).not.toContain("Start Date Availability Notes");
  expect(submissionSource).toContain('repeat(4, minmax(0, 1fr))');
  expect(submissionSource).not.toContain("Submission Notes");
  expect((submissionSource.match(/form\.yearsExperience/g) || []).length).toBe(1);
});

test("Submission Readiness shows only missing items and where to fix them", () => {
  expect(appSource).toContain("const snapshotMissingReadinessItems = snapshotReadinessItems.filter((item) => !item.ready)");
  expect(appSource).toContain("form.licenseVerificationComplete === true");
  expect(appSource).toContain("form.scheduleConfirmed === false && Boolean(form.scheduleNotes)");
  expect(readinessSource).toContain("snapshotMissingReadinessItems.map");
  expect(readinessSource).not.toContain("snapshotReadinessItems.map");
  expect(readinessSource).toContain("Fix in {item.fixLabel}");
  expect(readinessSource).toContain("Nothing is missing.");
  expect(readinessSource).not.toContain("Auto complete");
});
