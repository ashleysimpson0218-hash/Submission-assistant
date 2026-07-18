import {
  ACTIVATION_ERRORS,
  TEST_APPROVER_LABEL,
  activateCommunicationVariant,
  createActivationBaseline,
  deactivateCommunicationVariant,
  finalizeApprovedCommunication,
  releaseConditionFor,
} from "./communicationTemplateActivation";
import {
  createInitialDraft,
  createInitialTextDraft,
  draftRootHashes,
  restoreDraftVersionAsNew,
  saveDraftVariant,
  saveTextDraft,
} from "./communicationTemplateDrafts";

const runtime = { environment: "test", projectRef: "bjverobaoujhfaylyrzi" };
const clone = (value) => JSON.parse(JSON.stringify(value));

function rootSettings() {
  return {
    templates: {
      hiringManager: { status: "Active", subject: "Root facility {candidate_name}", body: "Root {employment_details}" },
      candidateConfirmation: { status: "Active", subject: "Root candidate {position}", body: "Root {employment_details}" },
      atsUpdate: { status: "Active", subject: "Root ATS {candidate_name}", body: "Root {employment_details}" },
    },
    textTemplates: [{ id: "legacy-text", status: "Active", body: "Legacy {candidate_name}" }],
  };
}

const selections = [
  { key: "facility:External", selection: { kind: "facility", templateKey: "hiringManager", candidateType: "External" } },
  { key: "facility:Internal", selection: { kind: "facility", templateKey: "hiringManager", candidateType: "Internal" } },
  { key: "facility:Rehire", selection: { kind: "facility", templateKey: "hiringManager", candidateType: "Rehire" } },
  { key: "candidate:External", selection: { kind: "candidate", templateKey: "candidateConfirmation", candidateType: "External" } },
  { key: "candidate:Internal", selection: { kind: "candidate", templateKey: "candidateConfirmation", candidateType: "Internal" } },
  { key: "candidate:Rehire", selection: { kind: "candidate", templateKey: "candidateConfirmation", candidateType: "Rehire" } },
  { key: "text:External", selection: { kind: "text", templateKey: "candidateText", candidateType: "External" } },
  { key: "text:Internal", selection: { kind: "text", templateKey: "candidateText", candidateType: "Internal" } },
  { key: "text:Rehire", selection: { kind: "text", templateKey: "candidateText", candidateType: "Rehire" } },
  { key: "ats:Standard", selection: { kind: "ats", templateKey: "atsUpdate", candidateType: "Standard" } },
];

function seededSettings() {
  let settings = rootSettings();
  selections.forEach(({ key, selection }, index) => {
    const now = `2026-07-18T18:${String(index).padStart(2, "0")}:00.000Z`;
    if (selection.kind === "text") settings = saveTextDraft(settings, { candidateType: selection.candidateType, draft: createInitialTextDraft(selection.candidateType, now), status: "Draft", now }).settings;
    else settings = saveDraftVariant(settings, { templateKey: selection.templateKey, candidateType: selection.candidateType, draft: createInitialDraft(key, now), status: "Draft", now }).settings;
  });
  return settings;
}

function activate(settings, selection, overrides = {}) {
  return activateCommunicationVariant({
    latestSettings: settings,
    baseline: createActivationBaseline(settings, selection),
    selection,
    confirmations: { reviewed: true, testOnly: true },
    runtime,
    now: "2026-07-18T20:00:00.000Z",
    ...overrides,
  });
}

describe("test-only communication activation", () => {
  test("production and missing runtime configurations are rejected", () => {
    const settings = seededSettings();
    const selection = selections[0].selection;
    expect(activate(settings, selection, { runtime: { environment: "test", projectRef: "qfpgednixvveelgwfylv" } }).ok).toBe(false);
    expect(activate(settings, selection, { runtime: {} }).ok).toBe(false);
  });

  test("both explicit review confirmations are required", () => {
    const settings = seededSettings();
    const selection = selections[0].selection;
    const result = activate(settings, selection, { confirmations: { reviewed: true, testOnly: false } });
    expect(result).toEqual({ ok: false, error: ACTIVATION_ERRORS.review });
  });

  test("stale drafts and root changes block activation", () => {
    const settings = seededSettings();
    const selection = selections[0].selection;
    const baseline = createActivationBaseline(settings, selection);
    const stale = clone(settings);
    stale.templates.hiringManager.draftVariants.External.body += " changed";
    expect(activateCommunicationVariant({ latestSettings: stale, baseline, selection, confirmations: { reviewed: true, testOnly: true }, runtime }).error).toBe(ACTIVATION_ERRORS.stale);
    const changedRoot = clone(settings);
    changedRoot.templates.hiringManager.subject += " changed";
    expect(activateCommunicationVariant({ latestSettings: changedRoot, baseline, selection, confirmations: { reviewed: true, testOnly: true }, runtime }).error).toBe(ACTIVATION_ERRORS.root);
  });

  test("unresolved and restricted ATS tokens fail validation", () => {
    const unresolved = seededSettings();
    unresolved.templates.candidateConfirmation.draftVariants.External.body += " {unsupported_value}";
    const selection = selections[3].selection;
    expect(activate(unresolved, selection).error).toBe(ACTIVATION_ERRORS.validation);
    const restricted = seededSettings();
    restricted.templates.atsUpdate.draftVariants.Standard.body += " {employee_id}";
    expect(activate(restricted, selections[9].selection).error).toBe(ACTIVATION_ERRORS.validation);
  });

  test("activation records approval, release metadata, and immutable history", () => {
    const settings = seededSettings();
    const roots = draftRootHashes(settings);
    const result = activate(settings, selections[0].selection);
    expect(result.ok).toBe(true);
    expect(result.record).toMatchObject({ status: "Active", approvedBy: TEST_APPROVER_LABEL, approvedAt: "2026-07-18T20:00:00.000Z", environment: "test", projectRef: "bjverobaoujhfaylyrzi", releaseCondition: "candidateReadyConfirmed" });
    expect(result.record.history.some((entry) => entry.status === "Draft")).toBe(true);
    expect(result.record.history.some((entry) => entry.previousStatus === "Draft" && entry.newStatus === "Active")).toBe(true);
    expect(draftRootHashes(result.settings)).toEqual(roots);
  });

  test("all ten variants activate independently and retain exact release conditions", () => {
    let settings = seededSettings();
    selections.forEach(({ selection }) => {
      const result = activate(settings, selection);
      expect(result.ok).toBe(true);
      expect(result.record.releaseCondition).toBe(releaseConditionFor(selection));
      settings = result.settings;
    });
    const statuses = selections.map(({ selection }) => selection.kind === "text"
      ? settings.communicationTemplateDrafts.textTemplates[selection.candidateType].status
      : settings.templates[selection.templateKey].draftVariants[selection.candidateType].status);
    expect(statuses).toEqual(Array(10).fill("Active"));
  });

  test("duplicate active communication combinations are blocked and reported", () => {
    const settings = seededSettings();
    settings.templates.hiringManager.draftVariants.LegacyExternal = { ...settings.templates.hiringManager.draftVariants.External, id: "legacy-external", candidateType: "External", status: "Active" };
    const result = activate(settings, selections[0].selection);
    expect(result.error).toBe(ACTIVATION_ERRORS.duplicate);
    expect(result.conflicts).toEqual([{ id: "legacy-external", version: 1, status: "Active" }]);
  });

  test("deactivation preserves the record and history", () => {
    const active = activate(seededSettings(), selections[0].selection);
    const result = deactivateCommunicationVariant({ latestSettings: active.settings, baseline: createActivationBaseline(active.settings, selections[0].selection), selection: selections[0].selection, runtime, now: "2026-07-18T21:00:00.000Z" });
    expect(result.ok).toBe(true);
    expect(result.record.status).toBe("Inactive");
    expect(result.record.id).toBe(active.record.id);
    expect(result.record.history.some((entry) => entry.newStatus === "Inactive")).toBe(true);
  });

  test("restoring a prior activated revision creates Draft, never Active", () => {
    const active = activate(seededSettings(), selections[0].selection);
    const version = active.record.history.find((entry) => entry.status === "Draft").version;
    const restored = restoreDraftVersionAsNew(active.settings, { templateKey: "hiringManager", candidateType: "External", version, now: "2026-07-18T22:00:00.000Z" });
    expect(restored.draft.status).toBe("Draft");
    expect(restored.draft.approvedAt).toBeNull();
  });

  test("approved wording is applied only to candidate-facing and ATS records", () => {
    const settings = seededSettings();
    const facility = settings.templates.hiringManager.draftVariants.External;
    expect(finalizeApprovedCommunication(facility, selections[0].selection).body).toBe(facility.body);
    expect(finalizeApprovedCommunication(settings.templates.candidateConfirmation.draftVariants.External, selections[3].selection).body).toContain("Your profile has been submitted");
    expect(finalizeApprovedCommunication(settings.communicationTemplateDrafts.textTemplates.Internal, selections[7].selection).body).toContain("has been sent for review");
    expect(finalizeApprovedCommunication(settings.templates.atsUpdate.draftVariants.Standard, selections[9].selection).body).toContain("Status: Candidate submitted to facility for review.");
  });

  test("activation remains a pure settings transformation with no operational callbacks", () => {
    const settings = seededSettings();
    const before = clone(settings);
    const result = activate(settings, selections[0].selection);
    expect(settings).toEqual(before);
    expect(result).not.toHaveProperty("candidate");
    expect(result).not.toHaveProperty("tracker");
    expect(result).not.toHaveProperty("history");
    expect(result).not.toHaveProperty("output");
    expect(result).not.toHaveProperty("send");
  });
});
