import fs from "fs";
import path from "path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CommunicationTemplateDraftsPanel from "./CommunicationTemplateDraftsPanel";
import { loadLatestDraftSettings, saveCommunicationDraftToCloud } from "./communicationDraftCloudSave";
import {
  DRAFT_SAVE_ERRORS,
  DRAFT_TEMPLATE_SPECS,
  createDraftEditBaseline,
  createInitialDraft,
  createInitialTextDraft,
  draftRecordCount,
  draftRootHashes,
  saveCommunicationDraftSafely,
  saveDraftVariant,
  saveTextDraft,
  verifyDraftSaveIntegrity,
} from "./communicationTemplateDrafts";

const TEST_RUNTIME = { environment: "test", projectRef: "bjverobaoujhfaylyrzi" };
const PROD_RUNTIME = { environment: "test", projectRef: "qfpgednixvveelgwfylv" };

function rootSettings() {
  return {
    templates: {
      hiringManager: { id: "root-hm", status: "Active", subject: "HM root", body: "HM root body" },
      candidateConfirmation: { id: "root-cc", status: "Active", subject: "CC root", body: "CC root body" },
      atsUpdate: { id: "root-ats", status: "Active", subject: "ATS root", body: "ATS root body" },
    },
    textTemplates: [{ id: "existing-text", status: "Active", body: "Existing root text" }],
    options: { untouched: true },
    candidates: [],
    tracker: [],
    history: [],
    outputs: [],
  };
}

function allDraftSettings() {
  let settings = rootSettings();
  Object.keys(DRAFT_TEMPLATE_SPECS).forEach((specKey) => {
    const spec = DRAFT_TEMPLATE_SPECS[specKey];
    settings = saveDraftVariant(settings, { templateKey: spec.templateKey, candidateType: spec.candidateType, draft: createInitialDraft(specKey), now: `2026-07-18T00:00:0${Object.keys(settings.templates?.[spec.templateKey]?.draftVariants || {}).length}.000Z` }).settings;
  });
  ["External", "Internal", "Rehire"].forEach((candidateType) => {
    settings = saveTextDraft(settings, { candidateType, draft: createInitialTextDraft(candidateType), now: "2026-07-18T00:01:00.000Z" }).settings;
  });
  return settings;
}

function saveSelected(latestSettings, { kind = "facility", templateKey = "hiringManager", candidateType = "External", draft, status = "Draft", openedSettings = latestSettings } = {}) {
  const baseline = createDraftEditBaseline(openedSettings, { kind, templateKey, candidateType });
  const current = kind === "text"
    ? latestSettings.communicationTemplateDrafts.textTemplates[candidateType]
    : latestSettings.templates[templateKey].draftVariants[candidateType];
  return saveCommunicationDraftSafely({ latestSettings, baseline, kind, templateKey, candidateType, draft: draft || { ...current, body: `${current.body}\nFocused edit` }, status, now: "2026-07-18T01:00:00.000Z" });
}

describe("communication draft save hardening", () => {
  test("saving External Facility preserves Internal, Rehire, confirmation, text, ATS, and roots", () => {
    const settings = allDraftSettings();
    const roots = draftRootHashes(settings);
    const internal = settings.templates.hiringManager.draftVariants.Internal;
    const rehire = settings.templates.hiringManager.draftVariants.Rehire;
    const confirmations = settings.templates.candidateConfirmation.draftVariants;
    const texts = settings.communicationTemplateDrafts;
    const ats = settings.templates.atsUpdate.draftVariants.Standard;
    const result = saveSelected(settings, {});
    expect(result.ok).toBe(true);
    expect(result.settings.templates.hiringManager.draftVariants.Internal).toEqual(internal);
    expect(result.settings.templates.hiringManager.draftVariants.Rehire).toEqual(rehire);
    expect(result.settings.templates.candidateConfirmation.draftVariants).toEqual(confirmations);
    expect(result.settings.communicationTemplateDrafts).toEqual(texts);
    expect(result.settings.templates.atsUpdate.draftVariants.Standard).toEqual(ats);
    expect(draftRootHashes(result.settings)).toEqual(roots);
  });

  test.each([
    ["Internal", "External", "Rehire"],
    ["Rehire", "External", "Internal"],
  ])("saving %s Facility preserves %s and %s Facility", (selected, first, second) => {
    const settings = allDraftSettings();
    const result = saveSelected(settings, { candidateType: selected });
    expect(result.ok).toBe(true);
    expect(result.settings.templates.hiringManager.draftVariants[first]).toEqual(settings.templates.hiringManager.draftVariants[first]);
    expect(result.settings.templates.hiringManager.draftVariants[second]).toEqual(settings.templates.hiringManager.draftVariants[second]);
  });

  test("saving External Candidate Confirmation preserves Internal and Rehire confirmations", () => {
    const settings = allDraftSettings();
    const result = saveSelected(settings, { kind: "candidate", templateKey: "candidateConfirmation", candidateType: "External" });
    expect(result.ok).toBe(true);
    expect(result.settings.templates.candidateConfirmation.draftVariants.Internal).toEqual(settings.templates.candidateConfirmation.draftVariants.Internal);
    expect(result.settings.templates.candidateConfirmation.draftVariants.Rehire).toEqual(settings.templates.candidateConfirmation.draftVariants.Rehire);
  });

  test("saving External Text preserves Internal/Rehire text mappings and every non-text draft", () => {
    const settings = allDraftSettings();
    const result = saveSelected(settings, { kind: "text", templateKey: "candidateText", candidateType: "External" });
    expect(result.ok).toBe(true);
    expect(result.settings.communicationTemplateDrafts.submissionTextTemplateByCandidateType.Internal).toBe(settings.communicationTemplateDrafts.submissionTextTemplateByCandidateType.Internal);
    expect(result.settings.communicationTemplateDrafts.submissionTextTemplateByCandidateType.Rehire).toBe(settings.communicationTemplateDrafts.submissionTextTemplateByCandidateType.Rehire);
    expect(result.settings.templates).toEqual(settings.templates);
  });

  test("saving ATS preserves all facility drafts", () => {
    const settings = allDraftSettings();
    const result = saveSelected(settings, { kind: "ats", templateKey: "atsUpdate", candidateType: "Standard" });
    expect(result.ok).toBe(true);
    expect(result.settings.templates.hiringManager.draftVariants).toEqual(settings.templates.hiringManager.draftVariants);
  });

  test("same-draft stale conflict blocks save with exact guidance", () => {
    const opened = allDraftSettings();
    const latest = JSON.parse(JSON.stringify(opened));
    latest.templates.hiringManager.draftVariants.External.body += "\nNewer browser edit";
    const result = saveSelected(latest, { openedSettings: opened });
    expect(result).toEqual({ ok: false, error: DRAFT_SAVE_ERRORS.stale });
  });

  test("unrelated draft changes are merged from latest settings", () => {
    const opened = allDraftSettings();
    const latest = JSON.parse(JSON.stringify(opened));
    latest.templates.hiringManager.draftVariants.Internal.body += "\nConcurrent Internal edit";
    latest.communicationTemplateDrafts.textTemplates.Rehire.body += "\nConcurrent Rehire text edit";
    const result = saveSelected(latest, { openedSettings: opened });
    expect(result.ok).toBe(true);
    expect(result.settings.templates.hiringManager.draftVariants.Internal.body).toMatch(/Concurrent Internal edit/);
    expect(result.settings.communicationTemplateDrafts.textTemplates.Rehire.body).toMatch(/Concurrent Rehire text edit/);
  });

  test("root hash mismatch blocks save with exact runtime message", () => {
    const opened = allDraftSettings();
    const latest = JSON.parse(JSON.stringify(opened));
    latest.templates.hiringManager.subject = "Newer root subject";
    const result = saveSelected(latest, { openedSettings: opened });
    expect(result).toEqual({ ok: false, error: DRAFT_SAVE_ERRORS.root });
  });

  test("coverage integrity rejects any missing draft and normal saves cannot decrease coverage", () => {
    const settings = allDraftSettings();
    const broken = JSON.parse(JSON.stringify(settings));
    delete broken.templates.hiringManager.draftVariants.Internal;
    expect(verifyDraftSaveIntegrity(settings, broken)).toEqual({ ok: false, error: DRAFT_SAVE_ERRORS.coverage });
    const overwritten = JSON.parse(JSON.stringify(settings));
    overwritten.templates.hiringManager.draftVariants.Internal.body = "Unexpected overwrite";
    expect(verifyDraftSaveIntegrity(settings, overwritten, { kind: "facility", templateKey: "hiringManager", candidateType: "External" })).toEqual({ ok: false, error: DRAFT_SAVE_ERRORS.coverage });
    const result = saveSelected(settings, {});
    expect(result.coverageBefore).toBe(10);
    expect(result.coverageAfter).toBe(10);
    expect(draftRecordCount(result.settings)).toBe(10);
  });

  test("version history and unrelated settings remain intact without activation", () => {
    const settings = allDraftSettings();
    const existing = settings.templates.hiringManager.draftVariants.External;
    const result = saveSelected(settings, {});
    expect(result.draft.version).toBe(existing.version + 1);
    expect(result.draft.history).toHaveLength(existing.history.length + 1);
    expect(result.settings.options).toEqual(settings.options);
    Object.values(result.settings.templates).forEach((root) => Object.values(root.draftVariants || {}).forEach((variant) => expect(["Draft", "Needs Review"]).toContain(variant.status)));
    Object.values(result.settings.communicationTemplateDrafts.textTemplates).forEach((variant) => expect(["Draft", "Needs Review"]).toContain(variant.status));
  });

  test("operational collections remain untouched", () => {
    const settings = allDraftSettings();
    const result = saveSelected(settings, {});
    ["candidates", "tracker", "history", "outputs"].forEach((key) => expect(result.settings[key]).toEqual(settings[key]));
  });

  test("runtime accepts the Test project and rejects production before a query", async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { data: { settings: allDraftSettings() }, updated_at: "2026-07-18T00:00:00Z" }, error: null });
    const client = { from: jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })) };
    const accepted = await loadLatestDraftSettings({ client, table: "workspace", workspaceId: "default", runtime: TEST_RUNTIME });
    expect(accepted.ok).toBe(true);
    expect(client.from).toHaveBeenCalledTimes(1);
    client.from.mockClear();
    const rejected = await loadLatestDraftSettings({ client, table: "workspace", workspaceId: "default", runtime: PROD_RUNTIME });
    expect(rejected.ok).toBe(false);
    expect(rejected.error).toMatch(/refuses the production/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  test("cloud save uses optimistic updated_at matching and writes the latest merged workspace", async () => {
    const latestSettings = allDraftSettings();
    const opened = JSON.parse(JSON.stringify(latestSettings));
    const selected = latestSettings.templates.hiringManager.draftVariants.External;
    const loadMaybeSingle = jest.fn().mockResolvedValue({ data: { data: { settings: latestSettings, candidates: [], tracker: [] }, updated_at: "before" }, error: null });
    const updateMaybeSingle = jest.fn().mockResolvedValue({ data: { updated_at: "after" }, error: null });
    const updateEqSecond = jest.fn(() => ({ select: () => ({ maybeSingle: updateMaybeSingle }) }));
    const updateEqFirst = jest.fn(() => ({ eq: updateEqSecond }));
    const update = jest.fn(() => ({ eq: updateEqFirst }));
    const client = { from: jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: loadMaybeSingle }) }), update })) };
    const result = await saveCommunicationDraftToCloud({
      client, table: "workspace", workspaceId: "default", runtime: TEST_RUNTIME,
      baseline: createDraftEditBaseline(opened, { kind: "facility", templateKey: "hiringManager", candidateType: "External" }),
      operation: { kind: "facility", templateKey: "hiringManager", candidateType: "External", draft: { ...selected, body: `${selected.body}\nEdit` }, status: "Draft" },
      now: jest.fn().mockReturnValueOnce("draft-time").mockReturnValue("save-time"),
    });
    expect(result.ok).toBe(true);
    expect(updateEqFirst).toHaveBeenCalledWith("workspace_id", "default");
    expect(updateEqSecond).toHaveBeenCalledWith("updated_at", "before");
    expect(update).toHaveBeenCalledTimes(1);
  });

  test("UI shows stale conflict and Refresh Draft loads the current record", async () => {
    const settings = allDraftSettings();
    const onSaveDraft = jest.fn().mockResolvedValue({ ok: false, error: DRAFT_SAVE_ERRORS.stale });
    const refreshedSettings = JSON.parse(JSON.stringify(settings));
    refreshedSettings.templates.hiringManager.draftVariants.External.body += "\nRefreshed content";
    const onRefreshDraft = jest.fn().mockResolvedValue({ ok: true, settings: refreshedSettings });
    render(<CommunicationTemplateDraftsPanel settings={settings} setSettings={jest.fn()} runtime={TEST_RUNTIME} onSaveDraft={onSaveDraft} onRefreshDraft={onRefreshDraft} />);
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save Draft" })[1]);
    expect(await screen.findByText(DRAFT_SAVE_ERRORS.stale)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Draft" }));
    await waitFor(() => expect(screen.getByLabelText("Draft body").value).toContain("Refreshed content"));
  });

  test("hardening code has no disabled API, candidate-ready, send, copy, or output bridge", () => {
    const source = ["communicationDraftCloudSave.js", "CommunicationTemplateDraftsPanel.js", "communicationTemplateDrafts.js"].map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");
    expect(source).not.toMatch(/\/api\/|buildOutput|generateOutput|Mark Candidate Ready|mailto|navigator\.clipboard|send-email|book-screening|parse-resume/i);
  });

  test("a previously scheduled workspace autosave rechecks the protected-save pause before writing", () => {
    const source = fs.readFileSync(path.join(__dirname, "App.js"), "utf8");
    expect(source).toMatch(/window\.setTimeout\(async \(\) => \{\s*if \(draftCloudSavePauseRef\.current\) return;\s*setCloudStatus\("Saving to cloud\.\.\."\)/);
  });
});
