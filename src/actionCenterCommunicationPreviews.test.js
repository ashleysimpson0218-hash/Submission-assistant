import { ACTION_CENTER_CATEGORIES } from "./actionCenterSelectors";
import {
  actionCenterItemSupportsCommunicationPreview,
  buildActionCenterCommunicationPreview,
} from "./actionCenterCommunicationPreviews";

const requisition = {
  id: "req-preview",
  reqNumber: "SYN-PREVIEW",
  positionTitle: "Registered Nurse",
  facilityId: "facility-preview",
  siteName: "Synthetic Preview Facility",
  status: "Active",
};

const facility = {
  id: "facility-preview",
  siteName: "Synthetic Preview Facility",
  regionName: "Synthetic Region",
  status: "Active",
  hiringManagerName: "Synthetic Manager",
  hiringManagerEmail: "manager@example.test",
};

const candidate = {
  id: "candidate-preview",
  candidate: "Synthetic Preview Candidate",
  candidateEmail: "candidate@example.test",
  candidateType: "External",
  candidateTypeConfirmed: true,
  requisitionId: "req-preview",
  facilityId: "facility-preview",
  site: "Synthetic Preview Facility",
  position: "Registered Nurse",
  status: "Interview Completed",
  actualInterviewAt: "2026-08-09T15:00:00.000Z",
};

const settings = {
  general: { recruiterName: "Synthetic Recruiter", recruiterEmail: "recruiter@example.test" },
  templates: {
    candidate48HourFollowUp: {
      subject: "Checking in | {position} | {facility}",
      body: "Hello {candidate_name},\n\nChecking in about {position} at {facility}.\n\nThank you,\n{recruiter_name}",
    },
    managerFeedbackRequest: {
      subject: "Feedback requested | {candidate_name}",
      body: "Please share feedback for {candidate_name} after the {interview_date} interview at {facility}.",
    },
  },
};

function item(category) {
  return {
    id: `action-center-v1:${category}:candidate:candidate-preview:requisition:req-preview`,
    category,
    sourceType: "candidate",
    sourceId: "candidate-preview",
    candidateId: "candidate-preview",
    requisitionId: "req-preview",
    facilityId: "facility-preview",
    explanation: "Synthetic explanation",
    context: {},
  };
}

test("builds a side-effect-free candidate follow-up preview from exact canonical context", () => {
  const source = JSON.parse(JSON.stringify({ candidate, requisition, facility, settings }));
  const preview = buildActionCenterCommunicationPreview({
    item: item(ACTION_CENTER_CATEGORIES.followUp),
    tracker: [candidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
  });

  expect(preview).toMatchObject({
    title: "Candidate Follow-Up Preview",
    canReview: true,
    readOnly: true,
    blockers: [],
    context: {
      candidateId: "candidate-preview",
      requisitionId: "req-preview",
      facilityId: "facility-preview",
      region: "Synthetic Region",
    },
  });
  expect(preview.documents).toEqual([expect.objectContaining({
    key: "candidate-follow-up",
    recipientLabel: "Candidate",
    to: ["candidate@example.test"],
    subject: "Checking in | Registered Nurse | Synthetic Preview Facility",
    body: expect.stringContaining("Hello Synthetic Preview Candidate"),
  })]);
  expect({ candidate, requisition, facility, settings }).toEqual(source);
});

test("builds a manager feedback preview with the exact facility recipients and interview context", () => {
  const preview = buildActionCenterCommunicationPreview({
    item: item(ACTION_CENTER_CATEGORIES.managerFeedback),
    tracker: [candidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
  });

  expect(preview).toMatchObject({ title: "Manager Feedback Preview", canReview: true, blockers: [] });
  expect(preview.documents[0]).toMatchObject({
    key: "manager-feedback",
    recipientLabel: "Facility hiring manager",
    to: ["manager@example.test"],
    subject: "Feedback requested | Synthetic Preview Candidate",
    body: expect.stringContaining("2026-08-09"),
  });
});

test("shows the exact saved Candidate Ready package without regenerating it", () => {
  const readyCandidate = {
    ...candidate,
    reviewedSubmissionPackage: {
      snapshotHash: "approved-snapshot-hash",
      recipients: { facility: { to: ["manager@example.test"], cc: [] }, candidate: { to: ["candidate@example.test"] } },
      rendered: {
        facilityEmail: { templateKey: "hiringManager", variantKey: "External", subject: "Exact saved facility subject", body: "Exact saved facility body" },
        candidateEmail: { templateKey: "candidateConfirmation", subject: "Exact saved candidate subject", body: "Exact saved candidate body" },
        candidateText: { templateKey: "candidateText", body: "Exact saved candidate text" },
        atsUpdate: { templateKey: "atsUpdate", subject: "Exact saved ATS subject", body: "Exact saved ATS body" },
      },
    },
  };
  const preview = buildActionCenterCommunicationPreview({
    item: item(ACTION_CENTER_CATEGORIES.candidateReady),
    tracker: [readyCandidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
  });

  expect(preview).toMatchObject({ title: "Candidate Ready Preview", snapshotHash: "approved-snapshot-hash", canReview: true, blockers: [] });
  expect(preview.documents.map((entry) => entry.key)).toEqual(["facility-submission", "candidate-confirmation", "candidate-text", "ats-update"]);
  expect(preview.documents[0].body).toBe("Exact saved facility body");
});

test("fails closed for stale, inactive, ambiguous, or incomplete communication context", () => {
  const base = { item: item(ACTION_CENTER_CATEGORIES.followUp), tracker: [candidate], requisitions: [requisition], sites: [facility], settings };
  expect(buildActionCenterCommunicationPreview({ ...base, requisitions: [{ ...requisition, status: "Closed" }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ACTIVE_REQUISITION_NOT_FOUND" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, tracker: [candidate, { ...candidate }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "CANDIDATE_CONTEXT_AMBIGUOUS" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, sites: [{ ...facility, id: "different-facility" }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "FACILITY_CONTEXT_UNRESOLVED" })]));
  expect(buildActionCenterCommunicationPreview({ ...base, tracker: [{ ...candidate, candidateEmail: "" }] }).blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PREVIEW_RECIPIENT_MISSING" })]));
});

test("supports only the three approved Action Center communication categories", () => {
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.followUp))).toBe(true);
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.managerFeedback))).toBe(true);
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.candidateReady))).toBe(true);
  expect(actionCenterItemSupportsCommunicationPreview(item(ACTION_CENTER_CATEGORIES.dataBlocker))).toBe(false);
});

test("produces deterministic preview identity in New York and UTC-compatible execution", () => {
  const input = { item: item(ACTION_CENTER_CATEGORIES.managerFeedback), tracker: [candidate], requisitions: [requisition], sites: [facility], settings };
  const first = buildActionCenterCommunicationPreview(input);
  const second = buildActionCenterCommunicationPreview(input);
  expect(second.id).toBe(first.id);
  expect(second.snapshotHash).toBe(first.snapshotHash);
  expect(second.documents).toEqual(first.documents);
});
