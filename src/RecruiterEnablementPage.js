import React, { useState } from "react";
import { INDUSTRY_PROFILES, industryProfile, recruiterSetupSteps } from "./industryProfiles";
import "./recruiterExperience.css";

const LESSONS = [
  { id: "daily", title: "Run your recruiting day", minutes: 2, target: "home", action: "Open my work", steps: ["Start with Needs Action. Review the highest-priority record and its next owner.", "Check Today & Scheduled before starting outreach.", "Use Recruiting Needed to focus on openings that need more candidates. Wrap Up My Day helps you leave a clear handoff."], example: "A manager has not responded. Review the exact candidate and opening, prepare a follow-up, then log what actually happened." },
  { id: "intake", title: "Capture a candidate once", minutes: 3, target: "submission", action: "Open candidate intake", steps: ["Select the exact opening, then capture candidate contact details and source.", "Review imported information and answer the role's screening questions. Save a draft when something is missing.", "Resolve the missing items in Submission Readiness before reviewing a submission package."], example: "For a driver: capture route preference and home-time expectations alongside the CDL information to verify. These answers belong with the candidate, not on a second spreadsheet." },
  { id: "communication", title: "Keep candidates and managers informed", minutes: 3, target: "home", action: "Review follow-ups", steps: ["Open a communication from the candidate's current work item.", "Check the recipient, opening, message, and timing before using the draft.", "Log the actual outcome. Drafted, copied, and sent mean different things. Keep the next action and owner current."], example: "Waiting on a manager? Prepare the manager follow-up and a factual candidate update. Do not promise a decision date you have not confirmed." },
  { id: "leadership", title: "Report to leadership without rebuilding the story", minutes: 3, target: "reports", action: "Open weekly reporting", steps: ["Choose the reporting period and review readiness issues.", "Fix missing opening details or contacts in the linked record. Return to the same report.", "Select the appropriate audience, review the report, and use the available export or communication action. Find saved reports in Reports & History."], example: "Give leadership the movement, the blockers, who owns the next step, and the decision needed. Use the report's current data rather than manually recounting candidates." },
  { id: "handoff", title: "Make the next step obvious", minutes: 2, target: "workspace", action: "Open candidate profiles", steps: ["Use Candidate Update to record the real stage and outcome.", "Add a short note explaining the next action, owner, and timing.", "Review Handoff Awareness for work waiting on managers, candidates, or onboarding teams."], example: "A driver accepts an offer. Record acceptance and the pending verification owner. Acceptance alone does not mean cleared or started." },
];

const HELP = [
  ["Why is a candidate missing from a report?", "Check the reporting period, audience, active opening, and readiness issues. Open the candidate from the report context to correct the source record.", "reports"],
  ["Why can't I send or copy a message?", "The available action depends on this environment, permissions, and the exact candidate context. A template or draft does not prove that email or SMS delivery is enabled.", "connections"],
  ["Where do I change follow-up timing?", "Open Settings → Follow-Up Rules. Set the candidate and manager timing your team actually uses.", "workflow"],
  ["How do I use this for another industry?", "Choose an industry below to add role starters. Review each role's requirements, add real locations and openings, then review your message templates. Existing records stay intact.", "industry"],
  ["Is this connected to my ATS?", "ATS notes are prepared for manual review and copy/paste. A copied note is not an ATS update. Direct Paycom integration remains deferred.", "connections"],
];

export function RecruiterIndustrySetupCard({ settings, theme, onApplyIndustry }) {
  const [choice, setChoice] = useState(settings.recruiterExperience?.industryId || "");
  const [applied, setApplied] = useState(false);
  return <section className="wf-experience wf-experience-card" style={{ "--wf-panel": theme.panel, "--wf-soft": theme.panelAlt, "--wf-border": theme.border, "--wf-text": theme.text, "--wf-muted": theme.muted, "--wf-accent": theme.primary2, marginBottom: 16 }} aria-labelledby="account-industry-heading">
    <div><div className="wf-experience-eyebrow">Recruiter account setup</div><h2 id="account-industry-heading">Which industry do you recruit for?</h2><p>Choose your workspace's starting point. Your daily workflow stays the same; role starters, screening prompts, and guidance adapt.</p></div>
    <form onSubmit={(event) => { event.preventDefault(); if (!choice) return; onApplyIndustry(choice); setApplied(true); }}>
      <label>Recruiting industry<select required value={choice} onChange={(event) => { setChoice(event.target.value); setApplied(false); }}><option value="">Choose your industry</option>{INDUSTRY_PROFILES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <button type="submit" className="wf-experience-primary" disabled={!choice}>Use this industry</button>
      {applied ? <p role="status">Industry applied to this workspace. Review role requirements and your message templates in setup.</p> : null}
    </form>
  </section>;
}

function PracticeExercise({ industry }) {
  const [stage, setStage] = useState(0);
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const role = industry.id === "trucking" ? "CDL Class A Driver" : industry.roles[0] || "Operations Associate";
  return <section className="wf-experience-card" aria-labelledby="practice-title">
    <div className="wf-experience-eyebrow">Practice workspace · fictional example</div>
    <h2 id="practice-title">Try a manager follow-up</h2>
    <p>Jordan Example · {role} · Sample opening 100. This exercise does not change candidate records or send messages.</p>
    <ol className="wf-practice-steps" aria-label="Practice steps">
      {["Review the blocker", "Review the draft", "Record the handoff"].map((title, index) => <li key={title} aria-current={stage === index ? "step" : undefined}>{index + 1}. {title}{stage > index ? " ✓" : ""}</li>)}
    </ol>
    {stage === 0 ? <><p><strong>Waiting on:</strong> the hiring manager's decision. The candidate has already interviewed.</p><label>What needs to happen next?<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Example: Ask the manager for a decision and the expected timing." rows={3} /></label><button className="wf-experience-primary" disabled={!note.trim()} onClick={() => setStage(1)}>Prepare practice draft</button></> : null}
    {stage === 1 ? <><div className="wf-practice-message"><strong>To: Sample Hiring Manager (practice only)</strong><p>Subject: Interview feedback | Jordan Example | {role}</p><p>Hello, please share your feedback and next step for Jordan Example following the interview for sample opening 100. Please also confirm when we can update the candidate.</p></div><label className="wf-experience-check"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />I checked the candidate, opening, recipient, and wording.</label><button className="wf-experience-primary" disabled={!reviewed} onClick={() => setStage(2)}>Record practice handoff</button></> : null}
    {stage === 2 ? <div role="status"><strong>Practice complete. The next step is clear.</strong><dl><dt>Next action</dt><dd>{note}</dd><dt>Waiting on</dt><dd>Hiring manager</dd><dt>Communication state</dt><dd>Draft reviewed. Nothing sent.</dd></dl><button onClick={() => { setStage(0); setNote(""); setReviewed(false); }}>Practice again</button></div> : null}
  </section>;
}

export function RecruiterEnablementPage({ settings, theme, saveStatus, onApplyIndustry, onNavigate, onOpenSettings, completedLessons, onCompleteLesson, section, onSectionChange }) {
  const current = industryProfile(settings);
  const [selectedId, setSelectedId] = useState(current.id);
  const [query, setQuery] = useState("");
  const [selectedLesson, setSelectedLesson] = useState(LESSONS[0].id);
  const [notice, setNotice] = useState("");
  const selected = INDUSTRY_PROFILES.find((profile) => profile.id === selectedId) || current;
  const setup = recruiterSetupSteps(settings);
  const lesson = LESSONS.find((item) => item.id === selectedLesson) || LESSONS[0];
  const completed = LESSONS.filter((item) => completedLessons.includes(item.id)).length;
  const filteredHelp = HELP.filter(([title, answer]) => `${title} ${answer}`.toLowerCase().includes(query.toLowerCase()));
  const navigateHelp = (target) => {
    if (["industry", "connections"].includes(target)) onSectionChange(target);
    else if (target === "workflow") onOpenSettings("workflow");
    else onNavigate(target);
  };
  return <div className="wf-experience" style={{ "--wf-panel": theme.panel, "--wf-soft": theme.panelAlt, "--wf-border": theme.border, "--wf-text": theme.text, "--wf-muted": theme.muted, "--wf-accent": theme.primary2 }}>
    <header className="wf-experience-header"><div><div className="wf-experience-eyebrow">WelcomeFlow recruiter support</div><h1>Learn & Setup</h1><p>Set up your team, practice the workflow, and get back to recruiting.</p></div><button onClick={() => onNavigate("home")}>Back to my work</button></header>
    <nav className="wf-experience-tabs" aria-label="Learning and setup sections">
      {[["learn", "Recruiter training"], ["industry", "Industry & setup"], ["connections", "Connections"], ["help", "Help"]].map(([id, title]) => <button key={id} aria-current={section === id ? "page" : undefined} onClick={() => onSectionChange(id)}>{title}</button>)}
    </nav>
    {section === "learn" ? <>
      <div className="wf-experience-progress"><span><strong>{completed} of {LESSONS.length} lessons reviewed</strong> · progress for this session</span><progress value={completed} max={LESSONS.length} aria-label="Lessons reviewed" /></div>
      <div className="wf-learning-layout"><aside className="wf-experience-card"><h2>Your first recruiting day</h2><nav aria-label="Training lessons">{LESSONS.map((item, index) => <button key={item.id} className="wf-lesson-link" aria-current={lesson.id === item.id ? "step" : undefined} onClick={() => setSelectedLesson(item.id)}><span>{completedLessons.includes(item.id) ? "✓" : index + 1}</span><span>{item.title}<small>{item.minutes} min read</small></span></button>)}</nav></aside>
        <article className="wf-experience-card"><div className="wf-experience-eyebrow">Lesson {LESSONS.indexOf(lesson) + 1}</div><h2>{lesson.title}</h2><ol className="wf-lesson-steps">{lesson.steps.map((step) => <li key={step}>{step}</li>)}</ol><div className="wf-experience-example"><strong>In practice</strong><p>{lesson.id === "intake" && current.id !== "trucking" ? "Capture relevant experience, availability, and role-specific answers in the candidate intake. The same information supports the hiring-manager summary and ATS notes." : lesson.example}</p></div><div className="wf-experience-actions"><button className="wf-experience-primary" onClick={() => { onCompleteLesson(lesson.id); const next = LESSONS[LESSONS.indexOf(lesson) + 1]; if (next) setSelectedLesson(next.id); }}>{completedLessons.includes(lesson.id) ? "Reviewed · continue" : "Mark reviewed & continue"}</button><button onClick={() => onNavigate(lesson.target)}>{lesson.action}</button></div></article>
      </div><PracticeExercise industry={current} />
    </> : null}
    {section === "industry" ? <div className="wf-learning-layout">
      <section className="wf-experience-card"><h2>Make it fit your recruiting</h2><p>Current profile: <strong>{current.name}</strong>. Profiles add role starters and relevant screening prompts. Review the requirements for each real opening.</p><label>Industry<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setNotice(""); }}>{INDUSTRY_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><p>{selected.description}</p><dl><dt>Location language</dt><dd>{selected.location}</dd><dt>Role starters</dt><dd>{selected.roles.join(", ") || "Use your existing roles or create your own."}</dd></dl>
        {selected.questions.length ? <details><summary>Preview {selected.questions.length} screening prompts</summary><ul>{selected.questions.map((item) => <li key={item.id}>{item.question}</li>)}</ul></details> : null}
        <p className="wf-experience-note">Existing candidates, openings, role rules, and messages are preserved. Choosing a profile does not verify credentials or connect an external service.</p>
        <button className="wf-experience-primary" onClick={() => { onApplyIndustry(selectedId); setNotice(`${selected.name} applied. Review Position Requirements and message templates before using the added roles.`); }}>Apply industry profile</button>{notice ? <p role="status">{notice}</p> : null}
      </section>
      <section className="wf-experience-card"><h2>Workspace setup</h2><p>{setup.filter((item) => item.done).length} of {setup.length} setup checks have information. Review the details before recruiting.</p><ol className="wf-setup-list">{setup.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span className="wf-experience-status">{item.done ? "Information present" : "Needs setup"}</span><p>{item.detail}</p></div><button onClick={() => onOpenSettings(item.target)}>{item.done ? "Review" : "Set up"}</button></li>)}</ol><button onClick={() => onOpenSettings("templates")}>Review email & text templates</button></section>
    </div> : null}
    {section === "connections" ? <>
      <section className="wf-experience-card"><h2>Know what is connected</h2><p>These statuses describe what WelcomeFlow can confirm in this session. A saved link or message template is not a verified service connection.</p><div className="wf-connection-grid">
        {[
          { title: "Workspace saving", status: saveStatus.label, detail: saveStatus.detail, target: "general" },
          { title: "Email & text", status: "Review drafts and available actions", detail: "Use the candidate workflow to preview exact messages. Delivery depends on authorized actions in this environment; no delivery connection has been verified here.", target: "templates" },
          { title: "Calendar & scheduling", status: settings.general?.defaultBookingLink ? "Booking link configured" : "Internal calendar available", detail: "Use the internal calendar for recruiter activity. An external booking link does not establish two-way calendar synchronization.", target: "calendar" },
          { title: "ATS / Paycom", status: "Manual handoff", detail: "Review generated notes, copy them into your ATS, then log completion. Direct ATS integration is deferred.", target: "workspace" },
          { title: "Leadership reporting", status: "Review & export", detail: "Reports use the shared candidate and opening data. Review readiness and audience before using export or communication actions.", target: "reports" },
          { title: "Candidate application", status: settings.general?.defaultApplicationLink ? "Application link configured" : "Application link not configured", detail: "An application link points candidates to the right destination. It does not import application updates automatically.", target: "general" },
        ].map((item) => <article key={item.title}><h3>{item.title}</h3><strong className="wf-experience-status">{item.status}</strong><p>{item.detail}</p><button onClick={() => ["calendar", "workspace", "reports"].includes(item.target) ? onNavigate(item.target) : onOpenSettings(item.target)}>Open {item.title.toLowerCase()}</button></article>)}
      </div></section>
    </> : null}
    {section === "help" ? <section className="wf-experience-card"><h2>Find the next step</h2><label>Search recruiter help<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try reports, follow-up, or ATS" /></label><div className="wf-help-results">{filteredHelp.map(([title, answer, target]) => <details key={title}><summary>{title}</summary><p>{answer}</p><button onClick={() => navigateHelp(target)}>Open related workspace</button></details>)}{!filteredHelp.length ? <p role="status">No matching guide. Try “candidate,” “report,” or “message.”</p> : null}</div><p className="wf-experience-note">Need a person to review an issue? Share the page name, action attempted, expected result, and error text with your workspace administrator. Keep candidate contact details out of screenshots unless your team approves sharing them.</p></section> : null}
  </div>;
}
