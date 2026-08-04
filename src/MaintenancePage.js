import React from "react";

export function isMaintenanceModeEnabled(runtime = {}, env = process.env) {
  if (runtime.environment === "production") return true;
  return String(env.REACT_APP_MAINTENANCE_MODE || "").trim().toLowerCase() === "true";
}

export default function MaintenancePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f7f4ff",
        color: "#160a43",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <section
        aria-labelledby="maintenance-title"
        style={{
          width: "min(100%, 640px)",
          padding: "40px 32px",
          border: "1px solid #ded3ff",
          borderRadius: 16,
          background: "#ffffff",
          boxShadow: "0 24px 64px rgba(42, 24, 98, 0.14)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 20px",
            borderRadius: 16,
            background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
          }}
        />
        <h1 id="maintenance-title" style={{ margin: "0 0 16px", fontSize: 30, lineHeight: 1.2 }}>
          WelcomeFlow is currently in private development.
        </h1>
        <p style={{ margin: 0, color: "#6b5f93", fontSize: 17, lineHeight: 1.65 }}>
          Access is temporarily unavailable while security and testing updates are completed.
        </p>
      </section>
    </main>
  );
}
