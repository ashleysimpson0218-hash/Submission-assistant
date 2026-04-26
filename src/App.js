import React, { useMemo, useState } from "react";

const NL = "\n";

function makeId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_TEMPLATES = {
  hiringManagerSubmission: {
    name: "Hiring Manager Submission Email",
    subject: "{{fullName}} | {{position}} | {{facility}}",
    body: [
      "Hello {{facilityLeadership}},",
      "",
      "Please review the candidate below.",
      "",
      "Submission Date: {{submissionDate}}",
      "Candidate: {{fullName}}",
      "Position: {{position}}",
      "Facility: {{facility}}",
      "Phone: {{phone}}",
      "Email: {{email}}",
      "",
      "Please advise next steps within 24–48 hours."
    ].join(NL)
  },
  atsUpdate: {
    name: "ATS Update Note",
    subject: "ATS Update | {{fullName}} | {{position}}",
    body: [
      "ATS Update",
      "",
      "Candidate: {{fullName}}",
      "Position: {{position}}",
      "Facility: {{facility}}",
      "Status: {{status}}",
      "Date: {{submissionDate}}"
    ].join(NL)
  },
  hiringManagerFollowUp: {
    name: "Hiring Manager Follow-Up Email",
    subject: "Follow-Up Needed | {{fullName}} | {{facility}}",
    body: [
      "Hello {{facilityLeadership}},",
      "",
      "I wanted to follow up on the candidate below.",
      "",
      "Candidate: {{fullName}}",
      "Position: {{position}}",
      "Facility: {{facility}}",
      "Submitted: {{submissionDate}}",
      "",
      "Please advise if you would like to move forward, decline, or request additional information."
    ].join(NL)
  },
  candidateFollowUp: {
    name: "Candidate Follow-Up Email",
    subject: "Following Up | {{position}} at {{facility}}",
    body: [
      "Hello {{firstName}},",
      "",
      "I wanted to follow up regarding the {{position}} position at {{facility}}.",
      "",
      "Please let me know if you are still interested and available to speak about next steps.",
      "",
      "Thank you,",
      "Ashley Martin-Simpson"
    ].join(NL)
  },
  interviewRequest: {
    name: "Interview Request Email",
    subject: "Interview Request | {{position}} at {{facility}}",
    body: [
      "Hello {{firstName}},",
      "",
      "The hiring team would like to move forward with an interview for the {{position}} position at {{facility}}.",
      "",
      "Please send over your best availability for the next 2 business days.",
      "",
      "Thank you,",
      "Ashley Martin-Simpson"
    ].join(NL)
  }
};

const initialForm = {
  fullName: "",
  position: "",
  facility: "",
  facilityLeadership: "Hiring Team",
  email: "",
  phone: "",
  status: "Submitted",
  submissionDate: today(),
  notes: ""
};

function getFirstName(fullName) {
  return (fullName || "there").trim().split(" ")[0] || "there";
}

function applyTemplate(templateText, data) {
  const safeData = {
    ...data,
    firstName: getFirstName(data.fullName)
  };

  return templateText.replace(/{{(.*?)}}/g, (_, key) => {
    const cleanKey = key.trim();
    return safeData[cleanKey] || "";
  });
}

function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard?.writeText(text);
}

export default function App() {
  const [activePage, setActivePage] = useState("submission");
  const [form, setForm] = useState(initialForm);
  const [tracker, setTracker] = useState([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("hiringManagerSubmission");
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [output, setOutput] = useState({ subject: "", body: "" });
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [expandedAuditId, setExpandedAuditId] = useState(null);

  const selectedTemplate = templates[selectedTemplateKey];

  const generatedPreview = useMemo(() => {
    if (!selectedTemplate) return { subject: "", body: "" };

    return {
      subject: applyTemplate(selectedTemplate.subject, form),
      body: applyTemplate(selectedTemplate.body, form)
    };
  }, [selectedTemplate, form]);

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function generateOutput() {
    setOutput(generatedPreview);
  }

  function addAuditEntry(type, details) {
    return {
      id: makeId("audit"),
      type,
      details,
      timestamp: new Date().toLocaleString()
    };
  }

  function submitToTracker() {
    const record = {
      id: makeId("sub"),
      ...form,
      audit: [
        addAuditEntry("Candidate Submitted", "Candidate was added to the submission tracker.")
      ],
      emailHistory: generatedPreview.body
        ? [
            {
              id: makeId("email"),
              template: selectedTemplate.name,
              subject: generatedPreview.subject,
              body: generatedPreview.body,
              timestamp: new Date().toLocaleString()
            }
          ]
        : []
    };

    setTracker(prev => [record, ...prev]);
    setOutput(generatedPreview);
  }

  function updateTrackerStatus(recordId, status) {
    setTracker(prev =>
      prev.map(record => {
        if (record.id !== recordId) return record;

        return {
          ...record,
          status,
          audit: [
            addAuditEntry("Status Updated", `Status changed to ${status}.`),
            ...(record.audit || [])
          ]
        };
      })
    );
  }

  function saveTemplate(key, field, value) {
    setTemplates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  }

  function openEmail(subject = output.subject, body = output.body) {
    const mailto = `mailto:?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
    window.location.href = mailto;
  }

  const pageButton = page => ({
    padding: "10px 14px",
    borderRadius: 10,
    border: activePage === page ? "2px solid #111827" : "1px solid #d1d5db",
    background: activePage === page ? "#111827" : "#ffffff",
    color: activePage === page ? "#ffffff" : "#111827",
    cursor: "pointer",
    fontWeight: 700
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#111827", fontFamily: "Arial, sans-serif" }}>
      <header style={{ padding: 24, background: "#111827", color: "white" }}>
        <h1 style={{ margin: 0 }}>WelcomeFlow</h1>
        <p style={{ margin: "8px 0 0" }}>Clean recruiting workflow build</p>
      </header>

      <main style={{ padding: 24, maxWidth: 1180, margin: "0 auto" }}>
        <nav style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
          <button style={pageButton("submission")} onClick={() => setActivePage("submission")}>Submission</button>
          <button style={pageButton("tracker")} onClick={() => setActivePage("tracker")}>Tracker</button>
          <button style={pageButton("actionCenter")} onClick={() => setActivePage("actionCenter")}>Action Center</button>
          <button style={pageButton("templates")} onClick={() => setActivePage("templates")}>Settings → Templates</button>
        </nav>

        {activePage === "submission" && (
          <section style={{ display: "grid", gridTemplateColumns: "minmax(280px, 430px) 1fr", gap: 24 }}>
            <div style={cardStyle}>
              <h2 style={sectionTitle}>Candidate Submission</h2>

              <FormInput label="Full Name" value={form.fullName} onChange={value => updateForm("fullName", value)} />
              <FormInput label="Position" value={form.position} onChange={value => updateForm("position", value)} />
              <FormInput label="Facility" value={form.facility} onChange={value => updateForm("facility", value)} />
              <FormInput label="Facility Leadership" value={form.facilityLeadership} onChange={value => updateForm("facilityLeadership", value)} />
              <FormInput label="Email" value={form.email} onChange={value => updateForm("email", value)} />
              <FormInput label="Phone" value={form.phone} onChange={value => updateForm("phone", value)} />
              <FormInput label="Submission Date" type="date" value={form.submissionDate} onChange={value => updateForm("submissionDate", value)} />

              <label style={labelStyle}>Template</label>
              <select value={selectedTemplateKey} onChange={e => setSelectedTemplateKey(e.target.value)} style={inputStyle}>
                {Object.entries(templates).map(([key, template]) => (
                  <option key={key} value={key}>{template.name}</option>
                ))}
              </select>

              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => updateForm("notes", e.target.value)} style={{ ...inputStyle, minHeight: 90 }} />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <button style={primaryButton} onClick={generateOutput}>Generate</button>
                <button style={secondaryButton} onClick={submitToTracker}>Add to Tracker</button>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitle}>Email Preview</h2>
              <p style={{ fontWeight: 700 }}>Subject</p>
              <div style={previewBox}>{output.subject || generatedPreview.subject || "Generate an email to preview subject."}</div>

              <p style={{ fontWeight: 700 }}>Body</p>
              <pre style={{ ...previewBox, whiteSpace: "pre-wrap", minHeight: 260 }}>
                {output.body || generatedPreview.body || "Generate an email to preview body."}
              </pre>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={primaryButton} onClick={() => openEmail(output.subject || generatedPreview.subject, output.body || generatedPreview.body)}>Open Email</button>
                <button style={secondaryButton} onClick={() => copyToClipboard(output.body || generatedPreview.body)}>Copy Body</button>
              </div>
            </div>
          </section>
        )}

        {activePage === "tracker" && (
          <section style={cardStyle}>
            <h2 style={sectionTitle}>Submission Tracker</h2>

            {tracker.length === 0 ? (
              <p>No submissions yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {tracker.map(record => (
                  <div key={record.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{record.fullName || "Unnamed Candidate"}</h3>
                        <p style={{ margin: "6px 0" }}>{record.position} | {record.facility}</p>
                        <p style={{ margin: 0, color: "#4b5563" }}>{record.submissionDate} | {record.status}</p>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <select value={record.status} onChange={e => updateTrackerStatus(record.id, e.target.value)} style={inputStyle}>
                          <option>Submitted</option>
                          <option>Hiring Manager Review</option>
                          <option>Interview Requested</option>
                          <option>Interview Scheduled</option>
                          <option>Offer Pending</option>
                          <option>Hired</option>
                          <option>Closed</option>
                          <option>Not Selected</option>
                        </select>
                        <button style={secondaryButton} onClick={() => setExpandedAuditId(expandedAuditId === record.id ? null : record.id)}>
                          Review Details
                        </button>
                      </div>
                    </div>

                    {expandedAuditId === record.id && (
                      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                        <div style={softPanel}>
                          <h4 style={{ marginTop: 0 }}>Audit History</h4>
                          {(record.audit || []).map(item => (
                            <div key={item.id} style={{ borderTop: "1px solid #e5e7eb", paddingTop: 8, marginTop: 8 }}>
                              <strong>{item.type}</strong>
                              <p style={{ margin: "4px 0" }}>{item.details}</p>
                              <small>{item.timestamp}</small>
                            </div>
                          ))}
                        </div>

                        <div style={softPanel}>
                          <h4 style={{ marginTop: 0 }}>Email History</h4>
                          {(record.emailHistory || []).length === 0 ? (
                            <p>No email history yet.</p>
                          ) : (
                            record.emailHistory.map(email => (
                              <details key={email.id} style={{ marginBottom: 10 }}>
                                <summary style={{ cursor: "pointer", fontWeight: 700 }}>{email.template} | {email.timestamp}</summary>
                                <p><strong>Subject:</strong> {email.subject}</p>
                                <pre style={{ ...previewBox, whiteSpace: "pre-wrap" }}>{email.body}</pre>
                                <button style={secondaryButton} onClick={() => openEmail(email.subject, email.body)}>Open Again</button>
                              </details>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activePage === "actionCenter" && (
          <section style={cardStyle}>
            <h2 style={sectionTitle}>Action Center</h2>
            <p style={{ color: "#4b5563" }}>
              Quick actions for candidates who need movement, follow-up, or review.
            </p>

            {tracker.length === 0 ? (
              <p>No candidates in the action center yet. Add a candidate from the Submission page first.</p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {tracker.map(record => {
                  const needsAction = ["Submitted", "Hiring Manager Review", "Interview Requested"].includes(record.status);
                  return (
                    <div key={record.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: needsAction ? "#fff7ed" : "#ffffff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                          <h3 style={{ margin: 0 }}>{record.fullName || "Unnamed Candidate"}</h3>
                          <p style={{ margin: "6px 0" }}>{record.position} | {record.facility}</p>
                          <p style={{ margin: 0, color: "#4b5563" }}>Current Status: {record.status}</p>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <button
                            style={primaryButton}
                            onClick={() => {
                              const subject = applyTemplate(templates.hiringManagerFollowUp.subject, record);
                              const body = applyTemplate(templates.hiringManagerFollowUp.body, record);
                              openEmail(subject, body);
                            }}
                          >
                            HM Follow-Up
                          </button>

                          <button
                            style={secondaryButton}
                            onClick={() => {
                              const subject = applyTemplate(templates.candidateFollowUp.subject, record);
                              const body = applyTemplate(templates.candidateFollowUp.body, record);
                              openEmail(subject, body);
                            }}
                          >
                            Candidate Follow-Up
                          </button>

                          <button
                            style={secondaryButton}
                            onClick={() => updateTrackerStatus(record.id, "Interview Requested")}
                          >
                            Mark Interview Requested
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activePage === "templates" && (
          <section style={cardStyle}>
            <h2 style={sectionTitle}>Settings → Templates</h2>
            <p style={{ color: "#4b5563" }}>
              All outbound email templates live here. Customize each section without cluttering the candidate page.
            </p>

            <div style={{ display: "grid", gap: 14 }}>
              {Object.entries(templates).map(([key, template]) => (
                <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16 }}>
                  <button
                    style={{ ...secondaryButton, width: "100%", textAlign: "left" }}
                    onClick={() => setExpandedTemplate(expandedTemplate === key ? null : key)}
                  >
                    {template.name}
                  </button>

                  {expandedTemplate === key && (
                    <div style={{ marginTop: 14 }}>
                      <FormInput label="Template Name" value={template.name} onChange={value => saveTemplate(key, "name", value)} />
                      <FormInput label="Subject" value={template.subject} onChange={value => saveTemplate(key, "subject", value)} />
                      <label style={labelStyle}>Body</label>
                      <textarea
                        value={template.body}
                        onChange={e => saveTemplate(key, "body", e.target.value)}
                        style={{ ...inputStyle, minHeight: 220, fontFamily: "monospace" }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function FormInput({ label, value, onChange, type = "text" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.06)"
};

const sectionTitle = {
  marginTop: 0,
  marginBottom: 16
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
  color: "#374151"
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 14,
  background: "#ffffff"
};

const primaryButton = {
  border: "none",
  background: "#111827",
  color: "white",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700
};

const secondaryButton = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700
};

const previewBox = {
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  borderRadius: 12,
  padding: 12,
  marginBottom: 14
};

const softPanel = {
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  borderRadius: 12,
  padding: 14
};