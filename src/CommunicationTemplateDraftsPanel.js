import React, { useEffect, useMemo, useState } from "react";
import { assertTestRuntime } from "./requisitionCommunicationDetails";
import {
  CANONICAL_DRAFT_TOKENS,
  DRAFT_TEMPLATE_SPECS,
  createInitialDraft,
  createInitialTextDraft,
  createDraftEditBaseline,
  draftCoverage,
  draftVariantFor,
  saveCommunicationDraftSafely,
  templateCoverageWarnings,
  validateDraftTemplate,
} from "./communicationTemplateDrafts";

const OPTIONS = [
  ["facility:External", "External Facility Submission"],
  ["facility:Internal", "Internal Facility Submission"],
  ["facility:Rehire", "Rehire Review Section"],
  ["candidate:External", "External Candidate Confirmation"],
  ["candidate:Internal", "Internal Candidate Confirmation"],
  ["candidate:Rehire", "Rehire Candidate Confirmation"],
  ["text:External", "External Candidate Follow-Up Text"],
  ["text:Internal", "Internal Candidate Follow-Up Text"],
  ["text:Rehire", "Rehire Candidate Follow-Up Text"],
  ["ats:Standard", "Standard ATS Submission Update"],
];

const box = { border: "1px solid #dbe3ee", borderRadius: 10, padding: 14, background: "#fff" };
const labelStyle = { display: "grid", gap: 6, fontSize: 12, fontWeight: 800, color: "#334155" };
const inputStyle = { width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1", borderRadius: 7, padding: "9px 10px", font: "inherit" };
const buttonStyle = { border: "1px solid #94a3b8", borderRadius: 7, padding: "8px 11px", background: "#fff", color: "#0f172a", fontWeight: 800, cursor: "pointer" };

function storedDraft(settings, selected) {
  const [kind, candidateType] = selected.split(":");
  if (kind === "text") return settings.communicationTemplateDrafts?.textTemplates?.[candidateType] || null;
  const spec = DRAFT_TEMPLATE_SPECS[selected];
  return draftVariantFor(settings, spec.templateKey, candidateType);
}

function initialDraft(settings, selected) {
  const [, candidateType] = selected.split(":");
  return storedDraft(settings, selected) || (selected.startsWith("text:") ? createInitialTextDraft(candidateType) : createInitialDraft(selected));
}

function rootRecord(settings, selected) {
  if (selected.startsWith("text:")) return settings.textTemplates || [];
  const spec = DRAFT_TEMPLATE_SPECS[selected];
  const { draftVariants, ...root } = settings.templates?.[spec.templateKey] || {};
  return root;
}

export default function CommunicationTemplateDraftsPanel({ settings = {}, setSettings = () => {}, runtime = {}, onSaveDraft = null, onRefreshDraft = null }) {
  const [selected, setSelected] = useState("facility:External");
  const [draft, setDraft] = useState(() => initialDraft(settings, "facility:External"));
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [compare, setCompare] = useState("");
  const [reviewSave, setReviewSave] = useState(false);
  const [baseline, setBaseline] = useState(() => createDraftEditBaseline(settings, { kind: "facility", templateKey: "hiringManager", candidateType: "External" }));
  const coverage = useMemo(() => draftCoverage(settings), [settings]);
  const warnings = useMemo(() => templateCoverageWarnings(settings), [settings]);
  const [kind, candidateType] = selected.split(":");
  const spec = DRAFT_TEMPLATE_SPECS[selected];
  const templateKey = kind === "text" ? "candidateText" : spec.templateKey;
  const saved = storedDraft(settings, selected);
  const guard = assertTestRuntime(runtime);

  function refreshFrom(nextSettings = settings, message = "Draft refreshed from the latest Test settings.") {
    const nextSpec = DRAFT_TEMPLATE_SPECS[selected];
    const selection = { kind, templateKey: kind === "text" ? "candidateText" : nextSpec.templateKey, candidateType };
    setDraft(initialDraft(nextSettings, selected));
    setBaseline(createDraftEditBaseline(nextSettings, selection));
    setResult(null);
    setNotice(message);
    setCompare("");
    setReviewSave(false);
  }

  useEffect(() => {
    refreshFrom(settings, "");
    // Selecting another draft intentionally starts a new edit baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  async function refreshDraft() {
    if (!guard.ok) { setNotice(guard.error); return; }
    if (!onRefreshDraft) { refreshFrom(settings); return; }
    const refreshed = await onRefreshDraft();
    if (!refreshed?.ok) { setNotice(refreshed?.error || "WelcomeFlow could not refresh this draft."); return; }
    refreshFrom(refreshed.settings);
  }

  function validate(nextDraft = draft) {
    const validation = validateDraftTemplate(nextDraft, { candidateType, templateKey, settings });
    setResult(validation);
    return validation;
  }

  async function save(status = "Draft", draftOverride = draft) {
    if (!guard.ok) { setNotice(guard.error); return; }
    const candidate = { ...draftOverride, status };
    const validation = validate(candidate);
    if (status === "Needs Review" && !validation.valid) { setNotice("Blocked drafts cannot be marked Needs Review."); return; }
    const operation = { kind, templateKey, candidateType, draft: candidate, status };
    const savedResult = onSaveDraft
      ? await onSaveDraft({ baseline, operation })
      : saveCommunicationDraftSafely({ latestSettings: settings, baseline, ...operation });
    if (!savedResult?.ok) { setReviewSave(false); setNotice(savedResult?.error || "WelcomeFlow could not save this draft."); return; }
    if (!onSaveDraft) setSettings(savedResult.settings);
    setDraft(savedResult.draft);
    setBaseline(createDraftEditBaseline(savedResult.settings, { kind, templateKey, candidateType }));
    setReviewSave(false);
    setNotice(`${candidateType} ${kind === "text" ? "text" : spec.communicationType} saved as ${savedResult.draft.status}. No template was activated.`);
  }

  async function restore(version) {
    if (!guard.ok) { setNotice(guard.error); return; }
    if (kind === "text") { setNotice("Select and edit a prior text version to restore it as a new Draft."); return; }
    const selectedVersion = (saved?.history || []).find((item) => Number(item.version) === Number(version));
    if (!selectedVersion) { setNotice("Previous version not found."); return; }
    await save("Draft", { ...selectedVersion, status: "Draft" });
  }

  const unsupported = result?.unsupportedTokens || [];
  const previous = saved?.history?.[saved.history.length - 1];
  const title = OPTIONS.find(([key]) => key === selected)?.[1] || selected;

  return <section aria-label="Candidate-Type Communication Drafts" style={{ display: "grid", gap: 14 }}>
    <div>
      <div style={{ fontSize: 19, fontWeight: 950, color: "#0f172a" }}>Candidate-Type Communication Drafts</div>
      <div style={{ color: "#64748b", fontSize: 13 }}>Draft and validate synthetic communication language. Drafts are never active and cannot send, copy, or mark a candidate ready.</div>
      <div style={{ marginTop: 8, color: guard.ok ? "#166534" : "#b91c1c", fontSize: 12, fontWeight: 900 }}>
        Environment: {guard.environment || "missing"} · Project: {guard.projectRef || "missing"} · {guard.ok ? "WelcomeFlow Test verified" : guard.error}
      </div>
    </div>

    <div style={{ ...box, overflowX: "auto" }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Template Coverage</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr><th style={{ textAlign: "left" }}>Communication</th><th>External</th><th>Internal</th><th>Rehire</th></tr></thead><tbody>
        <tr><td>Facility Submission</td>{["External", "Internal", "Rehire"].map((type) => <td key={type} style={{ textAlign: "center", padding: 6 }}>{coverage.facility[type]}</td>)}</tr>
        <tr><td>Candidate Confirmation</td>{["External", "Internal", "Rehire"].map((type) => <td key={type} style={{ textAlign: "center", padding: 6 }}>{coverage.candidate[type]}</td>)}</tr>
        <tr><td>Candidate Follow-Up Text</td>{["External", "Internal", "Rehire"].map((type) => <td key={type} style={{ textAlign: "center", padding: 6 }}>{coverage.text[type]}</td>)}</tr>
        <tr><td>ATS Submission Update</td><td style={{ textAlign: "center", padding: 6 }}>{coverage.ats.Standard}</td><td colSpan="2" style={{ textAlign: "center" }}>Standard safe draft</td></tr>
      </tbody></table>
      {warnings.map((warning) => <div key={warning} style={{ color: "#92400e", marginTop: 6, fontSize: 12 }}>⚠ {warning}</div>)}
    </div>

    <div style={box}>
      <label style={labelStyle}>Draft to review<select aria-label="Draft to review" value={selected} onChange={(event) => setSelected(event.target.value)} style={inputStyle}>{OPTIONS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    </div>

    <div style={{ ...box, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><div><div style={{ fontWeight: 950 }}>{title}</div><div style={{ fontSize: 12, color: "#64748b" }}>Communication type: {draft.communicationType || title} · Candidate type: {candidateType}</div></div><span style={{ background: "#fef3c7", color: "#92400e", borderRadius: 999, padding: "5px 9px", height: "fit-content", fontSize: 11, fontWeight: 950 }}>{draft.status || "Draft"}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 9, fontSize: 12 }}>
        <div><b>Version</b><br />{draft.version || 1}</div><div><b>Base template hash</b><br />{draft.baseHash || "Assigned on first save"}</div><div><b>Created at</b><br />{draft.createdAt || "Not saved"}</div><div><b>Updated at</b><br />{draft.updatedAt || "Not saved"}</div>
      </div>
      {kind !== "text" && candidateType !== "Rehire" ? <label style={labelStyle}>Subject<input aria-label="Draft subject" value={draft.subject || ""} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} style={inputStyle} /></label> : null}
      {candidateType === "Rehire" && kind === "facility" ? <label style={labelStyle}>Rehire conditional section<textarea aria-label="Conditional blocks" value={draft.conditionalBlocks?.rehireSection || ""} onChange={(event) => setDraft({ ...draft, conditionalBlocks: { ...(draft.conditionalBlocks || {}), rehireSection: event.target.value } })} rows="7" style={inputStyle} /></label> : <label style={labelStyle}>Body<textarea aria-label="Draft body" value={draft.body || ""} onChange={(event) => setDraft({ ...draft, body: event.target.value })} rows="16" style={inputStyle} /></label>}
      <div style={{ fontSize: 12 }}><b>Conditional blocks:</b> {Object.keys(draft.conditionalBlocks || {}).join(", ") || "None"}</div>
      <details><summary style={{ cursor: "pointer", fontWeight: 800 }}>Available tokens</summary><div style={{ marginTop: 7, fontFamily: "monospace", fontSize: 11, wordBreak: "break-word" }}>{CANONICAL_DRAFT_TOKENS.map((token) => `{${token}}`).join(" · ")}</div></details>
      <div style={{ color: unsupported.length ? "#b91c1c" : "#166534", fontSize: 12, fontWeight: 800 }}>Unsupported tokens: {unsupported.length ? unsupported.join(", ") : "None detected"}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={buttonStyle} onClick={() => setCompare(JSON.stringify(rootRecord(settings, selected), null, 2))}>Compare to Current Root</button>
        <button type="button" style={buttonStyle} disabled={!previous} onClick={() => setCompare(previous ? JSON.stringify(previous, null, 2) : "No previous version")}>Compare to Previous Version</button>
        <button type="button" style={buttonStyle} disabled={!previous || kind === "text"} onClick={() => previous && restore(previous.version)}>Restore as New Draft</button>
        <button type="button" style={buttonStyle} onClick={() => validate()}>Validate Draft</button>
        <button type="button" style={buttonStyle} onClick={() => validate()}>Preview With Synthetic Scenario</button>
        <button type="button" style={buttonStyle} onClick={refreshDraft}>Refresh Draft</button>
        <button type="button" style={buttonStyle} onClick={() => setReviewSave(true)}>Save Draft</button>
        <button type="button" style={buttonStyle} onClick={() => save("Needs Review")}>Mark Needs Review</button>
      </div>
      {reviewSave ? <div aria-label="Exact draft save review" style={{ border: "2px solid #2563eb", borderRadius: 8, padding: 12, background: "#eff6ff" }}><b>Exact draft record to be added or changed</b><pre style={{ whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto", fontSize: 11 }}>{JSON.stringify({ ...draft, status: "Draft" }, null, 2)}</pre><div style={{ display: "flex", gap: 8 }}><button type="button" style={{ ...buttonStyle, background: "#1d4ed8", color: "#fff" }} onClick={() => save("Draft")}>Save Draft</button><button type="button" style={buttonStyle} onClick={() => setReviewSave(false)}>Cancel</button></div></div> : null}
      {notice ? <div role="status" style={{ color: notice.includes("saved") || notice.includes("restored") ? "#166534" : "#b91c1c", fontSize: 12, fontWeight: 800 }}>{notice}</div> : null}
      {compare ? <pre aria-label="Template comparison" style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto", background: "#f8fafc", padding: 10, fontSize: 11 }}>{compare}</pre> : null}
      {result ? <div aria-label="Draft Preview" style={{ border: `2px solid ${result.valid ? "#16a34a" : "#dc2626"}`, borderRadius: 9, padding: 12 }}><div style={{ fontWeight: 950 }}>{result.label}</div><div style={{ color: result.valid ? "#166534" : "#b91c1c", fontWeight: 800 }}>{result.valid ? "Validation passed. The draft remains non-operational." : "Blocked"}</div>{result.blockers.map((item) => <div key={item} style={{ color: "#b91c1c", fontSize: 12 }}>• {item}</div>)}<div style={{ marginTop: 10, fontSize: 12 }}><b>Subject</b><pre style={{ whiteSpace: "pre-wrap" }}>{result.rendered.subject}</pre><b>Body</b><pre style={{ whiteSpace: "pre-wrap" }}>{result.rendered.body}</pre></div></div> : null}
    </div>
  </section>;
}
