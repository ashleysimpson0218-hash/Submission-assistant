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

test("clears durable Action Center state before legacy workspace navigation leaves Home", () => {
  const workspaceStart = appSource.indexOf("<RecruiterWorkspacePage");
  const workspaceEnd = appSource.indexOf("/>", workspaceStart);
  const workspaceProps = appSource.slice(workspaceStart, workspaceEnd);
  expect(workspaceProps).toMatch(/onOpenCandidate=\{\(candidateId\) => \{[\s\S]*?leaveActionCenterNavigation\("workspace"\)[\s\S]*?setActivePage\("workspace"\)/);
  expect(workspaceProps).toMatch(/onOpenRequisition=\{\(\) => \{[\s\S]*?leaveActionCenterNavigation\("positions"\)[\s\S]*?setActivePage\("positions"\)/);
  expect(workspaceProps).toMatch(/onOpenCalendar=\{\(\) => \{[\s\S]*?leaveActionCenterNavigation\("calendar"\)[\s\S]*?setActivePage\("calendar"\)/);
  expect(workspaceProps).toMatch(/onAddCalendarEvent=\{\(\) => \{[\s\S]*?leaveActionCenterNavigation\("calendar"\)[\s\S]*?openCalendarCreate\(\)/);
  expect(workspaceProps).toMatch(/onScheduleCalendar=\{\(task\) => \{[\s\S]*?leaveActionCenterNavigation\("calendar"\)[\s\S]*?openCalendarCreate/);
});
