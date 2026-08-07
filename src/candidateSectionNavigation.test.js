import fs from "fs";
import path from "path";
import { CANDIDATE_SECTION_OPTIONS } from "./App";

describe("candidate section navigation", () => {
  test("offers every primary candidate destination in one dropdown", () => {
    expect(CANDIDATE_SECTION_OPTIONS).toEqual([
      { value: "queue", label: "Candidate Queue" },
      { value: "intake", label: "Candidate Intake" },
      { value: "profiles", label: "Candidate Profile Movement Board" },
      { value: "management", label: "Candidate Management" },
      { value: "screening", label: "Screening Queue" },
    ]);
  });

  test("uses an action placeholder so the current section can be reopened", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toContain('value="" onChange={(event) => onChange(event.target.value)}');
    expect(source).toContain('placeholder="Choose a Candidate section"');
  });

  test("routes every section to its working page", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toMatch(/section === "queue"[\s\S]*?setActivePage\("hot"\)/);
    expect(source).toMatch(/section === "intake"[\s\S]*?startBlankActiveCandidateIntake\(\)/);
    expect(source).toMatch(/section === "profiles"[\s\S]*?setTrackerPanelOpen\(true\)[\s\S]*?setActivePage\("workspace"\)/);
    expect(source).toMatch(/section === "management"[\s\S]*?setCandidateManagementTab\("connect"\)[\s\S]*?setActivePage\("candidates"\)/);
    expect(source).toMatch(/section === "screening"[\s\S]*?setCandidateManagementTab\("screening"\)/);
  });

  test("renders the shared navigation above all candidate routes", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toContain('const candidateRouteKeys = ["candidates", "hot", "hotLegacy", "hotMockup", "submission", "tracker", "workspace"]');
    expect(source).toMatch(/candidateRouteKeys\.includes\(activePage\) \? <CandidateSectionNavigator/);
    expect(source).toContain('aria-label="Candidate section navigation"');
    expect(source).not.toContain('placeholder="Choose a working page"');
  });
});
