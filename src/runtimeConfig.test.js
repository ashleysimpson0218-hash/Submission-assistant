import { OWNER_UAT_SUPABASE_PROJECT_REF, PRODUCTION_SUPABASE_PROJECT_REF, SYNTHETIC_TEST_SUPABASE_PROJECT_REF, readRuntimeConfig } from "./runtimeConfig";

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
