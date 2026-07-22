import fs from "fs";
import path from "path";
import { CANDIDATE_SECTION_OPTIONS, candidateSectionValueFor } from "./App";

describe("candidate section navigation", () => {
  test("offers every primary candidate destination in one dropdown", () => {
    expect(CANDIDATE_SECTION_OPTIONS.map((option) => option.value)).toEqual(["home", "queue", "intake", "active", "archived"]);
  });

  test.each([
    ["candidates", "active", "home"],
    ["candidates", "archived", "archived"],
    ["hot", "", "queue"],
    ["hotLegacy", "", "queue"],
    ["hotMockup", "", "queue"],
    ["submission", "", "intake"],
    ["workspace", "", "active"],
    ["tracker", "", "active"],
  ])("maps %s to the correct current dropdown value", (page, tab, expected) => {
    expect(candidateSectionValueFor(page, tab)).toBe(expected);
  });

  test("renders the shared navigation above all candidate routes", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toContain('const candidateRouteKeys = ["candidates", "hot", "hotLegacy", "hotMockup", "submission", "tracker", "workspace"]');
    expect(source).toMatch(/candidateRouteKeys\.includes\(activePage\) \? <CandidateSectionNavigator/);
    expect(source).toContain('aria-label="Candidate section navigation"');
    expect(source).not.toContain('placeholder="Choose a working page"');
  });
});
