const PRODUCTION_PROJECT_REF = "qfpgednixvveelgwfylv";
const OWNER_UAT_PROJECT_REF = "zleslkwnbjxknmkqywyv";
const TEST_PROJECT_REF = "abcdefghijklmnopqrst";

function baseEnvironment(patch = {}) {
  return {
    WELCOMEFLOW_SERVER_ENV: "test",
    WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF: TEST_PROJECT_REF,
    SUPABASE_URL: `https://${TEST_PROJECT_REF}.supabase.co`,
    SUPABASE_ANON_KEY: "publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret-key",
    WELCOMEFLOW_ENABLE_EMAIL_ACTIONS: "true",
    WELCOMEFLOW_ENABLE_RESUME_ACTIONS: "true",
    WELCOMEFLOW_ENABLE_BOOKING_ACTIONS: "true",
    WELCOMEFLOW_ENABLE_COMMUNICATION_AUDIT_ACTIONS: "true",
    ...patch,
  };
}

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { this.body = value; },
  };
}

describe("server runtime and project binding", () => {
  const originalEnvironment = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnvironment };
    global.fetch = originalFetch;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test.each([
    ["missing environment", { WELCOMEFLOW_SERVER_ENV: "" }],
    ["unsupported environment", { WELCOMEFLOW_SERVER_ENV: "staging-ish" }],
    ["missing allowed project", { WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF: "" }],
    ["malformed URL", { SUPABASE_URL: "https://example.invalid" }],
    ["wrong project", { WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF: "differentprojectref" }],
    ["missing service credentials", { SUPABASE_SERVICE_ROLE_KEY: "" }],
  ])("rejects %s", (_label, patch) => {
    const { readServerRuntimeConfig } = require("../server/welcomeflowApiSecurity");
    expect(readServerRuntimeConfig("email", baseEnvironment(patch))).toMatchObject({ ok: false });
  });

  test("rejects preview runtimes pointed at production", () => {
    const { readServerRuntimeConfig } = require("../server/welcomeflowApiSecurity");
    expect(readServerRuntimeConfig("email", baseEnvironment({
      WELCOMEFLOW_SERVER_ENV: "preview",
      WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    }))).toMatchObject({ ok: false });
  });

  test("Owner UAT requires its exact project and a positive action allow", () => {
    const { readServerRuntimeConfig } = require("../server/welcomeflowApiSecurity");
    const ownerEnvironment = baseEnvironment({
      WELCOMEFLOW_SERVER_ENV: "owner-uat",
      WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF: OWNER_UAT_PROJECT_REF,
      SUPABASE_URL: `https://${OWNER_UAT_PROJECT_REF}.supabase.co`,
      WELCOMEFLOW_ENABLE_EMAIL_ACTIONS: "false",
    });
    expect(readServerRuntimeConfig("email", ownerEnvironment)).toMatchObject({ ok: false, error: "This server action is disabled." });
    expect(readServerRuntimeConfig("email", { ...ownerEnvironment, WELCOMEFLOW_ENABLE_EMAIL_ACTIONS: "true" })).toMatchObject({ ok: true, environment: "owner-uat", projectRef: OWNER_UAT_PROJECT_REF });
  });

  test("production actions remain disabled unless explicitly allowed", () => {
    const { readServerRuntimeConfig } = require("../server/welcomeflowApiSecurity");
    const productionEnvironment = baseEnvironment({
      WELCOMEFLOW_SERVER_ENV: "production",
      WELCOMEFLOW_ALLOWED_SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
      SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    });
    delete productionEnvironment.WELCOMEFLOW_ENABLE_EMAIL_ACTIONS;
    expect(readServerRuntimeConfig("email", productionEnvironment)).toMatchObject({ ok: false });
    expect(readServerRuntimeConfig("email", { ...productionEnvironment, WELCOMEFLOW_ENABLE_EMAIL_ACTIONS: "false" })).toMatchObject({ ok: false });
    expect(readServerRuntimeConfig("email", { ...productionEnvironment, WELCOMEFLOW_ENABLE_EMAIL_ACTIONS: "true" })).toMatchObject({ ok: true });
  });

  test.each([
    ["email", "WELCOMEFLOW_ENABLE_EMAIL_ACTIONS"],
    ["resume", "WELCOMEFLOW_ENABLE_RESUME_ACTIONS"],
    ["booking", "WELCOMEFLOW_ENABLE_BOOKING_ACTIONS"],
    ["communicationAudit", "WELCOMEFLOW_ENABLE_COMMUNICATION_AUDIT_ACTIONS"],
  ])("requires the positive %s action flag", (action, flag) => {
    const { readServerRuntimeConfig } = require("../server/welcomeflowApiSecurity");
    const omitted = baseEnvironment();
    delete omitted[flag];
    expect(readServerRuntimeConfig(action, omitted)).toMatchObject({ ok: false, error: "This server action is disabled." });
    expect(readServerRuntimeConfig(action, baseEnvironment({ [flag]: "false" }))).toMatchObject({ ok: false });
    expect(readServerRuntimeConfig(action, baseEnvironment({ [flag]: "true" }))).toMatchObject({ ok: true, action });
  });

  test.each([
    ["send-email", "email", "WELCOMEFLOW_ENABLE_EMAIL_ACTIONS", { method: "POST", headers: {}, body: {} }],
    ["parse-resume", "resume", "WELCOMEFLOW_ENABLE_RESUME_ACTIONS", { method: "POST", headers: {}, body: {} }],
    ["book-screening", "booking", "WELCOMEFLOW_ENABLE_BOOKING_ACTIONS", { method: "GET", headers: {}, query: {} }],
    ["record-communication-action", "communicationAudit", "WELCOMEFLOW_ENABLE_COMMUNICATION_AUDIT_ACTIONS", { method: "POST", headers: {}, body: {} }],
  ])("%s rejects disabled configuration before Supabase or providers", async (moduleName, _action, flag, request) => {
    Object.assign(process.env, baseEnvironment({ [flag]: "false", WELCOMEFLOW_MAINTENANCE_MODE: "false", WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED: "false" }));
    const createClient = jest.fn(() => { throw new Error("Supabase must not initialize"); });
    jest.doMock("@supabase/supabase-js", () => ({ createClient }));
    global.fetch = jest.fn(() => { throw new Error("External provider must not be called"); });
    const handler = require(`../api/${moduleName}`);
    const response = responseRecorder();

    await handler(request, response);

    expect(response.statusCode).toBe(503);
    expect(createClient).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
