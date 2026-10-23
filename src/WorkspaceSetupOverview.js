import React from "react";
import { recruiterSetupSummary } from "./industryProfiles";
import "./recruiterExperience.css";

export function setupSectionDestination(section) {
  const positionTabs = { sites: "facilities", requisitions: "positions", compensation: "rates" };
  if (Object.prototype.hasOwnProperty.call(positionTabs, section)) return { page: "positions", tab: positionTabs[section] };
  const settingsTabs = ["general", "contacts", "roles", "workflow", "templates", "options", "intakeRules", "glossary"];
  return { page: "settings", tab: settingsTabs.includes(section) ? section : "general" };
}

export function WorkspaceSetupOverview({ settings, theme, saveStatus, onOpenSection }) {
  const { requiredSteps, optionalSteps, completedCount, totalCount, nextStep } = recruiterSetupSummary(settings);
  const optionalSettings = [
    ...optionalSteps,
    { id: "contacts", title: "Additional contacts", detail: "Add HR and other people involved in hiring.", target: "contacts" },
    { id: "rates", title: "Pay rates", detail: "Review rates, bonuses, and approval rules.", target: "compensation" },
    { id: "messages", title: "Message templates", detail: "Review the wording used for candidate and manager messages.", target: "templates" },
    { id: "choices", title: "Form choices", detail: "Adjust dropdown choices to match your team's language.", target: "options" },
    { id: "intake", title: "Intake rules", detail: "Choose which screening questions appear during intake.", target: "intakeRules" },
  ];
  const status = saveStatus || { label: "Save not confirmed", detail: "Check the workspace saving status before leaving this page." };

  return <div className="wf-experience" style={{ "--wf-panel": theme.panel, "--wf-soft": theme.panelAlt, "--wf-border": theme.border, "--wf-text": theme.text, "--wf-muted": theme.muted, "--wf-accent": theme.primary2 }}>
    <section className="wf-experience-card" aria-labelledby="workspace-basics-heading">
      <div className="wf-experience-header">
        <div><div className="wf-experience-eyebrow">Setup progress</div><h2 id="workspace-basics-heading">Start with the basics</h2></div>
        <span>{completedCount} of {totalCount} basics have information</span>
      </div>
      <progress value={completedCount} max={totalCount} aria-label="Workspace basics with information" style={{ width: "100%", height: 10, margin: "8px 0 20px" }} />
      <div style={{ background: theme.panelAlt, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 18, marginBottom: 20 }}>
        <div className="wf-experience-eyebrow">{nextStep ? "Next step" : "Basic information is present"}</div>
        <h3>{nextStep ? nextStep.title : "Review your job openings"}</h3>
        <p>{nextStep ? nextStep.detail : "Check the details for each job. Account access and communication settings still need their own checks."}</p>
        <button type="button" className="wf-experience-primary" onClick={() => onOpenSection(nextStep?.target || "requisitions")}>{nextStep?.actionLabel || "Review job openings"}</button>
      </div>
      <ol className="wf-setup-list" aria-label="Workspace basics">
        {requiredSteps.map((step, index) => <li key={step.id} aria-current={nextStep?.id === step.id ? "step" : undefined}>
          <div><strong>{index + 1}. {step.title}</strong><span className="wf-experience-status">{step.done ? "Information present" : "Information needed"}</span><p>{step.detail}</p></div>
          <button type="button" aria-label={`Open ${step.title.toLowerCase()}`} onClick={() => onOpenSection(step.target)}>Open</button>
        </li>)}
      </ol>
      <details>
        <summary>Optional settings</summary>
        <p>Adjust these when your team needs them. They do not change the basics count.</p>
        <ul className="wf-setup-list">
          {optionalSettings.map((step) => <li key={step.id}><div><strong>{step.title}</strong><p>{step.detail}</p></div><button type="button" aria-label={`Open ${step.title.toLowerCase()}`} onClick={() => onOpenSection(step.target)}>Open</button></li>)}
        </ul>
      </details>
      <p className="wf-experience-note">The count checks for information already entered. Review the details for your team before using them.</p>
    </section>
    <section className="wf-experience-card" aria-label="Workspace saving">
      <strong>Latest saving status: {status.label}</strong>
      <p style={{ marginBottom: 0 }}>{status.detail}</p>
    </section>
  </div>;
}
