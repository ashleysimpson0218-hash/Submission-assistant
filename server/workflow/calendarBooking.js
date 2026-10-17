const crypto = require("crypto");
const { snapshot, execute, SYSTEM } = require("./store");
const { createCalendarProvider } = require("./calendarProviders");
const { need } = require("../../src/workflow/engine");

function requisitionDetails(requisition) {
  const [position, facility, jobIdentifier] = String(requisition.title || "")
    .split("|")
    .map((value) => value.trim());
  return {
    position: position || requisition.title || "Position not listed",
    facility: facility || "Facility not listed",
    jobIdentifier: jobIdentifier || requisition.id,
  };
}

function calendarRequest(snapshotValue, caseId) {
  const workflowCase = snapshotValue.state.cases.find((item) => item.id === caseId),
    requisition = snapshotValue.state.requisitions.find((item) => item.id === workflowCase?.requisitionId),
    stageIndex = workflowCase?.stageIndex,
    stage = workflowCase?.stages[stageIndex];
  need(workflowCase && requisition && stage?.booking && stage.calendarSync, "CALENDAR_BOOKING_REQUIRED", "The saved interview booking was not found.", 404);
  const connection = (snapshotValue.state.calendarConnections || []).find(
    (item) => item.memberId === stage.ownerId && item.provider === "microsoft",
  );
  need(connection, "CALENDAR_CONNECTION_REQUIRED", "Connect and verify the stage owner’s Outlook calendar first.", 409);
  const details = requisitionDetails(requisition);
  const subject = `${stage.name} | ${details.position} | ${workflowCase.name}`;
  const legacySubject = `${stage.name} | ${details.position} | ${details.facility} | ${details.jobIdentifier}`;
  const attendeeEmails = [
    workflowCase.email,
    ...stage.interviewerIds
      .filter((memberId) => memberId !== stage.ownerId)
      .map((memberId) => snapshotValue.members.find((member) => member.userId === memberId)?.email),
  ].filter(Boolean);
  return {
    workflowCase,
    requisition,
    stage,
    stageIndex,
    connection,
    booking: {
      bookingId: stage.calendarSync.bookingId,
      start: stage.booking.start,
      end: stage.booking.end,
      subject,
      matchSubjects: [subject, legacySubject],
      location: stage.location,
      instructions: [
        `Candidate: ${workflowCase.name}`,
        `Position: ${details.position}`,
        `Facility: ${details.facility}`,
        `Unique job identifier: ${details.jobIdentifier}`,
        `Interview stage: ${stage.name}`,
        `Preparation: ${stage.instructions}`,
      ].join("\n"),
      attendeeEmails,
    },
  };
}

async function record(client, workspaceId, request, result) {
  return execute(
    client,
    workspaceId,
    {
      id: `calendar-sync:${crypto.randomUUID()}`,
      type: "record_calendar_sync",
      payload: {
        caseId: request.workflowCase.id,
        stageIndex: request.stageIndex,
        bookingId: request.booking.bookingId,
        ...result,
      },
    },
    SYSTEM,
  );
}

async function syncInterviewCalendar({
  client,
  workspaceId,
  caseId,
  providerFactory = createCalendarProvider,
}) {
  let request;
  try {
    request = calendarRequest(await snapshot(client, workspaceId), caseId);
  } catch (error) {
    const snap = await snapshot(client, workspaceId),
      workflowCase = snap.state.cases.find((item) => item.id === caseId),
      stageIndex = workflowCase?.stageIndex,
      stage = workflowCase?.stages[stageIndex];
    if (workflowCase && stage?.calendarSync) {
      await record(client, workspaceId, {
        workflowCase,
        stageIndex,
        booking: { bookingId: stage.calendarSync.bookingId },
      }, {
        status: "failed",
        code: error.code || "CALENDAR_CONNECTION_REQUIRED",
      });
    }
    return { status: "failed", code: error.code || "CALENDAR_CONNECTION_REQUIRED" };
  }
  if (request.stage.calendarSync.status === "created") {
    return {
      status: "created",
      provider: request.stage.calendarSync.provider,
      eventId: request.stage.calendarSync.eventId,
      reused: true,
    };
  }
  const provider = providerFactory(request.connection);
  try {
    const account = await provider.inspectAccount();
    need(
      account.accountId === request.connection.accountId &&
        account.providerCalendarId === request.connection.providerCalendarId,
      "CALENDAR_CONNECTION_REQUIRED",
      "The connected Outlook account changed. Verify the stage owner’s calendar again.",
      409,
    );
    let result;
    if (request.stage.calendarSync.status === "unknown") {
      result = await provider.findEvent(request.booking);
      if (!result) return { status: "unknown", code: "CALENDAR_RECONCILIATION_REQUIRED" };
    } else {
      result = await provider.createEvent(request.booking);
    }
    await record(client, workspaceId, request, {
      status: "created",
      provider: result.provider,
      eventId: result.eventId,
      code: "",
    });
    return { status: "created", provider: result.provider, eventId: result.eventId, reused: Boolean(result.reused) };
  } catch (error) {
    const status = error.code === "CALENDAR_WRITE_UNKNOWN" ? "unknown" : "failed";
    await record(client, workspaceId, request, {
      status,
      provider: request.connection.provider,
      code: status === "unknown" ? "CALENDAR_RECONCILIATION_REQUIRED" : error.code || "CALENDAR_SYNC_FAILED",
    });
    return {
      status,
      code: status === "unknown" ? "CALENDAR_RECONCILIATION_REQUIRED" : error.code || "CALENDAR_SYNC_FAILED",
    };
  }
}

module.exports = { calendarRequest, syncInterviewCalendar };
