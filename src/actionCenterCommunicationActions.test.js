import { ACTION_CENTER_CATEGORIES, buildActionCenterItemId } from "./actionCenterSelectors";
import { buildActionCenterCommunicationPreview } from "./actionCenterCommunicationPreviews";
import {
  ACTION_CENTER_COMMUNICATION_ACTIONS,
  buildActionCenterMailtoUrl,
  prepareActionCenterCommunicationAction,
  revalidateActionCenterCommunicationAction,
} from "./actionCenterCommunicationActions";

const candidate = {
  id: "candidate-controlled",
  candidate: "Synthetic Controlled Candidate",
  candidateEmail: "candidate@example.test",
  candidateType: "External",
  candidateTypeConfirmed: true,
  requisitionId: "req-controlled",
  facilityId: "facility-controlled",
  site: "Synthetic Controlled Facility",
  position: "Registered Nurse",
  status: "Submitted",
  nextAction: "Follow up with candidate",
};

const requisition = {
  id: "req-controlled",
  reqNumber: "SYN-CONTROLLED",
  positionTitle: "Registered Nurse",
  facilityId: "facility-controlled",
  siteName: "Synthetic Controlled Facility",
  status: "Active",
};

const facility = {
  id: "facility-controlled",
  siteName: "Synthetic Controlled Facility",
  regionName: "Synthetic Region",
  status: "Active",
  hiringManagerEmail: "manager@example.test",
};

const settings = {
  general: { recruiterName: "Synthetic Recruiter" },
  templates: {
    candidate48HourFollowUp: {
      subject: "Checking in | {candidate_name}",
      body: "Hello {candidate_name}, following up about {position} at {facility}.",
    },
  },
};

function followUpItem(overrides = {}) {
  const item = {
    category: ACTION_CENTER_CATEGORIES.followUp,
    sourceType: "candidate",
    sourceId: candidate.id,
    candidateId: candidate.id,
    requisitionId: requisition.id,
    facilityId: facility.id,
    issueCode: "follow-up-overdue",
    explanation: "Synthetic follow-up is due.",
    context: {},
    ...overrides,
  };
  return { ...item, id: buildActionCenterItemId(item) };
}

function preview(context = {}) {
  return buildActionCenterCommunicationPreview({
    item: context.item || followUpItem(),
    tracker: context.tracker || [candidate],
    requisitions: context.requisitions || [requisition],
    sites: context.sites || [facility],
    settings: context.settings || settings,
    now: new Date("2026-08-25T15:00:00.000Z"),
  });
}

test("requires explicit runtime authorization and recruiter confirmation", () => {
  const communicationPreview = preview();
  expect(prepareActionCenterCommunicationAction({
    preview: communicationPreview,
    documentKey: "candidate-follow-up",
    actionType: ACTION_CENTER_COMMUNICATION_ACTIONS.copySubject,
  })).toMatchObject({ ok: false, code: "CONTROLLED_ACTION_NOT_AUTHORIZED" });

  const prepared = prepareActionCenterCommunicationAction({
    preview: communicationPreview,
    documentKey: "candidate-follow-up",
    actionType: ACTION_CENTER_COMMUNICATION_ACTIONS.copySubject,
    controlledActionsAuthorized: true,
  });
  expect(prepared).toMatchObject({
    ok: true,
    review: {
      requiresConfirmation: true,
      actionId: followUpItem().id,
      context: {
        candidateId: candidate.id,
        requisitionId: requisition.id,
        facilityId: facility.id,
      },
    },
  });
});

test("revalidates the exact approved context before returning clipboard content", () => {
  const item = followUpItem();
  const communicationPreview = preview({ item });
  const prepared = prepareActionCenterCommunicationAction({
    preview: communicationPreview,
    documentKey: "candidate-follow-up",
    actionType: ACTION_CENTER_COMMUNICATION_ACTIONS.copyBody,
    controlledActionsAuthorized: true,
  });
  const source = JSON.parse(JSON.stringify({ candidate, requisition, facility, settings }));
  const result = revalidateActionCenterCommunicationAction({
    review: prepared.review,
    item,
    tracker: [candidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
    now: new Date("2026-08-25T15:00:00.000Z"),
    controlledActionsAuthorized: true,
  });
  expect(result).toMatchObject({
    ok: true,
    action: {
      type: ACTION_CENTER_COMMUNICATION_ACTIONS.copyBody,
      value: "Hello Synthetic Controlled Candidate, following up about Registered Nurse at Synthetic Controlled Facility.",
    },
  });
  expect({ candidate, requisition, facility, settings }).toEqual(source);
});

test.each([
  ["candidate", { tracker: [{ ...candidate, candidateEmail: "changed@example.test" }] }],
  ["requisition", { requisitions: [{ ...requisition, positionTitle: "Changed Role" }] }],
  ["facility", { sites: [{ ...facility, siteName: "Changed Facility" }] }],
  ["recipient", { tracker: [{ ...candidate, candidateEmail: "other@example.test" }] }],
  ["template", { settings: { ...settings, templates: { candidate48HourFollowUp: { ...settings.templates.candidate48HourFollowUp, body: "Changed approved body" } } } }],
])("fails closed when %s context changes before confirmation", (_, changed) => {
  const item = followUpItem();
  const prepared = prepareActionCenterCommunicationAction({
    preview: preview({ item }),
    documentKey: "candidate-follow-up",
    actionType: ACTION_CENTER_COMMUNICATION_ACTIONS.copyBody,
    controlledActionsAuthorized: true,
  });
  const result = revalidateActionCenterCommunicationAction({
    review: prepared.review,
    item,
    tracker: changed.tracker || [candidate],
    requisitions: changed.requisitions || [requisition],
    sites: changed.sites || [facility],
    settings: changed.settings || settings,
    now: new Date("2026-08-25T15:00:00.000Z"),
    controlledActionsAuthorized: true,
  });
  expect(result.ok).toBe(false);
});

test("gates prefilled drafts separately and builds an exact unsent mailto URL", () => {
  const communicationPreview = preview();
  const blocked = prepareActionCenterCommunicationAction({
    preview: communicationPreview,
    documentKey: "candidate-follow-up",
    actionType: ACTION_CENTER_COMMUNICATION_ACTIONS.openEmailDraft,
    controlledActionsAuthorized: true,
  });
  expect(blocked).toMatchObject({ ok: false, code: "EMAIL_DRAFT_NOT_AUTHORIZED" });

  const prepared = prepareActionCenterCommunicationAction({
    preview: communicationPreview,
    documentKey: "candidate-follow-up",
    actionType: ACTION_CENTER_COMMUNICATION_ACTIONS.openEmailDraft,
    controlledActionsAuthorized: true,
    prefilledEmailDraftAuthorized: true,
  });
  const result = revalidateActionCenterCommunicationAction({
    review: prepared.review,
    item: followUpItem(),
    tracker: [candidate],
    requisitions: [requisition],
    sites: [facility],
    settings,
    now: new Date("2026-08-25T15:00:00.000Z"),
    controlledActionsAuthorized: true,
    prefilledEmailDraftAuthorized: true,
  });
  expect(result.ok).toBe(true);
  expect(result.action.mailtoUrl).toContain("mailto:candidate%40example.test?");
  expect(decodeURIComponent(result.action.mailtoUrl)).toContain("subject=Checking+in+|+Synthetic+Controlled+Candidate");
  expect(decodeURIComponent(result.action.mailtoUrl)).toContain("body=Hello+Synthetic+Controlled+Candidate");
  expect(result.action).not.toHaveProperty("sent");
});

test("does not allow non-email saved artifacts to become controlled actions", () => {
  const blockedPreview = {
    ...preview(),
    documents: [{ key: "ats-update", channel: "ATS note", to: [], cc: [], subject: "ATS", body: "Manual note" }],
  };
  expect(prepareActionCenterCommunicationAction({
    preview: blockedPreview,
    documentKey: "ats-update",
    actionType: ACTION_CENTER_COMMUNICATION_ACTIONS.copyBody,
    controlledActionsAuthorized: true,
  })).toMatchObject({ ok: false, code: "COMMUNICATION_DOCUMENT_UNSUPPORTED" });
});

test("returns an empty mailto URL for incomplete documents", () => {
  expect(buildActionCenterMailtoUrl({ channel: "Email", to: [], subject: "Subject", body: "Body" })).toBe("");
});
