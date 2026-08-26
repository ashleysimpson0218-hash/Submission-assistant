import { recordActionCenterCommunicationAudit } from "./actionCenterCommunicationAuditClient";

const review = {
  approvalId: "123e4567-e89b-42d3-a456-426614174000",
  id: "controlled-communication-v1:copy-body:action-1:document-1",
  actionType: "copy-body",
  actionId: "action-1",
  category: "Follow-up Due",
  documentKey: "document-1",
  context: { candidateId: "candidate-1", requisitionId: "req-1", facilityId: "facility-1" },
  expectedFingerprint: "controlled-communication-v1-1234abcd",
  subject: "Sensitive subject is not sent",
  body: "Sensitive message is not sent",
  to: ["candidate@example.test"],
};

function client(session = { access_token: "access-token" }, error = null) {
  return { auth: { getSession: jest.fn(() => Promise.resolve({ data: { session }, error })) } };
}

test("records the minimum approved context with bearer and workspace authorization", async () => {
  const fetchImpl = jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true, status: "begun", actionRunId: review.approvalId }),
  }));
  const result = await recordActionCenterCommunicationAudit({
    client: client(), workspaceId: "workspace-1", phase: "begin", review, fetchImpl,
  });
  expect(result).toMatchObject({ ok: true, status: "begun" });
  const request = fetchImpl.mock.calls[0][1];
  expect(request.headers).toMatchObject({ Authorization: "Bearer access-token", "X-WelcomeFlow-Workspace-Id": "workspace-1" });
  const payload = JSON.parse(request.body);
  expect(payload.review).toMatchObject({ approvalId: review.approvalId, actionType: "copy-body", context: review.context });
  expect(payload.review).not.toHaveProperty("subject");
  expect(payload.review).not.toHaveProperty("body");
  expect(payload.review).not.toHaveProperty("to");
});

test("fails closed before fetch when authentication or workspace context is unavailable", async () => {
  const fetchImpl = jest.fn();
  await expect(recordActionCenterCommunicationAudit({ client: client(null), workspaceId: "workspace-1", phase: "begin", review, fetchImpl }))
    .resolves.toMatchObject({ ok: false, code: "COMMUNICATION_AUDIT_AUTH_REQUIRED" });
  await expect(recordActionCenterCommunicationAudit({ client: client(), workspaceId: "bad workspace", phase: "begin", review, fetchImpl }))
    .resolves.toMatchObject({ ok: false, code: "COMMUNICATION_AUDIT_WORKSPACE_INVALID" });
  expect(fetchImpl).not.toHaveBeenCalled();
});

test("records terminal results and surfaces conflicts without retrying a browser effect", async () => {
  const fetchImpl = jest.fn(() => Promise.resolve({
    ok: false,
    status: 409,
    json: () => Promise.resolve({ error: "This communication result conflicts with the approved action." }),
  }));
  const result = await recordActionCenterCommunicationAudit({
    client: client(),
    workspaceId: "workspace-1",
    phase: "complete",
    actionRunId: review.approvalId,
    resultStatus: "succeeded",
    resultCode: "APPROVED_BODY_COPIED",
    fetchImpl,
  });
  expect(result).toMatchObject({ ok: false, code: "COMMUNICATION_AUDIT_CONFLICT" });
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
    phase: "complete",
    actionRunId: review.approvalId,
    resultStatus: "succeeded",
    resultCode: "APPROVED_BODY_COPIED",
  });
});
