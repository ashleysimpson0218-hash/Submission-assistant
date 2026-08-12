import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");

test("Home is the canonical Recruiter Workspace and the separate Workspace nav item is removed", () => {
  const navSource = appSource.slice(appSource.indexOf("const nav = ["), appSource.indexOf("function navigateToPage"));
  expect(navSource).toContain('["home", "Home"');
  expect(navSource).toContain('["calendar", "Calendar"');
  expect(navSource).not.toContain('["actions", "Workspace"');
  expect(navSource).toContain('["reports", "Weekly Reporting"');
  expect(navSource).toContain('["reporting", "Reports & History"');
  expect(appSource).toContain('if (key === "actions")');
  expect(appSource).toMatch(/if \(key === "actions"\)[\s\S]*?setActivePage\("home"\)/);
  expect(appSource).toContain('<RecruiterWorkspacePage');
  expect(appSource).toContain('<InternalCalendarPage');
});

test("candidate profile workspace remains a candidate route", () => {
  expect(appSource).toContain('const candidateRouteKeys = ["candidates", "hot", "hotLegacy", "hotMockup", "submission", "tracker", "workspace"]');
  expect(appSource).toContain('setActivePage("workspace")');
});

test("keeps legacy queue navigation separate from exact Action Center candidate navigation", () => {
  const workspaceStart = appSource.indexOf("<RecruiterWorkspacePage");
  const workspaceEnd = appSource.indexOf("/>", workspaceStart);
  const workspaceProps = appSource.slice(workspaceStart, workspaceEnd);
  expect(workspaceProps).toContain("onOpenCandidate={(candidateId) => {");
  expect(workspaceProps).toContain("setSelectedId(candidateId)");
  expect(workspaceProps).toContain("onOpenActionCenterCandidate={openActionCenterCandidateRecord}");
  expect(workspaceProps).not.toContain("onOpenCandidate={openActionCenterCandidateRecord}");
});
