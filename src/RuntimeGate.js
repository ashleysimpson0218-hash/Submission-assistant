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
