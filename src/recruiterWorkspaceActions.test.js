import {
  WORKSPACE_TASK_ACTIONS,
  applyWorkspaceBulkTaskReviewToRecords,
  applyWorkspaceTaskAction,
  prepareWorkspaceBulkTaskReview,
  revalidateWorkspaceBulkTaskReview,
  resolveWorkspaceTaskRecord,
} from "./recruiterWorkspaceActions";

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

  test("previews only approved internal bulk actions and binds exact action options", () => {
    const task = { id: "candidate:candidate-1:requisition:req-1", sourceType: "candidate", sourceId: "candidate-1", candidateId: "candidate-1", requisitionId: "req-1", candidateName: "Synthetic Candidate", facilityName: "Synthetic Facility", sourceRevision: NOW };
    expect(prepareWorkspaceBulkTaskReview([task], WORKSPACE_TASK_ACTIONS.FOLLOW_UP).ok).toBe(false);
    const prepared = prepareWorkspaceBulkTaskReview([task], WORKSPACE_TASK_ACTIONS.SNOOZE, { snoozeDays: 1 });
    expect(prepared.ok).toBe(true);
    expect(revalidateWorkspaceBulkTaskReview(prepared.review, [task]).ok).toBe(true);
    expect(revalidateWorkspaceBulkTaskReview({ ...prepared.review, action: WORKSPACE_TASK_ACTIONS.ADD_UPDATE }, [task]).ok).toBe(false);
    expect(revalidateWorkspaceBulkTaskReview({ ...prepared.review, options: { snoozeDays: 2 } }, [task]).ok).toBe(false);
  });

  test("revalidates every reviewed task and reports partial failures without mutating source records", () => {
    const records = [
      { ...candidate, id: "candidate-shared", requisitionId: "req-one", updatedAt: NOW },
      { ...candidate, id: "candidate-shared", requisitionId: "req-two", updatedAt: NOW },
    ];
    const tasks = records.map((record) => ({
      id: `candidate:${record.id}:requisition:${record.requisitionId}`,
      sourceType: "candidate",
      sourceId: record.id,
      candidateId: record.id,
      requisitionId: record.requisitionId,
      candidateName: "Synthetic Candidate",
      facilityName: "Synthetic Facility",
      title: "Review candidate",
      ownerType: "Recruiter",
      sourceRevision: record.updatedAt,
    }));
    const prepared = prepareWorkspaceBulkTaskReview(tasks, WORKSPACE_TASK_ACTIONS.ADD_UPDATE, { note: "Reviewed exact records." });
    const currentTasks = [tasks[0], { ...tasks[1], sourceRevision: "2026-07-22T12:01:00.000Z" }];
    const result = applyWorkspaceBulkTaskReviewToRecords(records, currentTasks, prepared.review, { now: NOW, actor: "Synthetic Recruiter" });
    expect(result).toMatchObject({ ok: true, succeeded: 1, failed: 1 });
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: tasks[0].id, ok: true }),
      expect.objectContaining({ taskId: tasks[1].id, ok: false, code: "TASK_CHANGED" }),
    ]));
    expect(result.records[0].audit[0]).toMatchObject({ actor: "Synthetic Recruiter", bulkActionId: prepared.review.id, source: "Recruiter Workspace Bulk Action" });
    expect(result.records[1]).toEqual(records[1]);
    expect(records[0].audit).toEqual([]);
  });

  test("resolves the exact candidate and requisition record and fails closed on duplicates", () => {
    const task = { sourceId: "candidate-shared", requisitionId: "req-two" };
    const records = [
      { id: "candidate-shared", requisitionId: "req-one" },
      { id: "candidate-shared", requisitionId: "req-two" },
    ];
    expect(resolveWorkspaceTaskRecord(records, task)).toMatchObject({ ok: true, index: 1 });
    expect(resolveWorkspaceTaskRecord([...records, { ...records[1] }], task)).toMatchObject({ ok: false });
  });

  test("preserves unrelated malformed rows while updating the exact record", () => {
    const records = [
      null,
      { ...candidate, id: "candidate-shared", requisitionId: "req-one", updatedAt: NOW },
      { ...candidate, id: "candidate-shared", requisitionId: "req-two", updatedAt: NOW },
    ];
    const task = {
      id: "candidate:candidate-shared:requisition:req-two",
      sourceType: "candidate",
      sourceId: "candidate-shared",
      candidateId: "candidate-shared",
      requisitionId: "req-two",
      candidateName: "Synthetic Candidate",
      facilityName: "Synthetic Facility",
      title: "Review candidate",
      ownerType: "Recruiter",
      sourceRevision: NOW,
    };
    const prepared = prepareWorkspaceBulkTaskReview([task], WORKSPACE_TASK_ACTIONS.ADD_UPDATE, { note: "Reviewed exact record." });
    const result = applyWorkspaceBulkTaskReviewToRecords(records, [task], prepared.review, { now: NOW, actor: "Synthetic Recruiter" });

    expect(result).toMatchObject({ ok: true, succeeded: 1, failed: 0 });
    expect(result.records[0]).toBeNull();
    expect(result.records[1]).toEqual(records[1]);
    expect(result.records[2]).toMatchObject({ id: "candidate-shared", requisitionId: "req-two", lastActionLabel: "Workspace update" });
    expect(resolveWorkspaceTaskRecord(records, task)).toMatchObject({ ok: true, index: 2 });
  });
});
