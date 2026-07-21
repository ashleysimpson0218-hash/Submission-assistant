import fs from "fs";
import path from "path";

const appSource = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");

test("Automation Center is reached through Facility & Position Setup instead of the main navigation", () => {
  const navSource = appSource.slice(appSource.indexOf("const nav = ["), appSource.indexOf("function navigateToPage"));
  const setupSource = appSource.slice(appSource.indexOf("function FacilityPositionSetupPage"), appSource.indexOf("function SettingsPanel"));

  expect(navSource).not.toContain('["automation", "Automation Center"');
  expect(setupSource).toContain('onClick={() => setActivePage("automation")}>✨ Automation Center</Button>');
});

test("Automation Center provides a direct return to Setup without changing its page implementation", () => {
  expect(appSource).toContain('activePage === "automation"');
  expect(appSource).toContain('onClick={() => setActivePage("positions")}>Back to Setup</Button>');
});
