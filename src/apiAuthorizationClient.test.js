import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.resolve(__dirname, "App.js"), "utf8");

describe("protected recruiter API client boundary", () => {
  test("resume parsing sends the current bearer token and exact workspace", () => {
    expect(appSource).toContain("supabase.auth.getSession()");
    expect(appSource).toContain("Authorization: `Bearer ${accessToken}`");
    expect(appSource).toContain('"X-WelcomeFlow-Workspace-Id": CLOUD_WORKSPACE_ID');
  });

  test("protected resume failures are surfaced instead of silently falling back", () => {
    expect(appSource).toContain("__resumeParserError: true");
    expect(appSource).toContain("if (apiResult?.__resumeParserError)");
    expect(appSource).toContain("throw error");
  });

  test("email requests send the same bearer and workspace boundary", () => {
    expect(appSource).toContain("Authorization: `Bearer ${accessToken}`");
    expect(appSource).toContain('"X-WelcomeFlow-Workspace-Id": CLOUD_WORKSPACE_ID');
  });
});
