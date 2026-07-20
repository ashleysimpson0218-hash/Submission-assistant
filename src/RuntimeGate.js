import React from "react";

const shell = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "#f7f4ff",
  color: "#160a43",
  fontFamily: "Inter, Arial, sans-serif",
};

export function ConfigurationErrorPage({ message }) {
  return (
    <main style={shell}>
      <section role="alert" style={{ width: "min(100%, 640px)", padding: 32, border: "1px solid #ded3ff", borderRadius: 12, background: "#fff" }}>
        <h1 style={{ marginTop: 0 }}>WelcomeFlow configuration required</h1>
        <p style={{ marginBottom: 0, lineHeight: 1.6 }}>{message}</p>
      </section>
    </main>
  );
}

export function TestModeFrame({ children }) {
  return (
    <div data-testid="test-mode-frame">
      <div role="status" style={{ position: "sticky", top: 0, zIndex: 10000, padding: "9px 16px", background: "#facc15", color: "#3b2500", textAlign: "center", fontFamily: "Inter, Arial, sans-serif", fontSize: 13, fontWeight: 950, letterSpacing: "0.08em" }}>
        TEST MODE — SYNTHETIC DATA ONLY
      </div>
      {children}
    </div>
  );
}

export function OwnerUatFrame({ children }) {
  return (
    <div data-testid="owner-uat-frame">
      <div role="status" style={{ position: "sticky", top: 0, zIndex: 10000, padding: "10px 16px", background: "#7f1d1d", color: "#fff", textAlign: "center", fontFamily: "Inter, Arial, sans-serif", fontSize: 13, fontWeight: 950, letterSpacing: "0.04em", boxShadow: "0 4px 14px rgba(69,10,10,0.28)" }}>
        <div>OWNER UAT — REAL PRODUCTION DATA COPY — CONTROLLED WRITES</div>
        <div style={{ marginTop: 3, fontSize: 12, fontWeight: 800, letterSpacing: 0 }}>Do not contact candidates from this environment. Email, text, ATS, booking, and resume actions are disabled.</div>
      </div>
      {children}
    </div>
  );
}
