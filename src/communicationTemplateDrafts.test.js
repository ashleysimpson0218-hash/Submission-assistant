import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import CommunicationTemplateDraftsPanel from "./CommunicationTemplateDraftsPanel";
import { buildCommunicationTokenMap, renderCommunicationTemplate, resolveCandidateTypeTemplate } from "./communicationGeneration";
import {
  DRAFT_TEMPLATE_SPECS,
  DRAFT_TEXT_SPECS,
  createInitialDraft,
  createInitialTextDraft,
  draftCoverage,
  restoreDraftVersionAsNew,
  saveDraftVariant,
  saveTextDraft,
  syntheticDraftScenario,
  validateDraftTemplate,
} from "./communicationTemplateDrafts";

function settingsFixture() {
  return {
    general: { recruiterName: "Synthetic Recruiter", recruiterEmail: "recruiter@example.test" },
    templates: {
      hiringManager: { id: "root-hm", status: "Active", subject: "Current HM root", body: "Current HM body" },
      candidateConfirmation: { id: "root-confirm", status: "Active", subject: "Current confirmation root", body: "Current confirmation body" },
      atsUpdate: { id: "root-ats", status: "Active", subject: "Current ATS root", body: "Current ATS body" },
    },
    textTemplates: [
      { id: "unrelated-one", status: "Active", body: "Unrelated one" },
      { id: "unrelated-two", status: "Active", body: "Unrelated two" },
    ],
  };
}

const TEST_RUNTIME = { environment: "test", projectRef: "bjverobaoujhfaylyrzi" };

describe("candidate-type communication template drafts", () => {
  test("all approved variants begin as Draft and preserve canonical syntax", () => {
    Object.keys(DRAFT_TEMPLATE_SPECS).forEach((key) => {
      const draft = createInitialDraft(key, "2026-07-17T00:00:00.000Z");
      expect(draft.status).toBe("Draft");
      expect(`${draft.subject}\n${draft.body}\n${Object.values(draft.conditionalBlocks).join("\n")}`).not.toMatch(/\{\{|payType|differentialSummary/);
    });
    Object.keys(DRAFT_TEXT_SPECS).forEach((type) => expect(createInitialTextDraft(type).status).toBe("Draft"));
  });

  test("saving facility, confirmation, and ATS variants preserves every current root", () => {
    let settings = settingsFixture();
    const roots = JSON.parse(JSON.stringify(settings.templates));
    Object.keys(DRAFT_TEMPLATE_SPECS).forEach((specKey) => {
      const spec = DRAFT_TEMPLATE_SPECS[specKey];
      const result = saveDraftVariant(settings, { templateKey: spec.templateKey, candidateType: spec.candidateType, draft: createInitialDraft(specKey), now: "2026-07-17T01:00:00.000Z" });
      settings = result.settings;
      expect(result.draft.status).toBe("Draft");
      expect(result.draft.approvedAt).toBeNull();
    });
    Object.entries(roots).forEach(([key, root]) => {
      const { draftVariants, ...currentRoot } = settings.templates[key];
      expect(draftVariants).toBeDefined();
      expect(currentRoot).toEqual(root);
    });
    expect(settings.templates.hiringManager.draftVariants.Rehire.body).toBe("");
    expect(settings.templates.hiringManager.draftVariants.Rehire.conditionalBlocks.rehireSection).toMatch(/rehire_eligibility/);
  });

  test("explicit candidate text mappings never select or alter a random root text template", () => {
    let settings = settingsFixture();
    const rootTexts = JSON.parse(JSON.stringify(settings.textTemplates));
    ["External", "Internal", "Rehire"].forEach((candidateType) => {
      settings = saveTextDraft(settings, { candidateType, draft: createInitialTextDraft(candidateType) }).settings;
      expect(settings.communicationTemplateDrafts.submissionTextTemplateByCandidateType[candidateType]).toBe(`submission-text-draft-${candidateType.toLowerCase()}`);
    });
    expect(settings.textTemplates).toEqual(rootTexts);
    expect(Object.values(settings.communicationTemplateDrafts.submissionTextTemplateByCandidateType)).not.toContain("unrelated-one");
  });

  test("safe Internal and Rehire tokens render from immutable snapshots without employee ID or notes", () => {
    const internal = buildCommunicationTokenMap(syntheticDraftScenario("Internal", settingsFixture()));
    expect(internal).toMatchObject({ current_position: "Staff Nurse", current_facility: "Synthetic Current Facility", internal_move_type: "Transfer", internal_eligibility_status: "Eligible", current_manager_aware: "Yes", reason_for_transfer: "Synthetic career growth" });
    expect(internal).not.toHaveProperty("employee_id");
    const rehire = buildCommunicationTokenMap(syntheticDraftScenario("Rehire", settingsFixture()));
    expect(rehire).toMatchObject({ previous_employee: "Yes", previous_facility: "Synthetic Prior Facility", rehire_eligibility: "Eligible for rehire" });
    expect(rehire).not.toHaveProperty("previous_employment_notes");
  });

  test("every approved synthetic draft validates while remaining non-operational", () => {
    Object.entries(DRAFT_TEMPLATE_SPECS).forEach(([specKey, spec]) => {
      const result = validateDraftTemplate(createInitialDraft(specKey), { candidateType: spec.candidateType, templateKey: spec.templateKey, settings: settingsFixture() });
      expect(result.valid).toBe(true);
      expect(result.label).toBe("DRAFT PREVIEW — NOT ACTIVE");
      expect(result.rendered.body).not.toMatch(/\[UNRESOLVED TOKEN|\[RESTRICTED TOKEN/);
    });
    Object.keys(DRAFT_TEXT_SPECS).forEach((type) => expect(validateDraftTemplate(createInitialTextDraft(type), { candidateType: type, templateKey: "candidateText", settings: settingsFixture() }).valid).toBe(true));
  });

  test("unsupported syntax and restricted ATS tokens block validation visibly", () => {
    const unsupported = validateDraftTemplate({ ...createInitialDraft("candidate:External"), body: "Pay: {{payType}}" }, { candidateType: "External", templateKey: "candidateConfirmation", settings: settingsFixture() });
    expect(unsupported.valid).toBe(false);
    expect(unsupported.unsupportedTokens).toContain("{{payType}}");
    expect(unsupported.rendered.body).toMatch(/UNRESOLVED TOKEN/);
    const restricted = validateDraftTemplate({ ...createInitialDraft("ats:Standard"), body: "Employee: {employee_id}" }, { candidateType: "Standard", templateKey: "atsUpdate", settings: settingsFixture() });
    expect(restricted.valid).toBe(false);
    expect(restricted.restrictedTokens).toContain("employee_id");
    expect(restricted.rendered.body).toMatch(/RESTRICTED TOKEN/);
  });

  test("optional empty headings disappear instead of rendering blank sections", () => {
    const tokens = buildCommunicationTokenMap(syntheticDraftScenario("External", settingsFixture()));
    const empty = { ...tokens, experience: "", credentials: "", education: "", final_compensation: "", interview_availability: "", candidate_notes: "" };
    const view = renderCommunicationTemplate(createInitialDraft("facility:External"), empty);
    ["Experience:", "Credentials:", "Expected / Final Rate:", "Interview Availability:", "Recruiter Notes:"].forEach((heading) => expect(view.body).not.toContain(heading));
  });

  test("revision history, comparison hash, and restore create a newer Draft without activation", () => {
    const base = settingsFixture();
    const first = saveDraftVariant(base, { templateKey: "hiringManager", candidateType: "External", draft: createInitialDraft("facility:External"), now: "2026-07-17T01:00:00.000Z" });
    const second = saveDraftVariant(first.settings, { templateKey: "hiringManager", candidateType: "External", draft: { ...first.draft, body: `${first.draft.body}\nEdited` }, status: "Needs Review", now: "2026-07-17T02:00:00.000Z" });
    expect(second.draft.version).toBe(2);
    expect(second.draft.history).toHaveLength(1);
    expect(second.draft.baseHash).toBe(first.draft.baseHash);
    const restored = restoreDraftVersionAsNew(second.settings, { templateKey: "hiringManager", candidateType: "External", version: 1, now: "2026-07-17T03:00:00.000Z" });
    expect(restored.draft.version).toBe(3);
    expect(restored.draft.status).toBe("Draft");
    expect(restored.draft.approvedAt).toBeNull();
  });

  test("missing or Draft variant status is never selected as Active", () => {
    const root = settingsFixture().templates.hiringManager;
    const missingStatus = resolveCandidateTypeTemplate({ ...root, draftVariants: { Internal: { body: "Missing status" } } }, "Internal");
    expect(missingStatus.active).toBe(false);
    const draftStatus = resolveCandidateTypeTemplate({ ...root, draftVariants: { Internal: { status: "Draft", body: "Draft only" } } }, "Internal");
    expect(draftStatus.active).toBe(false);
    expect(draftStatus.variantKey).toBe("root-comparison");
  });

  test("coverage distinguishes Draft from Active and includes separate Rehire section", () => {
    let settings = settingsFixture();
    for (const key of Object.keys(DRAFT_TEMPLATE_SPECS)) {
      const spec = DRAFT_TEMPLATE_SPECS[key];
      settings = saveDraftVariant(settings, { templateKey: spec.templateKey, candidateType: spec.candidateType, draft: createInitialDraft(key) }).settings;
    }
    expect(draftCoverage(settings)).toMatchObject({ facility: { External: "Draft", Internal: "Draft", Rehire: "Draft" }, candidate: { External: "Draft", Internal: "Draft", Rehire: "Draft" }, ats: { Standard: "Draft" } });
  });

  test("test-only editor displays exact save review and cannot expose Activate or operational actions", () => {
    const setSettings = jest.fn();
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => Promise.reject(new Error("unexpected network")));
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    render(<CommunicationTemplateDraftsPanel settings={settingsFixture()} setSettings={setSettings} runtime={TEST_RUNTIME} />);
    expect(screen.getByText("Candidate-Type Communication Drafts")).toBeInTheDocument();
    expect(screen.getByText(/WelcomeFlow Test verified/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Activate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Candidate Ready|Send|Copy/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview With Synthetic Scenario" }));
    expect(screen.getByText("DRAFT PREVIEW — NOT ACTIVE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    expect(screen.getByLabelText("Exact draft save review")).toBeInTheDocument();
    expect(setSettings).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore(); openSpy.mockRestore();
  });

  test("production runtime blocks Save Draft before setSettings", () => {
    const setSettings = jest.fn();
    render(<CommunicationTemplateDraftsPanel settings={settingsFixture()} setSettings={setSettings} runtime={{ environment: "test", projectRef: "qfpgednixvveelgwfylv" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save Draft" })[1]);
    expect(setSettings).not.toHaveBeenCalled();
    expect(screen.getAllByText(/refuses the production Supabase project/i).length).toBeGreaterThan(0);
  });

  test("implementation contains no send, copy, mailto, candidate-ready, Supabase, or API bridge", () => {
    const panelSource = fs.readFileSync(path.join(__dirname, "CommunicationTemplateDraftsPanel.js"), "utf8");
    const modelSource = fs.readFileSync(path.join(__dirname, "communicationTemplateDrafts.js"), "utf8");
    expect(`${panelSource}\n${modelSource}`).not.toMatch(/mailto|navigator\.clipboard|Mark Candidate Ready|buildOutput|generateOutput|supabase\.|\/api\//i);
    expect(panelSource).not.toMatch(/fetch\(|XMLHttpRequest|createClient/);
  });
});
