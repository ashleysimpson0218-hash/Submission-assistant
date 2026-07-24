import React from "react";

const metricStyle = {
  border: "1px solid #ded7f1",
  borderRadius: 8,
  padding: 12,
  background: "#fbfaff",
};

export function AcceptanceWorkspaceGate({ diagnostics, expectedCounts, loadError = "", verifying = false, onVerify }) {
  const counts = diagnostics?.counts || {};
  const fingerprint = diagnostics?.fingerprint || "";
  const ready = diagnostics?.status === "loaded" && !loadError;
  const browserPersistenceEnabled = diagnostics?.browserPersistenceEnabled ?? diagnostics?.autosaveEnabled;
  const metrics = [
    ["Candidates", counts.candidates],
    ["Facilities", counts.facilities],
    ["Requisitions", counts.requisitions],
    ["History", counts.history],
    ["Report History", counts.reportHistory],
    ["Hot Leads", counts.hotLeads],
    ["Intake Drafts", counts.intakeDrafts],
    ["Regional Contacts", counts.regionalContacts],
  ];

  return (
    <main style={{ minHeight: "calc(100vh - 40px)", display: "grid", placeItems: "center", padding: 24, background: "#f7f4ff", color: "#160a43", fontFamily: "Inter, Arial, sans-serif" }}>
      <section aria-labelledby="acceptance-workspace-title" style={{ width: "min(100%, 820px)", border: "1px solid #c4b5fd", borderRadius: 12, padding: 24, background: "#fff", boxShadow: "0 22px 55px rgba(76,29,149,0.14)" }}>
        <p style={{ margin: "0 0 6px", color: "#6d28d9", fontSize: 12, fontWeight: 950, letterSpacing: "0.08em" }}>ACCEPTANCE WORKSPACE SAFETY GATE</p>
        <h1 id="acceptance-workspace-title" style={{ margin: 0 }}>Verify Workspace</h1>
        <p style={{ color: "#635b7c", lineHeight: 1.55 }}>WelcomeFlow interactions remain locked until this cloud workspace matches the approved synthetic fixture.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, margin: "18px 0" }}>
          <div style={metricStyle}><small>Workspace</small><strong data-testid="acceptance-workspace-id" style={{ display: "block", overflowWrap: "anywhere" }}>{diagnostics?.workspaceId || "Loading..."}</strong></div>
          <div style={metricStyle}><small>Environment</small><strong style={{ display: "block" }}>{diagnostics?.environment || "test"}</strong></div>
          <div style={metricStyle}><small>Loaded From</small><strong style={{ display: "block" }}>{diagnostics?.source || "Waiting for cloud"}</strong></div>
          <div style={metricStyle}><small>Autosave</small><strong style={{ display: "block", color: "#b45309" }}>{diagnostics?.autosaveEnabled ? "Enabled" : "Disabled"}</strong></div>
          <div style={metricStyle}><small>Browser Persistence</small><strong style={{ display: "block", color: "#b45309" }}>{browserPersistenceEnabled ? "Enabled" : "Disabled"}</strong></div>
          <div style={metricStyle}><small>Interaction</small><strong style={{ display: "block", color: "#b45309" }}>Locked</strong></div>
          <div style={metricStyle}><small>Updated</small><strong style={{ display: "block" }}>{diagnostics?.updatedAt ? new Date(diagnostics.updatedAt).toLocaleString() : "Waiting..."}</strong></div>
          <div style={metricStyle}><small>Fingerprint</small><strong title={fingerprint} style={{ display: "block", fontFamily: "monospace" }}>{fingerprint ? `${fingerprint.slice(0, 12)}...` : "Calculating..."}</strong></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
          {metrics.map(([label, value]) => (
            <div key={label} style={metricStyle}>
              <small>{label}</small>
              <strong style={{ display: "block", fontSize: 20 }}>{value ?? "—"}</strong>
              {expectedCounts?.[label === "Report History" ? "reportHistory" : label.charAt(0).toLowerCase() + label.slice(1).replace(/\s+/g, "")] != null ? <span style={{ color: "#635b7c", fontSize: 11 }}>Expected {expectedCounts[label === "Report History" ? "reportHistory" : label.charAt(0).toLowerCase() + label.slice(1).replace(/\s+/g, "")]}</span> : null}
            </div>
          ))}
        </div>
        {loadError ? <p role="alert" style={{ padding: 12, border: "1px solid #fecaca", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontWeight: 800 }}>{loadError}</p> : null}
        {!loadError && !ready ? <p role="status" style={{ padding: 12, borderRadius: 8, background: "#fff7ed", color: "#9a3412" }}>Loading the explicitly requested cloud workspace. No fallback is permitted.</p> : null}
        <button type="button" disabled={!ready || verifying} onClick={onVerify} style={{ width: "100%", marginTop: 18, border: 0, borderRadius: 8, padding: "12px 16px", background: ready ? "#6d28d9" : "#ddd6fe", color: ready ? "#fff" : "#6b5f93", fontSize: 15, fontWeight: 900, cursor: ready ? "pointer" : "not-allowed" }}>
          {verifying ? "Verifying Workspace..." : "Verify Workspace"}
        </button>
      </section>
    </main>
  );
}
