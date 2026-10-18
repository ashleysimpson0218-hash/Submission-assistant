const mockRunInternal = jest.fn();
jest.mock("../api/workflow-worker", () => ({ runInternal: mockRunInternal }));
const handler = require("../api/workflow-schedule");
const originalEnv = { ...process.env };

function response() {
  return {
    statusCode: 0,
    setHeader: jest.fn(),
    end(value) {
      this.body = JSON.parse(value);
    },
  };
}

async function call({ method = "POST", secret = "x".repeat(40) } = {}) {
  const res = response();
  await handler({ method, headers: { authorization: `Bearer ${secret}` } }, res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.WELCOMEFLOW_WORKFLOW_WORKER_SECRET = "x".repeat(40);
  process.env.WELCOMEFLOW_API_WORKSPACE_IDS = "workspace-one, workspace-two workspace-one";
  mockRunInternal.mockResolvedValue({ status: 200, ok: true, processed: 1 });
});

afterAll(() => {
  process.env = originalEnv;
});

test("rejects non-POST and unauthenticated scheduler requests", async () => {
  expect((await call({ method: "GET" })).statusCode).toBe(405);
  expect((await call({ secret: "wrong" })).statusCode).toBe(403);
  expect(mockRunInternal).not.toHaveBeenCalled();
});

test("runs each configured workspace once", async () => {
  const result = await call();
  expect(result.statusCode).toBe(200);
  expect(result.body).toEqual({
    ok: true,
    processed: 2,
    results: [
      { workspaceId: "workspace-one", ok: true, processed: 1, code: null },
      { workspaceId: "workspace-two", ok: true, processed: 1, code: null },
    ],
  });
  expect(mockRunInternal.mock.calls).toEqual([
    [{ workspaceId: "workspace-one" }],
    [{ workspaceId: "workspace-two" }],
  ]);
});

test("surfaces worker failures for scheduler monitoring", async () => {
  mockRunInternal
    .mockResolvedValueOnce({ status: 200, ok: true, processed: 1 })
    .mockResolvedValueOnce({ status: 503, ok: false, code: "WORKER_FAILED" });
  const result = await call();
  expect(result.statusCode).toBe(503);
  expect(result.body.ok).toBe(false);
  expect(result.body.results[1].code).toBe("WORKER_FAILED");
});

test("converts unexpected worker exceptions into a monitored failure", async () => {
  mockRunInternal.mockRejectedValueOnce(new Error("private provider detail"));
  const result = await call();
  expect(result.statusCode).toBe(503);
  expect(result.body.results[0]).toEqual({
    workspaceId: "workspace-one",
    ok: false,
    processed: 0,
    code: "WORKER_FAILED",
  });
  expect(JSON.stringify(result.body)).not.toContain("private provider detail");
});

test("fails closed when the workspace allowlist is empty", async () => {
  process.env.WELCOMEFLOW_API_WORKSPACE_IDS = "";
  const result = await call();
  expect(result.statusCode).toBe(503);
  expect(result.body.code).toBe("WORKSPACE_CONFIGURATION");
  expect(mockRunInternal).not.toHaveBeenCalled();
});
