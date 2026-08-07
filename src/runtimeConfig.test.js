import { OWNER_UAT_SUPABASE_PROJECT_REF, PRODUCTION_SUPABASE_PROJECT_REF, SYNTHETIC_TEST_SUPABASE_PROJECT_REF, readRuntimeConfig, readWorkspaceRuntimeConfig, workspacePersistenceMode } from "./runtimeConfig";

const validTestEnv = {
  REACT_APP_ENVIRONMENT: "test",
  REACT_APP_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  REACT_APP_SUPABASE_ANON_KEY: "public-test-key",
  REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst",
};

test("accepts an explicitly allowed non-production test project", () => {
  expect(readRuntimeConfig(validTestEnv)).toMatchObject({ ok: true, isTest: true, projectRef: "abcdefghijklmnopqrst" });
});

test("refuses to initialize when required configuration is missing", () => {
  const result = readRuntimeConfig({ REACT_APP_ENVIRONMENT: "test" });
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/Missing required configuration/);
});

test("refuses a URL that does not match the allowed project ref", () => {
  const result = readRuntimeConfig({ ...validTestEnv, REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: "differentprojectref" });
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/does not match/);
});

test("refuses the production project in test mode", () => {
  const result = readRuntimeConfig({
    ...validTestEnv,
    REACT_APP_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
    REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: PRODUCTION_SUPABASE_PROJECT_REF,
  });
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/refuses to connect to the production/);
});

const validUatEnv = {
  REACT_APP_ENVIRONMENT: "uat",
  REACT_APP_SUPABASE_URL: `https://${OWNER_UAT_SUPABASE_PROJECT_REF}.supabase.co`,
  REACT_APP_SUPABASE_ANON_KEY: "owner-uat-publishable-key",
  REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: OWNER_UAT_SUPABASE_PROJECT_REF,
};

test("accepts only the approved authenticated Owner UAT project", () => {
  expect(readRuntimeConfig(validUatEnv)).toMatchObject({ ok: true, isUat: true, controlledWrites: true, projectRef: OWNER_UAT_SUPABASE_PROJECT_REF });
});

test.each([PRODUCTION_SUPABASE_PROJECT_REF, SYNTHETIC_TEST_SUPABASE_PROJECT_REF])("Owner UAT rejects prohibited project %s", (projectRef) => {
  const result = readRuntimeConfig({ ...validUatEnv, REACT_APP_SUPABASE_URL: `https://${projectRef}.supabase.co`, REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: projectRef });
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/refuses/);
});

test("Owner UAT rejects an unapproved third project", () => {
  const result = readRuntimeConfig({ ...validUatEnv, REACT_APP_SUPABASE_URL: "https://anotheruatproject12.supabase.co", REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: "anotheruatproject12" });
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/approved Owner UAT/);
});

test("Owner UAT rejects missing environment configuration", () => {
  expect(readRuntimeConfig({ REACT_APP_ENVIRONMENT: "uat" }).ok).toBe(false);
});

const acceptanceEnv = {
  ...validTestEnv,
  REACT_APP_WELCOMEFLOW_ACCEPTANCE_MODE: "true",
  REACT_APP_WELCOMEFLOW_WORKSPACE_ID: "phase1-acceptance-synthetic",
  REACT_APP_WELCOMEFLOW_AUTOSAVE: "false",
  REACT_APP_WELCOMEFLOW_EXPECTED_CANDIDATES: "100",
  REACT_APP_WELCOMEFLOW_EXPECTED_FACILITIES: "32",
  REACT_APP_WELCOMEFLOW_EXPECTED_REQUISITIONS: "114",
  REACT_APP_WELCOMEFLOW_EXPECTED_HISTORY: "200",
  REACT_APP_WELCOMEFLOW_EXPECTED_REPORT_HISTORY: "53",
  REACT_APP_WELCOMEFLOW_EXPECTED_WORKSPACE_FINGERPRINT: "abc123",
};

test("acceptance mode requires and preserves an explicit non-default workspace with autosave disabled", () => {
  expect(readRuntimeConfig(acceptanceEnv)).toMatchObject({
    ok: true,
    acceptanceMode: true,
    workspaceId: "phase1-acceptance-synthetic",
    autosaveEnabled: false,
    browserPersistenceEnabled: false,
    expectedCounts: { candidates: 100, facilities: 32, requisitions: 114, history: 200, reportHistory: 53 },
  });
});

test.each([
  ["omitted", { REACT_APP_WELCOMEFLOW_AUTOSAVE: undefined }],
  ["enabled", { REACT_APP_WELCOMEFLOW_AUTOSAVE: "true" }],
])("acceptance mode rejects autosave when it is %s", (_label, patch) => {
  const env = { ...acceptanceEnv, ...patch };
  if (patch.REACT_APP_WELCOMEFLOW_AUTOSAVE === undefined) delete env.REACT_APP_WELCOMEFLOW_AUTOSAVE;
  const result = readRuntimeConfig(env);
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/autosave=false/i);
});

test("acceptance mode cannot initialize cloud or browser persistence", () => {
  const runtime = readRuntimeConfig(acceptanceEnv);
  expect(runtime.ok).toBe(true);
  expect(workspacePersistenceMode(runtime)).toEqual({ cloudEnabled: false, browserEnabled: false });
});

test("normal non-acceptance mode retains cloud and browser persistence defaults", () => {
  const runtime = readRuntimeConfig(validTestEnv);
  expect(runtime.ok).toBe(true);
  expect(workspacePersistenceMode(runtime)).toEqual({ cloudEnabled: true, browserEnabled: true });
});

test.each([
  [{ ...acceptanceEnv, REACT_APP_WELCOMEFLOW_WORKSPACE_ID: "" }, /explicit/],
  [{ ...acceptanceEnv, REACT_APP_WELCOMEFLOW_WORKSPACE_ID: "default" }, /refuses/],
  [{ ...acceptanceEnv, REACT_APP_WELCOMEFLOW_EXPECTED_HISTORY: "" }, /requires expected/],
])("acceptance workspace configuration fails closed", (env, message) => {
  const result = readWorkspaceRuntimeConfig(env);
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(message);
});

test("acceptance mode is rejected outside test", () => {
  const result = readRuntimeConfig({ ...acceptanceEnv, REACT_APP_ENVIRONMENT: "production" });
  expect(result.ok).toBe(false);
  expect(result.error).toMatch(/only in the synthetic test/);
});

test.each(["", "prod", "staging-ish", "owner", "TESTING"])("rejects unsupported runtime environment %p", (environment) => {
  const env = { ...validTestEnv, REACT_APP_ENVIRONMENT: environment };
  if (!environment) delete env.REACT_APP_ENVIRONMENT;
  expect(readRuntimeConfig(env)).toMatchObject({ ok: false });
});

test("production accepts only the production project but never advertises browser demo authentication", () => {
  const runtime = readRuntimeConfig({
    ...validTestEnv,
    REACT_APP_ENVIRONMENT: "production",
    REACT_APP_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
    REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: PRODUCTION_SUPABASE_PROJECT_REF,
  });
  expect(runtime).toMatchObject({ ok: true, isProduction: true, browserDemoAccess: false, productionAuthenticationAvailable: false });
});

test("preview refuses production and Owner UAT projects", () => {
  const production = readRuntimeConfig({
    ...validTestEnv,
    REACT_APP_ENVIRONMENT: "preview",
    REACT_APP_SUPABASE_URL: `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`,
    REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: PRODUCTION_SUPABASE_PROJECT_REF,
  });
  const ownerUat = readRuntimeConfig({
    ...validTestEnv,
    REACT_APP_ENVIRONMENT: "preview",
    REACT_APP_SUPABASE_URL: `https://${OWNER_UAT_SUPABASE_PROJECT_REF}.supabase.co`,
    REACT_APP_ALLOWED_SUPABASE_PROJECT_REF: OWNER_UAT_SUPABASE_PROJECT_REF,
  });
  expect(production.ok).toBe(false);
  expect(ownerUat.ok).toBe(false);
});

test.each(["uat", "owner-uat"])("preserves the protected Owner UAT runtime for %s", (environment) => {
  expect(readRuntimeConfig({ ...validUatEnv, REACT_APP_ENVIRONMENT: environment })).toMatchObject({ ok: true, isUat: true, controlledWrites: true });
});
