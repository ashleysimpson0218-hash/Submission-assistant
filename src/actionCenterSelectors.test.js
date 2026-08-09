import {
  ACTION_CENTER_CATEGORIES,
  buildRecruiterActionCenter,
  filterRecruiterActionCenter,
} from "./actionCenterSelectors";

const NOW = new Date("2026-08-08T16:00:00.000Z");
const facility = {
  id: "facility-1",
  siteName: "Synthetic Facility",
  regionName: "Synthetic Region",
  status: "Active",
  hiringManagerName: "Synthetic Manager",
  hiringManagerEmail: "manager@example.test",
};
const requisition = {
  id: "req-1",
  reqNumber: "SYN-1001",
  positionTitle: "Registered Nurse",
  siteName: "Synthetic Facility",
  facilityId: "facility-1",
  status: "Active",
  openings: 2,
};

function candidate(overrides = {}) {
  return {
    id: "candidate-1",
    candidate: "Synthetic Candidate",
    status: "Submitted",
    nextAction: "Follow up with candidate",
    nextActionDueDate: "2026-08-07",
    lastActionAt: "2026-08-04T16:00:00.000Z",
    candidateNotes: "Synthetic note",
    currentOwner: "Recruiter",
    ownerType: "Recruiter",
    requisitionId: "req-1",
    reqNumber: "SYN-1001",
    position: "Registered Nurse",
    site: "Synthetic Facility",
    facilityId: "facility-1",
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildRecruiterActionCenter({
    tracker: [candidate()],
    requisitions: [requisition],
    sites: [facility],
    calendarEvents: [],
    workflowRules: { candidateFollowUpDays: 2, interviewFeedbackHours: 24 },
    now: NOW,
    ...overrides,
  });
}

test("derives a recruiter follow-up with stable source context and a read-only contract", () => {
  const result = build();
  const item = result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp);
  expect(item).toMatchObject({
    id: "action-center-v1:Follow-up Due:candidate:candidate-1:requisition:req-1",
    sourceId: "candidate-1",
    candidateId: "candidate-1",
    requisitionId: "req-1",
    facilityId: "facility-1",
    sideEffectClass: "read-only",
    destination: { type: "candidate", id: "candidate-1", label: "Open Candidate" },
  });
  expect(item.explanation).toMatch(/overdue|activity/i);
  expect(result.readOnly).toBe(true);
});

test("derives overdue manager feedback from completed interview context", () => {
  const result = build({
    tracker: [candidate({
      id: "candidate-feedback",
      status: "Interview Completed",
      nextAction: "Request feedback",
      ownerType: "Hiring Manager",
      currentOwner: "Synthetic Manager",
      actualInterviewAt: "2026-08-06T15:00:00.000Z",
      nextActionDueDate: "2026-08-07T15:00:00.000Z",
    })],
  });
  const item = result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback);
  expect(item).toMatchObject({ sourceId: "candidate-feedback", riskLevel: "High", recommendedAction: "Review manager feedback follow-up" });
  expect(item.explanation).toMatch(/interview.*hours ago.*feedback is overdue/i);
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp && entry.sourceId === "candidate-feedback")).toBe(false);
});

test("does not create a manager-feedback action after feedback or a final decision exists", () => {
  const result = build({
    tracker: [candidate({ id: "candidate-decided", status: "Offer", nextAction: "Prepare offer", actualInterviewAt: "2026-08-05T15:00:00.000Z", hiringDecisionReceivedAt: "2026-08-06T15:00:00.000Z" })],
  });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback)).toBe(false);
});

test.each([
  ["future scheduled interview", { status: "Interview Scheduled", nextAction: "Confirm interview", interviewDate: "2026-08-09T16:00:00.000Z" }],
  ["past scheduled but incomplete interview", { status: "Interview Scheduled", nextAction: "Confirm interview", interviewDate: "2026-08-07T16:00:00.000Z" }],
  ["future actual-interview timestamp", { status: "Interview Completed", nextAction: "Confirm interview", actualInterviewAt: "2026-08-09T16:00:00.000Z" }],
])("does not treat a %s as completed", (label, interview) => {
  const result = build({ tracker: [candidate({ id: `candidate-${label}`, ...interview })] });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback)).toBe(false);
});

test("keeps placeholder outcomes eligible for Manager Feedback", () => {
  const result = build({
    tracker: [candidate({
      id: "candidate-still-active",
      status: "Interview Completed",
      nextAction: "Request feedback",
      ownerType: "Hiring Manager",
      actualInterviewAt: "2026-08-06T15:00:00.000Z",
      finalCandidateOutcome: "Still Active",
      interviewOutcome: "Feedback pending",
    })],
  });
  expect(result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback)).toMatchObject({
    candidateId: "candidate-still-active",
    riskLevel: "High",
  });
});

test.each(["Hired", "Rejected", "Withdrawn", "Offer Accepted"])('removes Manager Feedback after the canonical final outcome "%s"', (finalCandidateOutcome) => {
  const result = build({
    tracker: [candidate({
      id: `candidate-final-${finalCandidateOutcome}`,
      status: "Interview Completed",
      nextAction: "Request feedback",
      actualInterviewAt: "2026-08-06T15:00:00.000Z",
      finalCandidateOutcome,
    })],
  });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback)).toBe(false);
});

test("keeps an explicit feedback task pending when completion is not confirmed", () => {
  const result = build({
    tracker: [candidate({ id: "candidate-feedback-task", status: "Interview Scheduled", nextAction: "Request feedback", interviewDate: "2026-08-10T16:00:00.000Z" })],
  });
  const item = result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback);
  expect(item).toMatchObject({ title: "Manager feedback pending for Synthetic Candidate", riskLevel: "Medium", transitionAt: "" });
  expect(item.explanation).toMatch(/feedback task.*pending/i);
  expect(item.explanation).not.toMatch(/complete|overdue/i);
});

test("shows completed-interview feedback as pending before the configured threshold", () => {
  const result = build({
    tracker: [candidate({ id: "candidate-pending-feedback", status: "Interview Completed", nextAction: "Request feedback", ownerType: "Hiring Manager", actualInterviewAt: "2026-08-08T04:30:00.000Z" })],
    workflowRules: { interviewFeedbackHours: 24 },
  });
  const item = result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback);
  expect(item).toMatchObject({ title: "Manager feedback pending for Synthetic Candidate", riskLevel: "Medium", priorityScore: 52 });
  expect(item.explanation).toMatch(/feedback is pending/i);
  expect(item.explanation).not.toMatch(/overdue/i);
});

test.each([
  ["2026-08-07T16:00:01.000Z", "pending"],
  ["2026-08-07T16:00:00.000Z", "overdue"],
  ["2026-08-07T15:59:59.000Z", "overdue"],
])("classifies feedback at the configured threshold for interview time %s", (interviewAt, state) => {
  const result = build({
    tracker: [candidate({ id: `candidate-${state}`, status: "Interview Completed", nextAction: "Request feedback", ownerType: "Hiring Manager", actualInterviewAt: interviewAt })],
    workflowRules: { interviewFeedbackHours: 24 },
  });
  const item = result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.managerFeedback);
  expect(item.title.toLowerCase()).toContain(state);
  expect(item.riskLevel).toBe(state === "overdue" ? "High" : "Medium");
});

test("derives a Candidate Ready submission only when the reviewed package remains unsent", () => {
  const pending = candidate({
    id: "candidate-ready",
    status: "Ready for Facility Submission",
    nextAction: "Send facility submission",
    reviewedSubmissionPackage: { rendered: {}, recipients: {}, snapshot: {} },
    communicationActionStates: { facilitySubmission: "Ready to Send" },
  });
  const sent = { ...pending, id: "candidate-sent", facilitySubmissionSentAt: "2026-08-08T14:00:00.000Z", communicationActionStates: { facilitySubmission: "Sent" } };
  const result = build({ tracker: [pending, sent] });
  expect(result.items.filter((entry) => entry.category === ACTION_CENTER_CATEGORIES.candidateReady)).toHaveLength(1);
  expect(result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.candidateReady)).toMatchObject({ sourceId: "candidate-ready", destination: { id: "candidate-ready" } });
});

test("allows legitimate Manager Feedback and Candidate Ready actions to coexist", () => {
  const result = build({
    tracker: [candidate({
      id: "candidate-multi-category",
      status: "Interview Completed",
      nextAction: "Request feedback",
      ownerType: "Hiring Manager",
      actualInterviewAt: "2026-08-08T12:00:00.000Z",
      reviewedSubmissionPackage: { rendered: {}, recipients: {}, snapshot: {} },
      communicationActionStates: { facilitySubmission: "Ready to Send" },
    })],
  });
  expect(result.items.filter((entry) => entry.candidateId === "candidate-multi-category").map((entry) => entry.category)).toEqual(expect.arrayContaining([
    ACTION_CENTER_CATEGORIES.managerFeedback,
    ACTION_CENTER_CATEGORIES.candidateReady,
  ]));
});

test("turns canonical missing-data issues into exact blocker targets", () => {
  const result = build({ tracker: [candidate({ id: "candidate-missing", candidateNotes: "", nextAction: "" })] });
  const note = result.items.find((entry) => entry.issueCode === "missing-candidate-notes");
  const action = result.items.find((entry) => entry.issueCode === "missing-next-action");
  expect(note).toMatchObject({ category: ACTION_CENTER_CATEGORIES.dataBlocker, sourceType: "candidate", sourceId: "candidate-missing", destination: { type: "candidate", id: "candidate-missing" } });
  expect(action).toBeDefined();
  expect(note.context).toMatchObject({ requisitionId: "req-1", facilityId: "facility-1" });
});

test("surfaces a missing facility contact only for a facility in active scope", () => {
  const noContact = { ...facility, id: "facility-no-contact", siteName: "No Contact Facility", hiringManagerName: "", hiringManagerEmail: "" };
  const req = { ...requisition, id: "req-no-contact", facilityId: "facility-no-contact", siteName: "No Contact Facility" };
  const result = build({ tracker: [], requisitions: [req], sites: [noContact, { id: "unused", siteName: "Unused Facility", status: "Active" }] });
  const contacts = result.items.filter((entry) => entry.issueCode === "facility-recipient-missing");
  expect(contacts).toHaveLength(1);
  expect(contacts[0]).toMatchObject({ sourceType: "facility", sourceId: "facility-no-contact", facilityId: "facility-no-contact", destination: { type: "facility", id: "facility-no-contact" } });
});

test.each(["Paused", "Cancelled", "Closed", "Filled", "Archived", "Inactive", "Unknown", ""])("does not create a facility-contact blocker for %s requisitions", (status) => {
  const noContact = { ...facility, id: "facility-inactive-contact", siteName: "Inactive Contact Facility", hiringManagerName: "", hiringManagerEmail: "" };
  const req = { ...requisition, id: `req-${status || "blank"}`, facilityId: noContact.id, siteName: noContact.siteName, status };
  const result = build({ tracker: [], requisitions: [req], sites: [noContact] });
  expect(result.items.some((entry) => entry.issueCode === "facility-recipient-missing")).toBe(false);
});

test.each(["Closed", "Rejected", "Hired", "Ineligible", "Archived", "Do Not Contact", "Not Interested", "Unresponsive"])("excludes terminal or non-contactable status %s", (status) => {
  const result = build({ tracker: [candidate({ status })] });
  expect(result.items.some((entry) => entry.candidateId === "candidate-1")).toBe(false);
});

test.each(["Closed", "Filled", "Archived", "Cancelled", "Inactive"])("excludes operational actions tied to %s requisitions", (status) => {
  const result = build({ requisitions: [{ ...requisition, status }] });
  expect(result.items.some((entry) => [ACTION_CENTER_CATEGORIES.followUp, ACTION_CENTER_CATEGORIES.managerFeedback, ACTION_CENTER_CATEGORIES.candidateReady].includes(entry.category))).toBe(false);
});

test("keeps the active requisition when a separate closed requisition exists", () => {
  const result = build({ requisitions: [requisition, { ...requisition, id: "req-closed", reqNumber: "SYN-CLOSED", status: "Closed" }] });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp && entry.requisitionId === "req-1")).toBe(true);
  expect(result.items.some((entry) => entry.requisitionId === "req-closed")).toBe(false);
});

test.each([
  ["reqId", { reqId: "req-1" }],
  ["selectedRequisitionId", { selectedRequisitionId: "req-1" }],
  ["formSnapshot.selectedRequisitionId", { formSnapshot: { selectedRequisitionId: "req-1" } }],
  ["formSnapshot.requisitionId", { formSnapshot: { requisitionId: "req-1" } }],
  ["uniqueIdNumber", { uniqueIdNumber: "SYN-UNIQUE" }],
  ["reqNumber", { reqNumber: "SYN-1001" }],
])("resolves the canonical requisition through %s", (field, reference) => {
  const canonicalReq = { ...requisition, uniqueIdNumber: "SYN-UNIQUE" };
  const input = candidate({ requisitionId: "", reqNumber: "", selectedRequisitionId: "", formSnapshot: {}, ...reference });
  const result = build({ tracker: [input], requisitions: [canonicalReq] });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp && entry.requisitionId === "req-1")).toBe(true);
});

test("uses the canonical missing-requisition blocker instead of an operational action", () => {
  const result = build({ tracker: [candidate({ requisitionId: "", reqNumber: "" })] });
  expect(result.items.some((entry) => [ACTION_CENTER_CATEGORIES.followUp, ACTION_CENTER_CATEGORIES.managerFeedback, ACTION_CENTER_CATEGORIES.candidateReady].includes(entry.category))).toBe(false);
  expect(result.items.some((entry) => entry.issueCode === "missing-requisition-id" && entry.candidateId === "candidate-1")).toBe(true);
});

test("does not guess when more than one requisition has the requested stable ID", () => {
  const result = build({ requisitions: [requisition, { ...requisition }] });
  expect(result.items.some((entry) => [ACTION_CENTER_CATEGORIES.followUp, ACTION_CENTER_CATEGORIES.managerFeedback, ACTION_CENTER_CATEGORIES.candidateReady].includes(entry.category))).toBe(false);
});

test("keeps the same candidate independently identifiable across two active requisitions", () => {
  const secondReq = { ...requisition, id: "req-2", reqNumber: "SYN-1002" };
  const result = build({
    tracker: [candidate(), candidate({ requisitionId: "req-2", reqNumber: "SYN-1002" })],
    requisitions: [requisition, secondReq],
  });
  const followUps = result.items.filter((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp);
  expect(followUps).toHaveLength(2);
  expect(followUps.map((entry) => entry.id)).toEqual([
    "action-center-v1:Follow-up Due:candidate:candidate-1:requisition:req-1",
    "action-center-v1:Follow-up Due:candidate:candidate-1:requisition:req-2",
  ]);
});

test("keeps only the active scope when the same candidate is linked to active and closed requisitions", () => {
  const closedReq = { ...requisition, id: "req-closed", reqNumber: "SYN-CLOSED", status: "Closed" };
  const result = build({
    tracker: [candidate(), candidate({ requisitionId: "req-closed", reqNumber: "SYN-CLOSED" })],
    requisitions: [requisition, closedReq],
  });
  const followUps = result.items.filter((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp);
  expect(followUps).toHaveLength(1);
  expect(followUps[0].requisitionId).toBe("req-1");
});

test("keeps duplicate candidate-ID blockers attached to their exact requisitions", () => {
  const secondReq = { ...requisition, id: "req-2", reqNumber: "SYN-1002" };
  const missingNotes = candidate({ id: "duplicate-candidate", requisitionId: "req-1", candidateNotes: "", nextAction: "Follow up with candidate" });
  const missingAction = candidate({ id: "duplicate-candidate", requisitionId: "req-2", reqNumber: "SYN-1002", candidateNotes: "Present", nextAction: "" });
  const result = build({ tracker: [missingNotes, missingAction], requisitions: [requisition, secondReq] });
  const noteBlocker = result.items.find((entry) => entry.issueCode === "missing-candidate-notes" && entry.candidateId === "duplicate-candidate");
  const actionBlocker = result.items.find((entry) => entry.issueCode === "missing-next-action" && entry.candidateId === "duplicate-candidate");
  expect(noteBlocker).toMatchObject({ requisitionId: "req-1", destination: { requisitionId: "req-1" } });
  expect(actionBlocker).toMatchObject({ requisitionId: "req-2", destination: { requisitionId: "req-2" } });
});

test("never borrows a similarly named requisition for a blocker with no stable identity", () => {
  const noStableId = { status: "Active", reqNumber: "", uniqueIdNumber: "", positionTitle: "Registered Nurse", siteName: "Synthetic Facility", facilityId: "facility-1" };
  const similarlyNamed = { ...requisition, id: "req-similar", reqNumber: "SYN-SIMILAR", positionTitle: "Registered Nurse" };
  const result = build({ tracker: [], requisitions: [noStableId, similarlyNamed] });
  const blocker = result.items.find((entry) => entry.sourceType === "requisition" && entry.issueCode === "missing-requisition-id");
  expect(blocker).toMatchObject({ requisitionId: "", destination: { type: "unavailable", disabled: true } });
  expect(blocker.context.requisitionId).not.toBe("req-similar");
});

test("does not interpret a missing-requisition blocker label as another requisition's stable ID", () => {
  const noStableId = { status: "Active", reqNumber: "", uniqueIdNumber: "", positionTitle: "Registered Nurse", siteName: "Synthetic Facility", facilityId: "facility-1" };
  const collidingStableId = { ...requisition, id: "Registered Nurse", reqNumber: "SYN-COLLISION", positionTitle: "Licensed Practical Nurse" };
  const result = build({ tracker: [], requisitions: [noStableId, collidingStableId] });
  const blocker = result.items.find((entry) => entry.sourceType === "requisition" && entry.issueCode === "missing-requisition-id");
  expect(blocker).toMatchObject({ requisitionId: "", destination: { type: "unavailable", disabled: true } });
  expect(blocker.context.requisitionId).not.toBe("Registered Nurse");
});

test("encodes unusual stable identifiers without changing navigation targets", () => {
  const unusualReq = { ...requisition, id: "req:alpha/one" };
  const result = build({ tracker: [candidate({ id: "candidate:alpha/one", requisitionId: unusualReq.id })], requisitions: [unusualReq] });
  const item = result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp);
  expect(item.id).toContain("candidate%3Aalpha%2Fone:requisition:req%3Aalpha%2Fone");
  expect(item.destination.id).toBe("candidate:alpha/one");
});

test("resolves approved facility aliases to the canonical facility and synchronized region", () => {
  const canonical = { ...facility, aliases: ["Synthetic Alias"] };
  const req = { ...requisition, siteName: "Synthetic Alias" };
  const result = build({ tracker: [candidate({ site: "Synthetic Alias" })], requisitions: [req], sites: [canonical] });
  const item = result.items.find((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp);
  expect(item.context).toMatchObject({ facility: "Synthetic Facility", facilityId: "facility-1", region: "Synthetic Region" });
});

test("does not guess an ambiguous alias and exposes a canonical blocker", () => {
  const sites = [
    { ...facility, id: "facility-east", siteName: "East Facility", aliases: ["Shared Alias"] },
    { ...facility, id: "facility-west", siteName: "West Facility", aliases: ["Shared Alias"] },
  ];
  const req = { ...requisition, facilityId: "", siteName: "Shared Alias" };
  const result = build({ tracker: [candidate({ facilityId: "", site: "Shared Alias" })], requisitions: [req], sites });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp)).toBe(false);
  expect(result.items.some((entry) => entry.issueCode === "facility-ambiguous")).toBe(true);
});

test("does not create operational work for an unknown facility", () => {
  const req = { ...requisition, facilityId: "", siteName: "Unknown Facility" };
  const result = build({ tracker: [candidate({ facilityId: "", site: "Unknown Facility" })], requisitions: [req] });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp)).toBe(false);
  expect(result.items.some((entry) => entry.issueCode === "facility-unmapped")).toBe(true);
});

test("blocks operational work when candidate and requisition facilities disagree", () => {
  const otherFacility = { ...facility, id: "facility-2", siteName: "Other Facility", regionName: "Other Region" };
  const result = build({ tracker: [candidate({ facilityId: "facility-2", site: "Other Facility" })], sites: [facility, otherFacility] });
  expect(result.items.some((entry) => entry.category === ACTION_CENTER_CATEGORIES.followUp)).toBe(false);
  expect(result.items.some((entry) => entry.title === "Candidate and requisition facility context disagree")).toBe(true);
});

test("deduplicates stable action identities and reports filter counts consistently", () => {
  const duplicate = candidate();
  const result = build({ tracker: [duplicate, { ...duplicate }] });
  const followUps = filterRecruiterActionCenter(result.items, ACTION_CENTER_CATEGORIES.followUp);
  expect(followUps).toHaveLength(1);
  expect(result.counts[ACTION_CENTER_CATEGORIES.followUp]).toBe(1);
  expect(result.counts[ACTION_CENTER_CATEGORIES.all]).toBe(result.items.length);
});

test("treats date-only due values as local dates and remains deterministic for a fixed clock", () => {
  const input = candidate({ nextActionDueDate: "2026-08-08", lastActionAt: "2026-08-05T16:00:00.000Z" });
  const morning = build({ tracker: [input], now: new Date("2026-08-08T13:00:00.000Z") });
  const repeated = build({ tracker: [input], now: new Date("2026-08-08T13:00:00.000Z") });
  expect(morning.items.map((item) => item.id)).toEqual(repeated.items.map((item) => item.id));
  expect(morning.items.some((item) => item.category === ACTION_CENTER_CATEGORIES.followUp)).toBe(true);
});

test("does not mutate candidates, requisitions, facilities, calendar events, or history", () => {
  const inputs = {
    tracker: [candidate()],
    requisitions: [requisition],
    sites: [facility],
    calendarEvents: [{ id: "event-1", eventType: "Facility Interview", startDateTime: "2026-08-07T15:00:00.000Z", endDateTime: "2026-08-07T16:00:00.000Z", outcomeStatus: "Pending", candidateId: "candidate-1" }],
    history: [{ id: "history-1", type: "Synthetic event" }],
    now: NOW,
  };
  const snapshot = JSON.parse(JSON.stringify(inputs, (key, value) => value instanceof Date ? value.toISOString() : value));
  buildRecruiterActionCenter(inputs);
  expect({ ...inputs, now: inputs.now.toISOString() }).toEqual({ ...snapshot, now: NOW.toISOString() });
});

test("rejects an invalid calculation clock instead of deriving unstable priorities", () => {
  expect(() => build({ now: "not-a-date" })).toThrow("A valid Action Center calculation time is required.");
});
