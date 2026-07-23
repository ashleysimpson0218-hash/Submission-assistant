import { WORKSPACE_TASK_ACTIONS, applyWorkspaceTaskAction } from "./recruiterWorkspaceActions";

const NOW = "2026-07-22T12:00:00.000Z";
const candidate = { id: "candidate-1", candidate: "Synthetic Candidate", site: "Synthetic Facility", nextAction: "Await decision maker review", followUpCount: 1, audit: [] };

describe("recruiter workspace task actions", () => {
  test("follow-up schedules the next response and preserves the record", () => {
    const result = applyWorkspaceTaskAction(candidate, WORKSPACE_TASK_ACTIONS.FOLLOW_UP, { now: NOW, followUpDays: 2 });
    expect(result.ok).toBe(true);
    expect(result.record.followUpCount).toBe(2);
    expect(result.record.nextActionDueDate).toBe("2026-07-24T12:00:00.000Z");
    expect(result.record.id).toBe(candidate.id);
    expect(candidate.followUpCount).toBe(1);
  });

  test("escalation increases one controlled level at a time", () => {
    const first = applyWorkspaceTaskAction(candidate, WORKSPACE_TASK_ACTIONS.ESCALATE, { now: NOW });
    const second = applyWorkspaceTaskAction(first.record, WORKSPACE_TASK_ACTIONS.ESCALATE, { now: "2026-07-23T12:00:00.000Z" });
    expect(first.record.escalationLevel).toBe(1);
    expect(second.record.escalationLevel).toBe(2);
    expect(second.history.type).toBe("Workspace Escalation Logged");
  });

  test("snooze and reassignment require explicit recruiter actions", () => {
    const snoozed = applyWorkspaceTaskAction(candidate, WORKSPACE_TASK_ACTIONS.SNOOZE, { now: NOW, snoozeDays: 1 });
    expect(snoozed.record.snoozedUntil).toBe("2026-07-23T12:00:00.000Z");
    const invalidOwner = applyWorkspaceTaskAction(candidate, WORKSPACE_TASK_ACTIONS.REASSIGN, { now: NOW });
    expect(invalidOwner.ok).toBe(false);
    const reassigned = applyWorkspaceTaskAction(candidate, WORKSPACE_TASK_ACTIONS.REASSIGN, { now: NOW, ownerType: "New Hire Liaison" });
    expect(reassigned.record.currentOwner).toBe("New Hire Liaison");
  });

  test("not-at-risk decisions retain the recruiter note and history", () => {
    const result = applyWorkspaceTaskAction(candidate, WORKSPACE_TASK_ACTIONS.NOT_AT_RISK, { now: NOW, actor: "Synthetic Recruiter", note: "Candidate confirmed continued interest." });
    expect(result.record.riskOverride).toBe("Not at risk");
    expect(result.record.riskOverrideNote).toBe("Candidate confirmed continued interest.");
    expect(result.record.audit).toHaveLength(1);
    expect(result.history.type).toBe("Candidate Risk Override");
  });

  test("updates require meaningful content", () => {
    expect(applyWorkspaceTaskAction(candidate, WORKSPACE_TASK_ACTIONS.ADD_UPDATE, { now: NOW }).ok).toBe(false);
  });
});

