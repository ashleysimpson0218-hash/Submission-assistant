import React, { useCallback, useEffect, useState } from "react";
import "./workflow.css";
const uid = () => crypto.randomUUID();
const WITHDRAWAL_REASONS = [
  "Accepted another position",
  "Staying with current employer",
  "Compensation",
  "Schedule",
  "No longer interested",
  "Other",
];
const DECLINE_REASONS = [
  "Insufficient experience",
  "Minimum qualifications not met",
  "Education requirement not met",
  "Experience does not align",
  "Availability/schedule mismatch",
  "Other",
];
function Field({ label, children }) {
  return (
    <label className="wf-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function SelectMember({ members, value, onChange, label }) {
  return (
    <Field label={label}>
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a person</option>
        {members
          .filter((m) => m.active)
          .map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name} ({m.role})
            </option>
          ))}
      </select>
    </Field>
  );
}
export async function workflowRequest({
  client,
  workspaceId,
  token,
  command,
  fetchImpl = fetch,
}) {
  const headers = {
    "Content-Type": "application/json",
    "X-WelcomeFlow-Workspace-Id": workspaceId,
  };
  if (token) headers["X-WelcomeFlow-Candidate-Token"] = token;
  else {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token)
      throw new Error("Sign in to view your interview work.");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetchImpl("/api/workflow", {
    method: command ? "POST" : "GET",
    headers,
    cache: "no-store",
    ...(command ? { body: JSON.stringify(command) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    const e = new Error(result.error || "The workflow could not be confirmed.");
    e.definitive = response.status >= 400 && response.status < 500;
    e.code = result.code;
    throw e;
  }
  return result;
}
export default function WorkflowPanel({ client, workspaceId, token = "" }) {
  const [view, setView] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(null),
    [done, setDone] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const r = await workflowRequest({ client, workspaceId, token });
      setView(r.view);
    } catch (e) {
      setView(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [client, workspaceId, token]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setView(null);
        setPending(null);
        setError("Sign in to view your interview work.");
      }
    });
    return () => subscription?.data?.subscription?.unsubscribe();
  }, [client]);
  async function send(type, payload, retry = false) {
    if (busy || (!retry && pending)) return;
    const command = retry ? pending : { id: uid(), type, payload };
    setPending(command);
    setBusy(true);
    setError("");
    try {
      const r = await workflowRequest({ client, workspaceId, token, command });
      if (r.completed) setDone(true);
      else setView(r.view);
      setPending(null);
    } catch (e) {
      setError(e.message);
      if (e.definitive) setPending(null);
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || Boolean(pending);
  return (
    <section className="wf-workflow" aria-label="Interview workflow">
      <header>
        <div>
          <h2>{token ? "Your interview" : "Interview work"}</h2>
          <p>
            {token
              ? "Confirm your interview plans or share your experience with recruiting."
              : "One place for decisions, interview stages, and work needing attention."}
          </p>
        </div>
        <button type="button" disabled={busy} onClick={load}>
          Refresh
        </button>
      </header>
      {error ? (
        <p role="alert" className="wf-alert">
          {error}
        </p>
      ) : null}
      {pending && !busy ? (
        <div className="wf-alert">
          <p>
            This action has not been confirmed. Your entries are retained. Check
            its result before taking another action.
          </p>
          <button onClick={() => send("", {}, true)}>
            Check and retry pending action
          </button>
        </div>
      ) : null}
      {busy ? <p role="status">Checking the shared workflow…</p> : null}
      {done ? (
        <p role="status">Thank you. Your response has been recorded.</p>
      ) : token && view ? (
        <CandidateAction view={view} send={send} disabled={disabled} />
      ) : null}
      {!token && view ? (
        <>
          {!view.policy ? (
            <p className="wf-alert">
              A client administrator needs to confirm the communication policy
              and accountable owner before interview work begins.
            </p>
          ) : null}
          {view.jobs.some((j) => j.status === "queued") &&
          (!view.lastWorkerAt ||
            Date.now() - Date.parse(view.lastWorkerAt) > 10 * 60000) ? (
            <p className="wf-alert">
              Automatic processing has no recent heartbeat. Pending work is
              preserved. Ask your administrator to restore the workflow worker.
            </p>
          ) : null}
          <details>
            <summary>How interview work moves</summary>
            <p>
              Recruiters approve the reviewed handoff. The assigned owner
              decides, provides times, and confirms the interview outcome.
              Supporting interviewers contribute feedback; they cannot advance
              the candidate. Each Proceed moves to the next configured stage.
            </p>
            <p>
              Needs attention shows exceptions and their accountable owner.
              Failed or uncertain email needs evidence before retrying. A copied
              message or opened draft does not count as sent. Contact your
              client administrator for access or processing problems.
            </p>
          </details>
          {view.actor.role === "admin" ? (
            <Setup view={view} send={send} disabled={disabled} />
          ) : null}
          {["admin", "recruiter"].includes(view.actor.role) && view.policy ? (
            <Enrollment view={view} send={send} disabled={disabled} />
          ) : null}
          <h3>Needs attention ({view.exceptions.length})</h3>
          {view.exceptions.map((e) => (
            <article key={e.id} className="wf-card">
              <strong>
                {e.code.startsWith("CANDIDATE_FOLLOW_UP")
                  ? "Candidate follow-up"
                  : e.code === "DECISION_OVERDUE"
                    ? "Decision overdue"
                    : e.code === "SHORT_NOTICE_POLICY"
                      ? "Short-notice communication review"
                      : "Communication needs attention"}
              </strong>
              <p>{e.detail}</p>
              <small>
                Owner:{" "}
                {view.people?.find((p) => p.userId === e.ownerId)?.name ||
                  e.ownerId}{" "}
                · First recorded {new Date(e.createdAt).toLocaleString()}
              </small>
              {e.caseId ? (
                <a href={`#wf-case-${e.caseId}`}>Open related candidate</a>
              ) : null}
            </article>
          ))}
          <div className="wf-case-list">
            {view.cases.map((c) => (
              <CaseCard
                key={`${c.id}:${c.stageIndex}`}
                c={c}
                send={send}
                disabled={disabled}
                view={view}
              />
            ))}
          </div>
          {!view.cases.length ? (
            <p>No interview cases in your authorized scope.</p>
          ) : null}
          {["admin", "recruiter"].includes(view.actor.role) ? (
            <details>
              <summary>Workflow outcomes</summary>
              <p>
                {view.cases.length} candidates ·{" "}
                {view.cases.filter((c) => c.status === "offer_ready").length}{" "}
                ready for offer handoff ·{" "}
                {view.cases.filter((c) => c.status === "withdrawn").length}{" "}
                withdrawn ·{" "}
                {view.cases.filter((c) => c.status === "declined").length}{" "}
                declined
              </p>
              <p>
                These counts come from recorded workflow events. Ready for offer
                handoff does not mean hired.
              </p>
            </details>
          ) : null}
          {view.audit?.length ? (
            <details>
              <summary>Recent audit events</summary>
              <p>
                Latest recorded events in your authorized scope. Each action
                retains its actor, timestamp, and reason.
              </p>
              {view.audit.map((e) => (
                <p key={e.event_id}>
                  <strong>{e.type.replaceAll(".", " ")}</strong> · {e.actor_id}{" "}
                  · {new Date(e.occurred_at).toLocaleString()}
                  {e.details?.reason ? ` · ${e.details.reason}` : ""}
                </p>
              ))}
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
function PolicyForm({ view, send, disabled }) {
  const [policy, setPolicy] = useState(() => ({
    ...{
      timezone: "",
      fallbackOwnerId: "",
      sendStart: 420,
      sendEnd: 1110,
      workingDays: [1, 2, 3, 4, 5],
      reminderDays: 1,
      escalationDays: 3,
      checkInHours: 2,
      sources: { requisitions: "", calendarAvailability: "" },
    },
    ...view.policy,
  }));
  const [reason, setReason] = useState("");
  const update = (key, value) => setPolicy({ ...policy, [key]: value });
  const clock = (minutes) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send("configure_policy", { ...policy, reason });
      }}
    >
      <h3>Communication policy</h3>
      <Field label="Client working timezone">
        <input
          required
          placeholder="America/New_York"
          value={policy.timezone}
          onChange={(e) => update("timezone", e.target.value)}
        />
      </Field>
      <SelectMember
        members={view.members}
        value={policy.fallbackOwnerId}
        onChange={(value) => update("fallbackOwnerId", value)}
        label="Accountable escalation owner"
      />
      {["sendStart", "sendEnd"].map((key) => (
        <Field
          key={key}
          label={
            key === "sendStart"
              ? "Recipient-local send window begins"
              : "Recipient-local send window ends"
          }
        >
          <input
            type="time"
            required
            value={clock(policy[key])}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              update(key, h * 60 + m);
            }}
          />
        </Field>
      ))}
      <fieldset>
        <legend>Operating days</legend>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name, day) => (
          <label key={day}>
            <input
              type="checkbox"
              checked={policy.workingDays.includes(day)}
              onChange={(e) =>
                update(
                  "workingDays",
                  e.target.checked
                    ? [...policy.workingDays, day]
                    : policy.workingDays.filter((x) => x !== day),
                )
              }
            />
            {name}{" "}
          </label>
        ))}
      </fieldset>
      {[
        ["reminderDays", "Decision reminder after working days"],
        ["escalationDays", "Decision escalation after working days"],
        ["checkInHours", "Candidate experience check-in delay (hours)"],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            type="number"
            required
            min={key === "checkInHours" ? "0.1" : "1"}
            step={key === "checkInHours" ? "any" : "1"}
            value={policy[key]}
            onChange={(e) => update(key, Number(e.target.value))}
          />
        </Field>
      ))}
      {[
        ["requisitions", "Client-designated requisition source"],
        [
          "calendarAvailability",
          "Client-designated interview availability authority",
        ],
      ].map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            required
            value={policy.sources[key]}
            onChange={(e) =>
              update("sources", { ...policy.sources, [key]: e.target.value })
            }
          />
        </Field>
      ))}
      <Field label="Reason for policy setup or change">
        <input
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <p>
        Recipient timezone is verified separately. Current decision clocks keep
        the policy under which the request was sent. Source confirmation is
        human verification; no external integration is implied.
      </p>
      <button disabled={disabled}>Save policy</button>
    </form>
  );
}
function Setup({ view, send, disabled }) {
  const [req, setReq] = useState(""),
    [manager, setManager] = useState(""),
    [recruiter, setRecruiter] = useState(""),
    [ownerReason, setOwnerReason] = useState(""),
    [stages, setStages] = useState([
      {
        id: uid(),
        name: "Hiring manager interview",
        ownerId: "",
        interviewerIds: [],
      },
    ]);
  return (
    <details>
      <summary>Client policy and Interview Plans</summary>
      <PolicyForm view={view} send={send} disabled={disabled} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send("configure_requisition", {
            id: req,
            managerId: manager,
            recruiterIds: [recruiter],
            stages,
          });
        }}
      >
        <h3>Requisition Interview Plan</h3>
        <Field label="Existing requisition">
          <select required value={req} onChange={(e) => setReq(e.target.value)}>
            <option value="">Choose a requisition</option>
            {view.catalog.requisitions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <SelectMember
          members={view.members}
          value={manager}
          onChange={setManager}
          label="Requisition owner"
        />
        <SelectMember
          members={view.members.filter((m) =>
            ["admin", "recruiter"].includes(m.role),
          )}
          value={recruiter}
          onChange={setRecruiter}
          label="Recruiter"
        />
        {stages.map((stage, i) => (
          <fieldset key={stage.id}>
            <legend>Stage {i + 1}</legend>
            <Field label="Stage name">
              <input
                required
                value={stage.name}
                onChange={(e) =>
                  setStages(
                    stages.map((s, j) =>
                      j === i ? { ...s, name: e.target.value } : s,
                    ),
                  )
                }
              />
            </Field>
            <SelectMember
              members={view.members}
              value={stage.ownerId}
              onChange={(ownerId) =>
                setStages(
                  stages.map((s, j) => (j === i ? { ...s, ownerId } : s)),
                )
              }
              label="One decision owner"
            />
            <Field label="Additional interviewers (optional)">
              <select
                multiple
                value={stage.interviewerIds}
                onChange={(e) => {
                  const ids = [...e.target.selectedOptions].map((o) => o.value);
                  setStages(
                    stages.map((s, j) =>
                      j === i ? { ...s, interviewerIds: ids } : s,
                    ),
                  );
                }}
              >
                {view.members
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </Field>
            {stages.length > 1 ? (
              <button
                type="button"
                onClick={() => setStages(stages.filter((_, j) => j !== i))}
              >
                Remove stage
              </button>
            ) : null}
          </fieldset>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setStages([
              ...stages,
              { id: uid(), name: "", ownerId: "", interviewerIds: [] },
            ])
          }
        >
          Add interview stage
        </button>{" "}
        <button disabled={disabled || !view.policy}>Save Interview Plan</button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send("reassign_requisition_owner", {
            requisitionId: req,
            ownerId: manager,
            reason: ownerReason,
          });
        }}
      >
        <h3>Recover requisition ownership</h3>
        <p>
          Use the requisition and new owner selected above. Existing interview
          stage assignments remain explicit.
        </p>
        <Field label="Reason for ownership change">
          <input
            required
            value={ownerReason}
            onChange={(e) => setOwnerReason(e.target.value)}
          />
        </Field>
        <button disabled={disabled || !req || !manager}>
          Confirm requisition owner
        </button>
      </form>
    </details>
  );
}
function Enrollment({ view, send, disabled }) {
  const [id, setId] = useState(""),
    [zone, setZone] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [contact, setContact] = useState(false);
  const c = view.catalog.candidates.find((x) => x.id === id);
  return (
    <details>
      <summary>Start a reviewed candidate handoff</summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (c)
            send("handoff", {
              candidateId: c.id,
              requisitionId: c.requisitionId,
              reviewed,
              sourceConfirmed: reviewed,
              timezone: zone,
              contactAllowed: contact,
            });
        }}
      >
        <Field label="Candidate with an approved submission packet">
          <select
            required
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setReviewed(false);
              setContact(false);
            }}
          >
            <option value="">Choose a candidate</option>
            {view.catalog.candidates
              .filter(
                (x) =>
                  !view.cases.some(
                    (c) =>
                      c.candidateId === x.id &&
                      c.requisitionId === x.requisitionId,
                  ),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Verified candidate timezone">
          <input
            required
            placeholder="America/New_York"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          />
        </Field>
        <p>
          Use the requisition source designated by your client administrator.
        </p>
        <label>
          <input
            type="checkbox"
            required
            checked={reviewed}
            onChange={(e) => setReviewed(e.target.checked)}
          />{" "}
          I reviewed the approved packet and confirmed this active hiring need
          against its source.
        </label>
        <label>
          <input
            type="checkbox"
            checked={contact}
            onChange={(e) => setContact(e.target.checked)}
          />{" "}
          Candidate email contact is permitted.
        </label>
        <button disabled={disabled || !c || !reviewed}>
          Approve post-screen handoff
        </button>
      </form>
    </details>
  );
}
function CaseCard({ c, send, disabled, view }) {
  const [reason, setReason] = useState(""),
    [comment, setComment] = useState(""),
    [contact, setContact] = useState({
      email: c.email || "",
      timezone: c.timezone || "",
      contactAllowed: c.contactAllowed,
    }),
    [replacement, setReplacement] = useState(""),
    [feedback, setFeedback] = useState(""),
    [location, setLocation] = useState(c.stages[c.stageIndex]?.location || ""),
    [instructions, setInstructions] = useState(
      c.stages[c.stageIndex]?.instructions || "",
    ),
    [slotStart, setSlotStart] = useState(""),
    [slotEnd, setSlotEnd] = useState(""),
    [slots, setSlots] = useState([]),
    [evidence, setEvidence] = useState(""),
    [resolution, setResolution] = useState("");
  const stage = c.stages[c.stageIndex],
    payload = { caseId: c.id, expectedVersion: c.version };
  const act = (type, p = {}) => send(type, { ...payload, ...p });
  return (
    <article id={`wf-case-${c.id}`} className="wf-card">
      <h3>{c.name}</h3>
      <p>
        <strong>{stage?.name || "Post-screen manager review"}</strong> ·{" "}
        {c.status.replaceAll("_", " ")}
      </p>
      <p>{stage ? `Stage ${c.stageIndex + 1} of ${c.stages.length}` : ""}</p>
      <details>
        <summary>Reviewed candidate packet and recorded feedback</summary>
        <p className="wf-prewrap">{c.packet}</p>
        {c.stages.map((s) => (
          <div key={s.id}>
            <strong>{s.name}</strong>
            {s.feedback?.map((f, i) => (
              <p key={i}>
                {f.text}{" "}
                <small>{new Date(f.recordedAt).toLocaleString()}</small>
              </p>
            ))}
          </div>
        ))}
      </details>
      {c.canDecide &&
      ["manager_decision", "feedback_due", "held"].includes(c.status) ? (
        <div className="wf-actions">
          <button
            disabled={disabled}
            onClick={() => act("decision", { decision: "proceed" })}
          >
            {c.stageIndex === c.stages.length - 1
              ? "Proceed toward offer handoff"
              : "Proceed"}
          </button>
          <button
            disabled={disabled || c.status === "held"}
            onClick={() => act("decision", { decision: "hold" })}
          >
            Hold
          </button>
          <Field label="Decline reason">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a short reason</option>
              {DECLINE_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Decision comment (optional)">
            <textarea
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <button
            disabled={disabled || !reason}
            onClick={() =>
              act("decision", { decision: "decline", reason, comment })
            }
          >
            Decline
          </button>
          <small>
            Hold sends an active-review note without a promised decision date.
          </small>
        </div>
      ) : null}
      {c.canDecide &&
      ["slots_needed", "selection_pending"].includes(c.status) ? (
        <details open={c.status === "slots_needed"}>
          <summary>
            {c.status === "selection_pending"
              ? "Replace offered interview times"
              : "Offer interview times"}
          </summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("offer_slots", { slots, instructions, location });
            }}
          >
            <p>
              Confirm these times with the client-designated availability
              authority before sending.
            </p>
            <p>
              Enter times in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              Candidates will see their local times.
            </p>
            <Field label="Interview location or joining link">
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </Field>
            <Field label="Preparation information">
              <textarea
                required
                maxLength={2000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </Field>
            <Field label="Slot start">
              <input
                type="datetime-local"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
              />
            </Field>
            <Field label="Slot end">
              <input
                type="datetime-local"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
              />
            </Field>
            <button
              type="button"
              disabled={!slotStart || !slotEnd || disabled}
              onClick={() => {
                setSlots([
                  ...slots,
                  {
                    start: new Date(slotStart).toISOString(),
                    end: new Date(slotEnd).toISOString(),
                  },
                ]);
                setSlotStart("");
                setSlotEnd("");
              }}
            >
              Add time
            </button>
            {slots.map((s, i) => (
              <p key={i}>
                {new Date(s.start).toLocaleString()} –{" "}
                {new Date(s.end).toLocaleTimeString()}{" "}
                <button
                  type="button"
                  onClick={() => setSlots(slots.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </p>
            ))}
            <button disabled={disabled || !slots.length}>
              Send offered times
            </button>
          </form>
        </details>
      ) : null}
      {stage?.booking ? (
        <p>Interview: {new Date(stage.booking.start).toLocaleString()}</p>
      ) : null}
      {c.canParticipate && c.status === "scheduled" ? (
        <button
          disabled={disabled || Date.now() < Date.parse(stage.booking.start)}
          onClick={() =>
            act("complete_interview", {
              confirmed: true,
              occurredAt: new Date().toISOString(),
            })
          }
        >
          Confirm interview occurred
        </button>
      ) : null}
      {c.canParticipate &&
      stage?.completedAt &&
      ["feedback_due", "held"].includes(c.status) ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act("feedback", { feedback });
          }}
        >
          <Field label="Supporting interview feedback">
            <textarea
              value={feedback}
              maxLength={2000}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
          <button disabled={disabled || !feedback.trim()}>
            Record feedback
          </button>
          <small>The stage owner makes the decision.</small>
        </form>
      ) : null}
      {c.canRecruit && c.stages.some((s) => s.experience) ? (
        <details>
          <summary>Candidate experience</summary>
          {c.stages
            .filter((s) => s.experience)
            .map((s) => (
              <p key={s.id}>
                {s.name}: interest {s.experience.interested}, experience{" "}
                {s.experience.rating}. {s.experience.feedback}{" "}
                {s.experience.questions}{" "}
                {s.experience.followUp ? "Follow-up requested." : ""}
              </p>
            ))}
        </details>
      ) : null}
      {c.status === "offer_ready" ? (
        <p role="status">
          Final required interview decision recorded. Ready for the configured
          offer handoff; offer terms still require authorized human approval.
        </p>
      ) : null}
      {c.canRecruit &&
      !["declined", "withdrawn", "offer_ready"].includes(c.status) ? (
        <details>
          <summary>Record confirmed candidate withdrawal</summary>
          <Field label="Candidate’s withdrawal reason">
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason</option>
              {WITHDRAWAL_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Withdrawal comment (optional)">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Field>
          <button
            disabled={disabled || !reason.trim()}
            onClick={() =>
              act("withdraw", { confirmed: true, reason, comment })
            }
          >
            Confirm candidate withdrew
          </button>
        </details>
      ) : null}
      {c.canRecruit ? (
        <details>
          <summary>Correct verified contact or permission</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              act("update_contact", { ...contact, reason: resolution });
            }}
          >
            <Field label="Verified email">
              <input
                type="email"
                required
                value={contact.email}
                onChange={(e) =>
                  setContact({ ...contact, email: e.target.value })
                }
              />
            </Field>
            <Field label="Verified timezone">
              <input
                required
                value={contact.timezone}
                onChange={(e) =>
                  setContact({ ...contact, timezone: e.target.value })
                }
              />
            </Field>
            <label>
              <input
                type="checkbox"
                checked={contact.contactAllowed}
                onChange={(e) =>
                  setContact({ ...contact, contactAllowed: e.target.checked })
                }
              />
              Email contact permitted
            </label>
            <Field label="Correction reason">
              <input
                required
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
              />
            </Field>
            <button disabled={disabled}>Confirm corrected contact</button>
          </form>
        </details>
      ) : null}
      {view.actor.role === "admin" &&
      c.stageIndex >= 0 &&
      ["feedback_due", "held", "slots_needed"].includes(c.status) ? (
        <details>
          <summary>Recover an unavailable decision owner</summary>
          <SelectMember
            members={view.members}
            value={replacement}
            onChange={setReplacement}
            label="Replacement stage owner"
          />
          <Field label="Reassignment reason">
            <input
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </Field>
          <button
            disabled={disabled || !replacement || !resolution.trim()}
            onClick={() =>
              act("reassign_owner", {
                ownerId: replacement,
                reason: resolution,
              })
            }
          >
            Reassign stage owner
          </button>
        </details>
      ) : null}
      {c.canRecruit &&
      (c.status === "selection_pending" ||
        c.stages.some((s) => s.completedAt && !s.experience)) ? (
        <details>
          <summary>Replace an expired or broken candidate link</summary>
          <Field label="Replacement reason">
            <input
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </Field>
          {c.status === "selection_pending" ? (
            <button
              disabled={disabled || !resolution.trim()}
              onClick={() =>
                act("replace_candidate_link", {
                  stageIndex: c.stageIndex,
                  purpose: "booking",
                  reason: resolution,
                })
              }
            >
              Send replacement scheduling link
            </button>
          ) : null}
          {c.stages.map((s, i) =>
            s.completedAt && !s.experience ? (
              <button
                key={s.id}
                disabled={disabled || !resolution.trim()}
                onClick={() =>
                  act("replace_candidate_link", {
                    stageIndex: i,
                    purpose: "experience",
                    reason: resolution,
                  })
                }
              >
                Replace {s.name} check-in link
              </button>
            ) : null,
          )}
        </details>
      ) : null}
      {c.canRecruit
        ? view.jobs
            .filter(
              (j) =>
                j.caseId === c.id && ["failed", "unknown"].includes(j.status),
            )
            .map((j) => (
              <div key={j.id} className="wf-alert">
                <strong>
                  {j.kind.replaceAll("_", " ")}: {j.status}
                </strong>
                <p>
                  Verify the original result before retrying. Opening a draft or
                  copying text is not sending.
                </p>
                <Field label="Verification evidence">
                  <input
                    value={evidence}
                    onChange={(e) => setEvidence(e.target.value)}
                  />
                </Field>
                <button
                  disabled={disabled || !evidence.trim()}
                  onClick={() =>
                    send("recover_delivery", {
                      jobId: j.id,
                      evidence,
                      outcome: "confirmed_sent",
                    })
                  }
                >
                  Verified sent
                </button>{" "}
                <button
                  disabled={disabled || !evidence.trim()}
                  onClick={() =>
                    send("recover_delivery", {
                      jobId: j.id,
                      evidence,
                      outcome: "confirmed_not_sent",
                    })
                  }
                >
                  Verified not sent; requeue
                </button>
              </div>
            ))
        : null}
      {c.canRecruit
        ? view.exceptions
            .filter(
              (e) =>
                e.caseId === c.id &&
                (["SHORT_NOTICE_POLICY", "BOOKING_WINDOW_POLICY"].includes(
                  e.code,
                ) ||
                  e.code.startsWith("CANDIDATE_FOLLOW_UP")),
            )
            .map((e) => (
              <form
                key={e.id}
                onSubmit={(event) => {
                  event.preventDefault();
                  act("resolve_exception", { exceptionId: e.id, resolution });
                }}
              >
                <Field label="Resolution and verified manual action">
                  <input
                    required
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                  />
                </Field>
                <button disabled={disabled}>Record resolution</button>
              </form>
            ))
        : null}
    </article>
  );
}
function CandidateAction({ view, send, disabled }) {
  const [slot, setSlot] = useState(""),
    [interested, setInterested] = useState(""),
    [experience, setExperience] = useState(""),
    [feedback, setFeedback] = useState(""),
    [questions, setQuestions] = useState(""),
    [followUp, setFollowUp] = useState(false);
  if (view.responded)
    return (
      <p>
        Your experience response is already recorded. Contact recruiting if you
        need to update it.
      </p>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(view.purpose === "booking" ? "book" : "experience", {
          caseId: view.caseId,
          expectedVersion: view.expectedVersion,
          slotId: slot,
          interested,
          experience,
          feedback,
          questions,
          followUp,
        });
      }}
    >
      <h3>{view.requisition}</h3>
      <p>{view.stageName}</p>
      {view.purpose === "booking" ? (
        <>
          <Field label="Choose an interview time">
            <select
              required
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
            >
              <option value="">Choose an offered time</option>
              {view.slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.start).toLocaleString()} –{" "}
                  {new Date(s.end).toLocaleTimeString()}
                </option>
              ))}
            </select>
          </Field>
          <p>
            Times are shown in{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}. If none work,
            contact recruiting for help.
          </p>
        </>
      ) : (
        <>
          <p>
            This is an experience check-in, not an offer or hiring decision.
          </p>
          <Field label="Are you still interested?">
            <select
              required
              value={interested}
              onChange={(e) => setInterested(e.target.value)}
            >
              <option value="">Choose</option>
              <option value="yes">Yes</option>
              <option value="unsure">Unsure</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="How was the interview or facility experience?">
            <select
              required
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            >
              <option value="">Choose</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </Field>
          <Field label="Additional feedback (optional)">
            <textarea
              maxLength={2000}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
          <Field label="Unanswered questions (optional)">
            <textarea
              maxLength={1000}
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
            />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={followUp}
              onChange={(e) => setFollowUp(e.target.checked)}
            />{" "}
            I would like recruiting or HR to follow up.
          </label>
        </>
      )}
      <button disabled={disabled}>Submit response</button>
    </form>
  );
}
