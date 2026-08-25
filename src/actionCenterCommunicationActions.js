import { buildActionCenterCommunicationPreview } from "./actionCenterCommunicationPreviews";

export const ACTION_CENTER_COMMUNICATION_ACTIONS = Object.freeze({
  copySubject: "copy-subject",
  copyBody: "copy-body",
  openEmailDraft: "open-email-draft",
});

const text = (value) => String(value ?? "").trim();

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value) {
  const source = stableSerialize(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `controlled-communication-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function failure(code, message) {
  return { ok: false, code, message };
}

function exactDocument(preview = {}, documentKey = "") {
  const matches = (Array.isArray(preview.documents) ? preview.documents : [])
    .filter((entry) => text(entry?.key) === text(documentKey));
  return matches.length === 1 ? matches[0] : null;
}

function actionValue(actionType, document) {
  if (actionType === ACTION_CENTER_COMMUNICATION_ACTIONS.copySubject) return text(document.subject);
  if (actionType === ACTION_CENTER_COMMUNICATION_ACTIONS.copyBody) return text(document.body);
  return "";
}

function emailDocument(document = {}) {
  return text(document.channel).toLowerCase() === "email"
    && Array.isArray(document.to)
    && document.to.length > 0
    && Boolean(text(document.subject))
    && Boolean(text(document.body));
}

function documentContract(preview = {}, document = {}) {
  return {
    actionId: text(preview.actionId),
    category: text(preview.category),
    snapshotHash: text(preview.snapshotHash),
    context: {
      candidateId: text(preview.context?.candidateId),
      requisitionId: text(preview.context?.requisitionId),
      facilityId: text(preview.context?.facilityId),
    },
    document: {
      key: text(document.key),
      channel: text(document.channel),
      to: Array.isArray(document.to) ? document.to.map(text) : [],
      cc: Array.isArray(document.cc) ? document.cc.map(text) : [],
      subject: text(document.subject),
      body: text(document.body),
      templateKey: text(document.templateKey),
      templateVariant: text(document.templateVariant),
    },
  };
}

export function buildActionCenterMailtoUrl(document = {}) {
  if (!emailDocument(document)) return "";
  const query = new URLSearchParams();
  query.set("subject", text(document.subject));
  query.set("body", text(document.body));
  if (Array.isArray(document.cc) && document.cc.length) query.set("cc", document.cc.map(text).join(","));
  const recipients = document.to.map((recipient) => encodeURIComponent(text(recipient))).join(",");
  return `mailto:${recipients}?${query.toString()}`;
}

export function prepareActionCenterCommunicationAction({
  preview = {},
  documentKey = "",
  actionType = "",
  controlledActionsAuthorized = false,
  prefilledEmailDraftAuthorized = false,
} = {}) {
  if (!controlledActionsAuthorized) return failure("CONTROLLED_ACTION_NOT_AUTHORIZED", "Controlled communication actions are not authorized in this runtime.");
  if (!preview.canReview || preview.blockers?.length) return failure("COMMUNICATION_PREVIEW_BLOCKED", "The communication preview is blocked and cannot be used for an action.");
  const document = exactDocument(preview, documentKey);
  if (!document) return failure("COMMUNICATION_DOCUMENT_NOT_FOUND", "The exact approved communication document is no longer available.");
  if (!emailDocument(document)) return failure("COMMUNICATION_DOCUMENT_UNSUPPORTED", "Only approved email documents support controlled actions in this checkpoint.");
  if (!Object.values(ACTION_CENTER_COMMUNICATION_ACTIONS).includes(actionType)) return failure("COMMUNICATION_ACTION_UNSUPPORTED", "The requested communication action is not supported.");
  if (actionType === ACTION_CENTER_COMMUNICATION_ACTIONS.openEmailDraft && !prefilledEmailDraftAuthorized) {
    return failure("EMAIL_DRAFT_NOT_AUTHORIZED", "Opening a prefilled email draft is not authorized in this runtime.");
  }
  const value = actionValue(actionType, document);
  if (actionType !== ACTION_CENTER_COMMUNICATION_ACTIONS.openEmailDraft && !value) {
    return failure("COMMUNICATION_VALUE_MISSING", "The approved communication value is no longer available.");
  }
  const contract = documentContract(preview, document);
  const review = {
    id: `controlled-communication-v1:${encodeURIComponent(actionType)}:${encodeURIComponent(text(preview.actionId))}:${encodeURIComponent(text(document.key))}`,
    actionType,
    actionId: text(preview.actionId),
    category: text(preview.category),
    documentKey: text(document.key),
    documentTitle: text(document.title),
    context: { ...preview.context },
    recipientLabel: text(document.recipientLabel),
    to: [...document.to],
    cc: [...document.cc],
    subject: text(document.subject),
    body: text(document.body),
    previewSnapshotHash: text(preview.snapshotHash),
    expectedFingerprint: fingerprint(contract),
    requiresConfirmation: true,
    effectDescription: actionType === ACTION_CENTER_COMMUNICATION_ACTIONS.copySubject
      ? "Copy the exact approved subject to the clipboard."
      : actionType === ACTION_CENTER_COMMUNICATION_ACTIONS.copyBody
        ? "Copy the exact approved email body to the clipboard."
        : "Open the exact approved email as a prefilled draft in the default mail application.",
  };
  return { ok: true, review };
}

export function revalidateActionCenterCommunicationAction({
  review = {},
  item = {},
  tracker = [],
  requisitions = [],
  sites = [],
  settings = {},
  now = new Date(),
  controlledActionsAuthorized = false,
  prefilledEmailDraftAuthorized = false,
} = {}) {
  if (!text(review.id) || !review.requiresConfirmation) return failure("COMMUNICATION_CONFIRMATION_INVALID", "The communication confirmation request is invalid.");
  if (text(review.actionId) !== text(item.id)) return failure("COMMUNICATION_CONTEXT_CHANGED", "The Action Center item changed before confirmation. Review it again.");
  const freshPreview = buildActionCenterCommunicationPreview({ item, tracker, requisitions, sites, settings, now });
  const prepared = prepareActionCenterCommunicationAction({
    preview: freshPreview,
    documentKey: review.documentKey,
    actionType: review.actionType,
    controlledActionsAuthorized,
    prefilledEmailDraftAuthorized,
  });
  if (!prepared.ok) return prepared;
  if (prepared.review.expectedFingerprint !== text(review.expectedFingerprint)) {
    return failure("COMMUNICATION_CONTEXT_CHANGED", "Candidate, requisition, facility, recipient, or approved content changed before confirmation. Review the communication again.");
  }
  const document = exactDocument(freshPreview, review.documentKey);
  if (review.actionType === ACTION_CENTER_COMMUNICATION_ACTIONS.openEmailDraft) {
    const mailtoUrl = buildActionCenterMailtoUrl(document);
    if (!mailtoUrl) return failure("EMAIL_DRAFT_UNAVAILABLE", "The exact prefilled email draft could not be prepared.");
    return { ok: true, action: { type: review.actionType, mailtoUrl }, preview: freshPreview };
  }
  const value = actionValue(review.actionType, document);
  if (!value) return failure("COMMUNICATION_VALUE_MISSING", "The exact approved communication value is no longer available.");
  return { ok: true, action: { type: review.actionType, value }, preview: freshPreview };
}
