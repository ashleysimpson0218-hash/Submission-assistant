const fs = require("fs");
const path = require("path");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("UAT entrypoint requires owner authentication before loading the existing application", () => {
  const index = source("src/index.js");
  expect(index).toMatch(/<OwnerUatAuthGate>\{application\}<\/OwnerUatAuthGate>/);
  expect(index).toMatch(/const applicationImport = import\('\.\/App'\)/);
});

test("UAT client contains no service credential", () => {
  const clientSource = source("src/OwnerUatAuthGate.js") + source("src/supabaseRuntimeClient.js") + source("src/runtimeConfig.js");
  expect(clientSource).not.toMatch(/SERVICE_ROLE|SERVICE_KEY|WELCOMEFLOW_UAT_SERVICE|SUPABASE_SECRET/);
  expect(clientSource).toMatch(/supabasePublishableKey/);
});

test("UAT stores no workspace or candidate backup in browser storage", () => {
  const app = source("src/App.js");
  expect(app).toMatch(/if \(ownerUatMode\) return fallback/);
  expect(app).toMatch(/if \(ownerUatMode\) return;/);
});

test("UAT writes use only the authenticated version-checked RPC", () => {
  const app = source("src/App.js");
  expect(app).toMatch(/welcomeflow_save_owner_uat_workspace/);
  expect(app).toMatch(/expected_version: ownerUatWorkspaceVersion/);
  expect(app).toMatch(/ownerUatSaveQueue/);
});

test("UAT blocks communication, clipboard, external links, email, and resume parsing", () => {
  const app = source("src/App.js");
  expect(app).toMatch(/Copy actions are disabled in Owner UAT/);
  expect(app).toMatch(/External links and communication actions are disabled in Owner UAT/);
  expect(app).toMatch(/Email is disabled in Owner UAT/);
  expect(app).toMatch(/Email actions are disabled in Owner UAT/);
  expect(app).toMatch(/Resume actions are disabled in Owner UAT/);
  expect(app).toMatch(/Booking actions are disabled in Owner UAT/);
  expect(app).toMatch(/Communication actions are disabled in Owner UAT/);
});

test.each(["api/send-email.js", "api/book-screening.js", "api/parse-resume.js"])("%s remains disabled in Owner UAT", (file) => {
  expect(source(file)).toMatch(/WELCOMEFLOW_UAT_EXTERNAL_ACTIONS_DISABLED/);
});

test("obsolete unauthenticated UAT workspace route is absent", () => {
  expect(fs.existsSync(path.join(__dirname, "..", "api", "uat-workspace.js"))).toBe(false);
});
