export function openingsForRequisition(req = {}) {
  const value = Number(req?.numberOfOpenings || req?.openings || req?.openingCount || 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function candidateMatchesReq(candidate = {}, req = {}) {
  const candidateReqId = candidate.requisitionId || candidate.formSnapshot?.selectedRequisitionId || "";
  const candidateReqNumber = candidate.reqNumber || candidate.formSnapshot?.reqNumber || "";
  const reqNumber = req.reqNumber || "";
  return Boolean(
    (req.id && candidateReqId && candidateReqId === req.id) ||
    (reqNumber && candidateReqNumber && String(candidateReqNumber).trim().toLowerCase() === String(reqNumber).trim().toLowerCase())
  );
}

export function hireRecordMatchesReq(record = {}, req = {}) {
  const recordReqId = record.requisitionId || "";
  const recordReqNumber = record.reqNumber || "";
  const reqNumber = req.reqNumber || "";
  return Boolean(
    (req.id && recordReqId && recordReqId === req.id) ||
    (reqNumber && recordReqNumber && String(recordReqNumber).trim().toLowerCase() === String(reqNumber).trim().toLowerCase())
  );
}

export function hireRecordsForCandidate(candidate = {}) {
  const records = Array.isArray(candidate.hireRecords) ? candidate.hireRecords : [];
  const primary = candidate.hireRecord && typeof candidate.hireRecord === "object" ? [candidate.hireRecord] : [];
  const byKey = new Map();
  [...primary, ...records].forEach((record) => {
    if (!record) return;
    const key = `${record.requisitionId || ""}|${record.reqNumber || ""}|${record.hiredAt || record.hireDate || ""}`;
    byKey.set(key, record);
  });
  return Array.from(byKey.values());
}

export function buildHireWorkflowPatch(candidate = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const hireDate = options.hireDate || candidate.hireDate || candidate.tentativeStartDate || now.slice(0, 10);
  const record = {
    id: options.id || `hire-${Date.now()}`,
    candidateId: candidate.id || "",
    candidateName: candidate.candidate || candidate.formSnapshot?.fullName || "",
    hiredAt: now,
    hireDate,
    requisitionId: candidate.requisitionId || candidate.formSnapshot?.selectedRequisitionId || "",
    reqNumber: candidate.reqNumber || candidate.formSnapshot?.reqNumber || "",
    uniqueIdNumber: candidate.uniqueIdNumber || candidate.formSnapshot?.uniqueIdNumber || "",
    facility: candidate.site || candidate.formSnapshot?.siteName || "",
    position: candidate.position || candidate.formSnapshot?.position || "",
    offerDate: candidate.offerDate || candidate.formSnapshot?.offerDate || "",
    tentativeStartDate: candidate.tentativeStartDate || candidate.formSnapshot?.tentativeStartDate || hireDate,
    createdBy: options.recruiterName || "Recruiter",
  };
  const existingRecords = hireRecordsForCandidate(candidate);
  const duplicate = existingRecords.some((existing) => (
    (record.requisitionId && existing.requisitionId === record.requisitionId) ||
    (record.reqNumber && existing.reqNumber === record.reqNumber)
  ));
  const hireRecords = duplicate ? existingRecords : [record, ...existingRecords];
  return {
    status: "Onboarding",
    movementStage: "Onboarding",
    nextAction: "Complete onboarding checks",
    archived: false,
    archivedAt: "",
    hiredAt: candidate.hiredAt || now,
    hireDate,
    tentativeStartDate: record.tentativeStartDate,
    hireRecord: duplicate ? existingRecords[0] : record,
    hireRecords,
    archiveOutcome: "Hired",
    finalCandidateOutcome: "Hired",
    candidateMadeItThroughProcess: "Yes",
    onboardingStartDate: candidate.onboardingStartDate || now.slice(0, 10),
    reportTag: "Onboarding",
  };
}

export function hiredCountForReq(req = {}, tracker = []) {
  const matchedCandidateIds = new Set();
  (tracker || []).forEach((candidate) => {
    const hasPermanentRecord = hireRecordsForCandidate(candidate).some((record) => hireRecordMatchesReq(record, req));
    const legacyHiredMatch = !hireRecordsForCandidate(candidate).length
      && candidateMatchesReq(candidate, req)
      && ["Hired", "Onboarding", "Placed"].includes(candidate.status || "")
      && (candidate.archiveOutcome === "Hired" || candidate.finalCandidateOutcome === "Hired" || candidate.status === "Onboarding" || candidate.status === "Hired");
    if (hasPermanentRecord || legacyHiredMatch) matchedCandidateIds.add(candidate.id || `${candidate.candidate}-${candidate.reqNumber}`);
  });
  return matchedCandidateIds.size;
}

export function requisitionFillPatch(req = {}, tracker = []) {
  const openings = openingsForRequisition(req);
  const filledCount = hiredCountForReq(req, tracker);
  const remainingOpenings = Math.max(openings - filledCount, 0);
  const filled = filledCount >= openings;
  return {
    filled,
    filledCount,
    remainingOpenings,
    status: filled ? "Filled" : "Active",
    archiveReason: filled ? "Filled - all openings hired" : "",
  };
}

export function buildOnboardingChecklistPatch(candidate = {}, checklist = {}, now = new Date().toISOString()) {
  const complete = Object.values(checklist).every(Boolean);
  return {
    onboardingCompletionChecklist: checklist,
    onboardingCompletionStatus: complete ? "Complete" : "In Progress",
    onboardingCompletionSavedAt: now,
    status: candidate.status === "Hired" ? "Onboarding" : candidate.status || "Onboarding",
    movementStage: "Onboarding",
    archived: false,
    archivedAt: "",
    nextAction: complete ? "Complete Process and Archive" : candidate.nextAction,
    focusCompletedAt: complete ? now : candidate.focusCompletedAt,
    focusCompletedKind: complete ? "Onboarding completion verified" : candidate.focusCompletedKind,
  };
}

export function buildCompleteProcessArchivePatch(candidate = {}, now = new Date().toISOString()) {
  return {
    status: "Archived",
    archived: true,
    archivedAt: now,
    finalArchiveDate: now,
    nextAction: "",
    archiveOutcome: candidate.archiveOutcome || "Hired",
    archiveReason: candidate.archiveReason || "Hired and onboarding complete",
    finalCandidateOutcome: "Hired",
    candidateMadeItThroughProcess: "Yes",
    hiredAt: candidate.hiredAt || candidate.hireRecord?.hiredAt || "",
    hireRecord: candidate.hireRecord || null,
    hireRecords: hireRecordsForCandidate(candidate),
  };
}

export function buildWithdrawalArchivePatch(candidate = {}, reason = "", notes = "", now = new Date().toISOString()) {
  return {
    status: "Archived",
    archived: true,
    archivedAt: now,
    finalArchiveDate: now,
    nextAction: "",
    reportTag: "Archived",
    archiveOutcome: "Candidate withdrew",
    archiveReason: `Candidate withdrew - ${reason}`,
    withdrawalReason: reason,
    withdrawalNotes: notes,
    finalCandidateOutcome: "Candidate Withdrew",
    outcomeDate: now,
    candidateDropOffReason: reason,
    candidateMadeItThroughProcess: "No",
  };
}

export function interviewSignatureFrom(candidate = {}, draft = {}) {
  const date = draft.interviewDate || candidate.interviewDate || candidate.facilityInterviewDate || candidate.bookingRecord?.interviewDate || "";
  const time = draft.interviewStartTime || draft.interviewTime || candidate.interviewTime || candidate.facilityInterviewTime || candidate.bookingRecord?.interviewStartTime || "";
  const source = draft.bookingSource || candidate.bookingSource || candidate.bookingRecord?.bookingSource || "";
  return `${date}|${time}|${source}`;
}

export function buildInterviewSchedulePatch(candidate = {}, draft = {}, options = {}) {
  const now = options.now || new Date().toISOString();
  const signature = interviewSignatureFrom(candidate, draft);
  const previousSignature = candidate.interviewScheduleSignature || "";
  return {
    status: "Interview Scheduled",
    movementStage: "Interview",
    reportTag: "Interview",
    nextAction: options.nextAction || "Send interview reminder",
    bookingStatus: options.bookingStatus || "Booked",
    interviewDate: draft.interviewDate || candidate.interviewDate || "",
    interviewTime: draft.interviewStartTime || draft.interviewTime || candidate.interviewTime || "",
    interviewScheduledAt: candidate.interviewScheduledAt || now,
    atsUpdatePending: true,
    interviewScheduleSignature: signature,
    shouldWriteHistory: Boolean(signature && signature !== previousSignature),
  };
}
