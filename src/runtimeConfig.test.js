import { PRODUCTION_SUPABASE_PROJECT_REF, readRuntimeConfig } from "./runtimeConfig";

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
