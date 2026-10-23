const USER_ID = "123e4567-e89b-42d3-a456-426614174111";
const WORKSPACE_ID = "company-a";
const ACTIVE_MEMBER = { workspace_id: WORKSPACE_ID, user_id: USER_ID, role: "recruiter", active: true };
const VERIFIED_USER = {
  id: USER_ID,
  app_metadata: { welcomeflow_role: "recruiter", welcomeflow_workspace_ids: [WORKSPACE_ID] },
};

function configureClients({ user = VERIFIED_USER, membership = ACTIVE_MEMBER, error = null } = {}) {
  const getUser = jest.fn().mockResolvedValue({ data: { user }, error: null });
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: membership, error }),
  };
  const from = jest.fn(() => query);
  const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
  jest.doMock("@supabase/supabase-js", () => ({
    createClient: jest.fn((_url, key) => key === "synthetic-service-key"
      ? { from, rpc }
      : { auth: { getUser } }),
  }));
  return { getUser, query, from, rpc };
}

function request(workspaceId = WORKSPACE_ID) {
  return {
    method: "POST",
    headers: { authorization: "Bearer still-valid-synthetic-token", "x-welcomeflow-workspace-id": workspaceId },
    socket: { remoteAddress: "203.0.113.42" },
    body: {},
  };
}

function responseRecorder() {
  return {
    statusCode: 0,
    body: "",
    setHeader() {},
    end(value = "") { this.body = value; },
  };
}

describe("legacy recruiter actions use current authoritative workspace membership", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      WELCOMEFLOW_SERVER_ENV: "test",
      WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
      SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_ANON_KEY: "synthetic-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
      WELCOMEFLOW_AUTHORIZED_RECRUITER_ROLES: "recruiter,admin",
      WELCOMEFLOW_API_WORKSPACE_IDS: "company-a,company-b",
      WELCOMEFLOW_MAINTENANCE_MODE: "false",
      WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED: "false",
      WELCOMEFLOW_ENABLE_EMAIL_ACTIONS: "true",
      WELCOMEFLOW_ENABLE_RESUME_ACTIONS: "true",
      WELCOMEFLOW_ENABLE_COMMUNICATION_AUDIT_ACTIONS: "true",
    };
    global.fetch = jest.fn(() => { throw new Error("No external requests are permitted in this regression test."); });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("allows an active configured recruiter using membership rather than metadata", async () => {
    const mocks = configureClients({ user: { id: USER_ID, app_metadata: {} } });
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");

    await expect(authorizedRecruiter(request())).resolves.toMatchObject({ user: { id: USER_ID }, role: "recruiter", workspaceId: WORKSPACE_ID });

    expect(mocks.getUser).toHaveBeenCalledWith("still-valid-synthetic-token");
    expect(mocks.from).toHaveBeenCalledWith("welcomeflow_workflow_members");
    expect(mocks.query.eq.mock.calls).toEqual([["workspace_id", WORKSPACE_ID], ["user_id", USER_ID]]);
  });

  test.each([
    ["removed", null],
    ["inactive", { ...ACTIVE_MEMBER, active: false }],
    ["demoted", { ...ACTIVE_MEMBER, role: "manager" }],
  ])("rejects the next request by a %s member even when the valid token retains recruiter metadata", async (_label, nextMembership) => {
    const mocks = configureClients();
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request())).resolves.toMatchObject({ role: "recruiter" });

    mocks.query.maybeSingle.mockResolvedValue({ data: nextMembership, error: null });
    const result = await authorizedRecruiter(request());

    expect(result).toMatchObject({ forbidden: true });
    expect(result.user).toBeUndefined();
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
  });

  test("does not allow admin metadata to override the current membership role", async () => {
    configureClients({ user: { id: USER_ID, app_metadata: { welcomeflow_role: "admin", welcomeflow_workspace_ids: [WORKSPACE_ID] } } });
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request())).resolves.toMatchObject({ role: "recruiter" });
  });

  test("retains the configured role restriction even for an active admin", async () => {
    process.env.WELCOMEFLOW_AUTHORIZED_RECRUITER_ROLES = "recruiter";
    configureClients({ membership: { ...ACTIVE_MEMBER, role: "admin" } });
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request())).resolves.toMatchObject({ forbidden: true });
  });

  test("rejects access to a different company without its own matching membership", async () => {
    const mocks = configureClients();
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    const result = await authorizedRecruiter(request("company-b"));
    expect(result).toMatchObject({ forbidden: true });
    expect(mocks.query.eq).toHaveBeenCalledWith("workspace_id", "company-b");
    expect(result.user).toBeUndefined();
  });

  test("rejects an unexpected membership for a different user", async () => {
    configureClients({ membership: { ...ACTIVE_MEMBER, user_id: "123e4567-e89b-42d3-a456-426614174222" } });
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request())).resolves.toMatchObject({ forbidden: true });
  });

  test("does not treat differently cased workspace IDs as the same membership", async () => {
    const mocks = configureClients();
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request("Company-A"))).resolves.toMatchObject({ forbidden: true });
    expect(mocks.query.eq).toHaveBeenCalledWith("workspace_id", "Company-A");
  });

  test("rejects a workspace disabled by server configuration before the membership lookup", async () => {
    process.env.WELCOMEFLOW_API_WORKSPACE_IDS = "company-b";
    const mocks = configureClients();
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request())).resolves.toMatchObject({ forbidden: true });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  test.each([
    ["database failure", { data: null, error: { message: "private-database-detail" } }],
    ["ambiguous rows", { data: null, error: { code: "PGRST116", message: "Multiple rows" } }],
    ["malformed duplicate result", { data: [ACTIVE_MEMBER, ACTIVE_MEMBER], error: null }],
  ])("fails closed on %s without trusting metadata or exposing database details", async (_label, response) => {
    const mocks = configureClients();
    mocks.query.maybeSingle.mockResolvedValue(response);
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    const result = await authorizedRecruiter(request());
    expect(result).toMatchObject({ unavailable: true });
    expect(result.user).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/private-database-detail|PGRST116|Multiple rows/);
  });

  test("fails closed when the membership request throws", async () => {
    const mocks = configureClients();
    mocks.query.maybeSingle.mockRejectedValue(new Error("network-private-detail"));
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request())).resolves.toEqual({ error: "Recruiter authorization could not be verified.", unavailable: true });
  });

  test("does not consult membership when verified authentication fails", async () => {
    const mocks = configureClients({ user: null });
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    const result = await authorizedRecruiter(request());
    expect(result.user).toBeUndefined();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  test.each(["WELCOMEFLOW_AUTHORIZED_RECRUITER_ROLES", "WELCOMEFLOW_API_WORKSPACE_IDS"])("fails closed when %s is missing", async (name) => {
    delete process.env[name];
    const mocks = configureClients();
    const { authorizedRecruiter } = require("../server/welcomeflowApiSecurity");
    await expect(authorizedRecruiter(request())).resolves.toMatchObject({ unavailable: true });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  test.each(["send-email", "parse-resume", "record-communication-action"])("%s rejects a removed member before any downstream action", async (name) => {
    const mocks = configureClients({ membership: null });
    const handler = require(`../api/${name}`);
    const response = responseRecorder();
    await handler(request(), response);

    expect(response.statusCode).toBe(403);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc.mock.calls[0][1].p_action).toMatch(/-preauth$/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
