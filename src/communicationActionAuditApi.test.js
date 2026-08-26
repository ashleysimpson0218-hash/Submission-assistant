const VALID_REVIEW = {
  approvalId: "123e4567-e89b-42d3-a456-426614174000",
  id: "controlled-communication-v1:copy-body:action-center-1:candidate-follow-up",
  actionType: "copy-body",
  actionId: "action-center-1",
  category: "Follow-up Due",
  documentKey: "candidate-follow-up",
  context: { candidateId: "candidate-1", requisitionId: "req-1", facilityId: "facility-1" },
  expectedFingerprint: "controlled-communication-v1-1234abcd",
};

function responseRecorder() {
  return { statusCode: 0, headers: {}, body: "", setHeader(name, value) { this.headers[name] = value; }, end(value = "") { this.body = value; } };
}

function security(overrides = {}) {
  const rpc = jest.fn();
  return {
    rpc,
    module: {
      authorizedRecruiter: jest.fn(() => Promise.resolve({ user: { id: "123e4567-e89b-42d3-a456-426614174111" }, role: "recruiter", workspaceId: "workspace-1" })),
      consumePreAuthenticationRateLimit: jest.fn(() => Promise.resolve({ ok: true })),
      consumeSharedRateLimits: jest.fn(() => Promise.resolve({ ok: true })),
      positiveInteger: (value, fallback) => Number(value) || fallback,
      requestPayloadBytes: jest.fn(() => 100),
      readServerRuntimeConfig: jest.fn(() => ({ ok: true, environment: "test" })),
      serviceSupabaseClient: jest.fn(() => ({ rpc })),
      ...overrides,
    },
  };
}

async function loadHandler(securityModule) {
  jest.resetModules();
  jest.doMock("../server/welcomeflowApiSecurity", () => securityModule);
  return require("../api/record-communication-action");
}

afterEach(() => jest.restoreAllMocks());

test("fails closed on disabled runtime before authentication or database access", async () => {
  const setup = security({ readServerRuntimeConfig: jest.fn(() => ({ ok: false, error: "This server action is disabled." })) });
  const handler = await loadHandler(setup.module);
  const response = responseRecorder();
  await handler({ method: "POST", headers: {}, body: { phase: "begin", review: VALID_REVIEW } }, response);
  expect(response.statusCode).toBe(503);
  expect(setup.module.authorizedRecruiter).not.toHaveBeenCalled();
  expect(setup.rpc).not.toHaveBeenCalled();
});

test("maintenance mode blocks audit writes before runtime or database initialization", async () => {
  const original = process.env.WELCOMEFLOW_MAINTENANCE_MODE;
  try {
    process.env.WELCOMEFLOW_MAINTENANCE_MODE = "true";
    const setup = security();
    const handler = await loadHandler(setup.module);
    const response = responseRecorder();
    await handler({ method: "POST", headers: {}, body: { phase: "begin", review: VALID_REVIEW } }, response);
    expect(response.statusCode).toBe(503);
    expect(setup.module.readServerRuntimeConfig).not.toHaveBeenCalled();
    expect(setup.rpc).not.toHaveBeenCalled();
  } finally {
    if (original === undefined) delete process.env.WELCOMEFLOW_MAINTENANCE_MODE;
    else process.env.WELCOMEFLOW_MAINTENANCE_MODE = original;
  }
});

test("atomically begins an approved action without storing communication content", async () => {
  const setup = security();
  setup.rpc.mockResolvedValue({ data: "begun", error: null });
  const handler = await loadHandler(setup.module);
  const response = responseRecorder();
  await handler({ method: "POST", headers: {}, body: { phase: "begin", review: { ...VALID_REVIEW, subject: "secret", body: "secret" } } }, response);
  expect(response.statusCode).toBe(200);
  expect(JSON.parse(response.body)).toMatchObject({ ok: true, status: "begun", actionRunId: VALID_REVIEW.approvalId });
  const parameters = setup.rpc.mock.calls[0][1];
  expect(setup.rpc.mock.calls[0][0]).toBe("welcomeflow_begin_communication_action");
  expect(parameters).toMatchObject({ p_action_run_id: VALID_REVIEW.approvalId, p_candidate_id: "candidate-1", p_requisition_id: "req-1", p_facility_id: "facility-1" });
  expect(JSON.stringify(parameters)).not.toContain("secret");
  expect(parameters.p_idempotency_key).toMatch(/^[a-f0-9]{64}$/);
  expect(parameters.p_context_fingerprint).toMatch(/^[a-f0-9]{64}$/);
});

test("returns duplicate approval without creating a second browser action authorization", async () => {
  const setup = security();
  setup.rpc.mockResolvedValue({ data: "duplicate_succeeded", error: null });
  const handler = await loadHandler(setup.module);
  const response = responseRecorder();
  await handler({ method: "POST", headers: {}, body: { phase: "begin", review: VALID_REVIEW } }, response);
  expect(JSON.parse(response.body)).toMatchObject({ ok: true, duplicate: true, status: "duplicate_succeeded" });
});

test("rejects malformed exact context before calling the audit RPC", async () => {
  const setup = security();
  const handler = await loadHandler(setup.module);
  const response = responseRecorder();
  await handler({ method: "POST", headers: {}, body: { phase: "begin", review: { ...VALID_REVIEW, id: "tampered" } } }, response);
  expect(response.statusCode).toBe(400);
  expect(setup.rpc).not.toHaveBeenCalled();
});

test("records only an approved terminal status and stable result code", async () => {
  const setup = security();
  setup.rpc.mockResolvedValue({ data: "completed", error: null });
  const handler = await loadHandler(setup.module);
  const response = responseRecorder();
  await handler({ method: "POST", headers: {}, body: { phase: "complete", actionRunId: VALID_REVIEW.approvalId, resultStatus: "succeeded", resultCode: "APPROVED_BODY_COPIED" } }, response);
  expect(response.statusCode).toBe(200);
  expect(setup.rpc).toHaveBeenCalledWith("welcomeflow_complete_communication_action", expect.objectContaining({
    p_action_run_id: VALID_REVIEW.approvalId,
    p_result_status: "succeeded",
    p_result_code: "APPROVED_BODY_COPIED",
  }));
});
