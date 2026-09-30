const mockSecurity = {
  authenticatedUser: jest.fn(),
  consumePreAuthenticationRateLimit: jest.fn(),
  consumeSharedRateLimits: jest.fn(),
  requestPayloadBytes: () => 0,
  readServerRuntimeConfig: jest.fn(),
  serviceSupabaseClient: () => ({}),
};
const mockStore = { snapshot: jest.fn(), execute: jest.fn(), view: jest.fn() };
jest.mock("../server/welcomeflowApiSecurity", () => mockSecurity);
jest.mock("../server/workflow/store", () => mockStore);
const mockWorker = jest.fn();
jest.mock("../api/workflow-worker", () => mockWorker);
const handler = require("../api/workflow");
const { signCapability } = require("../server/workflow/capabilities");
const originalEnv = { ...process.env };
function res() {
  return {
    statusCode: 0,
    setHeader: jest.fn(),
    end(value) {
      this.body = JSON.parse(value);
    },
  };
}
function req(body, token) {
  return {
    method: body ? "POST" : "GET",
    headers: {
      "x-welcomeflow-workspace-id": "test",
      ...(token
        ? { "x-welcomeflow-candidate-token": token }
        : { authorization: "Bearer token" }),
    },
    body,
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  mockWorker.mockResolvedValue(undefined);
  process.env.WELCOMEFLOW_MAINTENANCE_MODE = "false";
  process.env.WELCOMEFLOW_API_WORKSPACE_IDS = "test";
  process.env.WELCOMEFLOW_CANDIDATE_LINK_SECRET = "x".repeat(40);
  mockSecurity.readServerRuntimeConfig.mockReturnValue({ ok: true });
  mockSecurity.consumePreAuthenticationRateLimit.mockResolvedValue({
    ok: true,
  });
  mockSecurity.consumeSharedRateLimits.mockResolvedValue({ ok: true });
  mockSecurity.authenticatedUser.mockResolvedValue({
    user: { id: "u", user_metadata: { role: "admin" } },
  });
  mockStore.snapshot.mockResolvedValue({ members: [], state: {} });
});
afterAll(() => {
  process.env = originalEnv;
});
test("self-declared role cannot replace a current server-side membership", async () => {
  const output = res();
  await handler(req(), output);
  expect(output.statusCode).toBe(403);
  expect(mockStore.view).not.toHaveBeenCalled();
});
test("authenticated users cannot impersonate the worker", async () => {
  mockStore.snapshot.mockResolvedValue({
    members: [{ userId: "u", active: true, role: "admin" }],
  });
  const output = res();
  await handler(
    req({ id: "one", type: "claim_delivery", payload: { jobIds: ["a"] } }),
    output,
  );
  expect(output.statusCode).toBe(403);
  expect(mockStore.execute).not.toHaveBeenCalled();
});
test("candidate capability is bound to workspace, purpose, and candidate", async () => {
  const token = signCapability(
    {
      workspaceId: "test",
      caseId: "case",
      stageIndex: 0,
      purpose: "booking",
      linkVersion: 1,
      expiresAt: Date.now() + 100000,
    },
    process.env.WELCOMEFLOW_CANDIDATE_LINK_SECRET,
  );
  const output = res();
  await handler(
    req(
      {
        id: "one",
        type: "decision",
        payload: { caseId: "case", decision: "proceed" },
      },
      token,
    ),
    output,
  );
  expect(output.statusCode).toBe(403);
  expect(mockStore.execute).not.toHaveBeenCalled();
});
test("candidate view never includes manager feedback or other candidates", () => {
  const snap = {
    state: {
      requisitions: [{ id: "req", active: true, title: "Driver" }],
      cases: [
        {
          id: "case",
          requisitionId: "req",
          linkVersion: 1,
          status: "selection_pending",
          stageIndex: 0,
          version: 2,
          privateNotes: "never return",
          stages: [
            {
              name: "Interview",
              slots: [{ id: "slot" }],
              feedback: [{ text: "private" }],
            },
          ],
        },
      ],
    },
  };
  const result = handler.candidateView(snap, {
    caseId: "case",
    stageIndex: 0,
    purpose: "booking",
    linkVersion: 1,
  });
  expect(result.slots).toEqual([{ id: "slot" }]);
  expect(JSON.stringify(result)).not.toMatch(/private|feedback/);
  expect(() =>
    handler.candidateView(snap, {
      caseId: "case",
      stageIndex: 0,
      purpose: "booking",
      linkVersion: 0,
    }),
  ).toThrow(/no longer active/);
});
test("disabled environment refuses access before authentication or state reads", async () => {
  mockSecurity.readServerRuntimeConfig.mockReturnValue({
    ok: false,
    error: "Disabled",
  });
  const output = res();
  await handler(req(), output);
  expect(output.statusCode).toBe(503);
  expect(mockStore.snapshot).not.toHaveBeenCalled();
});

test("successful candidate booking attempts its durable confirmation before returning, without exposing worker credentials", async () => {
  const identity = {
    userId: "candidate:case",
    active: true,
    role: "candidate",
    workspaceId: "test",
    caseId: "case",
    stageIndex: 0,
    purpose: "booking",
    linkVersion: 1,
    expiresAt: Date.now() + 100000,
  };
  const token = signCapability(
    identity,
    process.env.WELCOMEFLOW_CANDIDATE_LINK_SECRET,
  );
  mockStore.execute.mockResolvedValue({
    actor: identity,
    snapshot: { members: [], state: {} },
    duplicate: false,
  });
  const output = res();
  await handler(
    req(
      {
        id: "booking-command",
        type: "book",
        payload: { caseId: "case", expectedVersion: 1, slotId: "slot" },
      },
      token,
    ),
    output,
  );
  expect(output.statusCode).toBe(200);
  expect(output.body.completed).toBe(true);
  expect(mockWorker).toHaveBeenCalledTimes(1);
  expect(mockWorker.mock.calls[0][0].body).toEqual({
    workspaceId: "test",
    confirmationCaseId: "case",
  });
  expect(mockStore.execute.mock.invocationCallOrder[0]).toBeLessThan(
    mockWorker.mock.invocationCallOrder[0],
  );
  expect(JSON.stringify(output.body)).not.toMatch(/Bearer|secret/);
});
