// FINAL REFINED VERSION – WelcomeFlow
// Includes: Action Center, Templates (non-breaking), Tracker cleanup,
// Candidate Detail with Audit + History, Submission Date, Clean UI

import React, { useState } from "react";

const NL = "\n";

export default function App() {

  // =====================
  // CORE STATE
  // =====================

  const [activePage, setActivePage] = useState("submission");
  const [submissionDate, setSubmissionDate] = useState(new Date().toISOString().slice(0,10));

  const [tracker] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const [history, setHistory] = useState([]);

  const [templates, setTemplates] = useState({});

  // =====================
  // HELPERS
  // =====================

  const now = () => new Date().toLocaleString();

  function logEvent(type, subject, body, candidate) {
    setHistory(prev => [
      {
        id: Math.random(),
        type,
        subject,
        body,
        candidate,
        time: now()
      },
      ...prev
    ]);
  }

  function buildEmail(type, row) {

    // DEFAULT LOGIC (UNCHANGED STYLE)

    if (type === "manager") {
      return {
        subject: `Submission: ${row.name} | ${row.role}`,
        body: `Hello Team,${NL}${NL}Please review ${row.name}.`
      };
    }

    if (type === "followup") {
      return {
        subject: `Follow-Up: ${row.name}`,
        body: `Following up on ${row.name}.`
      };
    }

    return { subject: "", body: "" };
  }

  // =====================
  // ACTION CENTER FILTERS
  // =====================

  const followUps = tracker.filter(x => x.status === "Follow-Up Due");

  // =====================
  // UI
  // =====================

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>

      {/* NAV */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={() => setActivePage("submission")}>Submission</button>
        <button onClick={() => setActivePage("tracker")}>Tracker</button>
        <button onClick={() => setActivePage("action")}>Action Center</button>
        <button onClick={() => setActivePage("templates")}>Templates</button>
      </div>

      {/* ===================== */}
      {/* SUBMISSION */}
      {/* ===================== */}

      {activePage === "submission" && (
        <div>
          <h2>Submission</h2>

          <label>Submission Date</label>
          <input
            type="date"
            value={submissionDate}
            onChange={e => setSubmissionDate(e.target.value)}
          />

        </div>
      )}

      {/* ===================== */}
      {/* TRACKER */}
      {/* ===================== */}

      {activePage === "tracker" && (
        <div>
          <h2>Submission Tracker</h2>

          {tracker.map(row => (
            <div key={row.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>

              <strong>{row.name}</strong>

              <div>{row.role}</div>

              <select
                value={row.owner || "Recruiter"}
                onChange={e => row.owner = e.target.value}
              >
                <option>Recruiter</option>
                <option>Hiring Manager</option>
                <option>Candidate</option>
              </select>

              <select
                value={row.nextAction || ""}
                onChange={e => row.nextAction = e.target.value}
              >
                <option>Follow up with facility</option>
                <option>Follow up with candidate</option>
                <option>Request feedback</option>
                <option>Schedule interview</option>
                <option>No action needed</option>
              </select>

              <select>
                <option>Actions</option>
                <option onClick={() => {
                  setSelectedCandidate(row);
                  setActivePage("detail");
                }}>Review Details</option>
                <option onClick={() => {
                  const email = buildEmail("manager", row);
                  logEvent("ATS", email.subject, email.body, row.name);
                }}>ATS Update</option>
              </select>

              <div>Aging: {row.age}</div>
              <div>Risk: {row.risk}</div>

            </div>
          ))}
        </div>
      )}

      {/* ===================== */}
      {/* ACTION CENTER */}
      {/* ===================== */}

      {activePage === "action" && (
        <div>
          <h2>Follow-Ups</h2>

          {followUps.map(row => (
            <div key={row.id}>
              {row.name}
              <button onClick={() => {
                const email = buildEmail("followup", row);
                logEvent("Follow-Up", email.subject, email.body, row.name);
              }}>
                Send Follow-Up
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ===================== */}
      {/* DETAIL VIEW */}
      {/* ===================== */}

      {activePage === "detail" && selectedCandidate && (
        <div>
          <h2>{selectedCandidate.name}</h2>

          <h3>Audit Timeline</h3>
          {history
            .filter(h => h.candidate === selectedCandidate.name)
            .map(h => (
              <div key={h.id}>{h.time} - {h.type}</div>
            ))}

          <details>
            <summary>ATS Updates</summary>
            {history
              .filter(h => h.type === "ATS" && h.candidate === selectedCandidate.name)
              .map(h => (
                <div key={h.id}>
                  {h.time}
                  <button onClick={() => navigator.clipboard.writeText(h.body)}>Copy</button>
                </div>
              ))}
          </details>

          <details>
            <summary>Email History</summary>
            {history
              .filter(h => h.candidate === selectedCandidate.name)
              .map(h => (
                <div key={h.id}>
                  {h.subject}
                </div>
              ))}
          </details>

        </div>
      )}

      {/* ===================== */}
      {/* TEMPLATES */}
      {/* ===================== */}

      {activePage === "templates" && (
        <div>
          <h2>Templates</h2>

          <details>
            <summary>Manager Email</summary>
            <textarea
              value={templates.manager || ""}
              onChange={e => setTemplates(prev => ({ ...prev, manager: e.target.value }))}
            />
          </details>

          <details>
            <summary>Follow-Up Email</summary>
            <textarea
              value={templates.followup || ""}
              onChange={e => setTemplates(prev => ({ ...prev, followup: e.target.value }))}
            />
          </details>

        </div>
      )}

    </div>
  );
}
