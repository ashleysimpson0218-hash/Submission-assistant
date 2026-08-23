import { ACTION_STATES, normalizeReviewedCommunicationRecord } from "./submissionCommunicationActions";

export const CANDIDATE_READY_PACKAGE_SCHEMA_VERSION = 1;
export const SUPPORTED_CANDIDATE_READY_PACKAGE_SCHEMA_VERSIONS = Object.freeze([
  CANDIDATE_READY_PACKAGE_SCHEMA_VERSION,
]);
export const CANDIDATE_READY_FACILITY_SUBMISSION_PURPOSE = "candidate-ready-facility-submission";

const text = (value) => String(value ?? "").trim();

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value));
}

function uniqueEmails(values = []) {
  const normalizedValues = Array.isArray(values)
    ? values
    : values == null
      ? []
      : [values];
  const seen = new Set();
  return normalizedValues
    .flatMap((value) => String(value ?? "").split(/[;,]/))
    .map(text)
    .filter((email) => {
      const key = email.toLowerCase();
      if (!validEmail(email) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function packageValidationError(code, message) {
  return { code, message };
}

function validateExactIdentifiers(values, expectedId, missingCode, mismatchCode, label) {
  const identifiers = values.map(text).filter(Boolean);
  if (!identifiers.length) {
    return packageValidationError(missingCode, `The saved Candidate Ready package has no stable ${label} identity.`);
  }
  if (!text(expectedId) || identifiers.some((identifier) => identifier !== text(expectedId))) {
    return packageValidationError(mismatchCode, `The saved Candidate Ready package belongs to a different ${label}.`);
  }
  return null;
}

export function validateCandidateReadyFacilitySubmissionPackage(savedPackage, expectedContext = {}) {
  const candidate = expectedContext.candidate || {};
  const requisition = expectedContext.requisition || {};
  const facility = expectedContext.facility || {};
  const packageData = savedPackage;
  if (!packageData || typeof packageData !== "object" || Array.isArray(packageData)) {
    const errors = [packageValidationError("REVIEWED_PACKAGE_MISSING", "The reviewed Candidate Ready communication package is no longer available.")];
    return { valid: false, reasonCode: errors[0].code, errors };
  }

  const errors = [];
  const snapshot = packageData.snapshot && typeof packageData.snapshot === "object" && !Array.isArray(packageData.snapshot)
    ? packageData.snapshot
    : {};
  const resolvedCandidateId = text(candidate.id);
  const resolvedRequisitionId = text(requisition.id || requisition.requisitionId);
  const resolvedFacilityId = text(facility.id || facility.facilityId);
  const facilityEmail = packageData.rendered?.facilityEmail;
  const facilityRecipients = packageData.recipients?.facility;
  const facilityTemplate = packageData.templateReferences?.facilitySubmission;
  const facilityReleaseCondition = text(packageData.releaseConditions?.facilitySubmission);
  const facilityActionState = text(packageData.actionStates?.facilitySubmission);
  const declaredPurpose = text(packageData.purpose);

  if (!Object.prototype.hasOwnProperty.call(packageData, "schemaVersion")) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_SCHEMA_MISSING", "The saved Candidate Ready package has no explicit schema version."));
  } else if (!SUPPORTED_CANDIDATE_READY_PACKAGE_SCHEMA_VERSIONS.includes(packageData.schemaVersion)) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_SCHEMA_UNSUPPORTED", "The saved Candidate Ready package uses an unsupported schema version."));
  }
  if (declaredPurpose !== CANDIDATE_READY_FACILITY_SUBMISSION_PURPOSE) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_PURPOSE_INVALID", "The saved object is not a Candidate Ready facility-submission package."));
  }
  if (!text(packageData.snapshotHash)) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_HASH_MISSING", "The saved Candidate Ready package has no stable snapshot hash."));
  }

  const requisitionIdentityError = validateExactIdentifiers(
    [snapshot.requisition?.requisitionId, snapshot.requisition?.id],
    resolvedRequisitionId,
    "REVIEWED_PACKAGE_REQUISITION_MISSING",
    "REVIEWED_PACKAGE_REQUISITION_MISMATCH",
    "requisition"
  );
  if (requisitionIdentityError) errors.push(requisitionIdentityError);

  const facilityIdentityError = validateExactIdentifiers(
    [snapshot.facility?.facilityId, snapshot.facility?.id, snapshot.requisition?.facilityId],
    resolvedFacilityId,
    "REVIEWED_PACKAGE_FACILITY_MISSING",
    "REVIEWED_PACKAGE_FACILITY_MISMATCH",
    "facility"
  );
  if (facilityIdentityError) errors.push(facilityIdentityError);

  const candidateIdentityError = validateExactIdentifiers(
    [snapshot.intake?.candidateId, snapshot.intake?.trackerId, snapshot.candidate?.candidateId, snapshot.candidate?.id],
    resolvedCandidateId,
    "REVIEWED_PACKAGE_CANDIDATE_MISSING",
    "REVIEWED_PACKAGE_CANDIDATE_MISMATCH",
    "candidate"
  );
  if (candidateIdentityError) errors.push(candidateIdentityError);

  if (!facilityEmail || typeof facilityEmail !== "object" || Array.isArray(facilityEmail)) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_FACILITY_EMAIL_MISSING", "The saved Candidate Ready package has no facility-submission email."));
  } else if (!text(facilityEmail.subject) || !text(facilityEmail.body)) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_FACILITY_EMAIL_INCOMPLETE", "The saved facility-submission email must include its original subject and body."));
  } else if (text(facilityEmail.templateKey) !== "hiringManager" || text(facilityEmail.releaseCondition) !== "candidateReadyConfirmed") {
    errors.push(packageValidationError("REVIEWED_PACKAGE_FACILITY_EMAIL_PURPOSE_INVALID", "The saved email is not the supported Candidate Ready facility-submission artifact."));
  }

  if (!facilityRecipients || typeof facilityRecipients !== "object" || Array.isArray(facilityRecipients) || !uniqueEmails(facilityRecipients.to).length) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_FACILITY_RECIPIENT_MISSING", "The saved Candidate Ready package has no valid facility recipient context."));
  }

  const templateVersion = facilityTemplate?.version;
  const validTemplateVersion = typeof templateVersion === "number"
    && Number.isInteger(templateVersion)
    && templateVersion >= 0;
  if (!facilityTemplate || typeof facilityTemplate !== "object" || Array.isArray(facilityTemplate)
    || !text(facilityTemplate.templateKey)
    || !text(facilityTemplate.id)
    || !validTemplateVersion) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_TEMPLATE_METADATA_MISSING", "The saved Candidate Ready package has no valid facility-submission template metadata."));
  }
  if (facilityTemplate && typeof facilityTemplate === "object" && !Array.isArray(facilityTemplate) && text(facilityTemplate.templateKey) !== "hiringManager") {
    errors.push(packageValidationError("REVIEWED_PACKAGE_TEMPLATE_PURPOSE_INVALID", "The saved template reference is not a facility-submission template."));
  }
  if (facilityReleaseCondition !== "candidateReadyConfirmed") {
    errors.push(packageValidationError("REVIEWED_PACKAGE_RELEASE_METADATA_INVALID", "The saved Candidate Ready package has invalid facility-submission release metadata."));
  }
  if (facilityActionState !== ACTION_STATES.facilityReady) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_ACTION_STATE_INVALID", "The saved Candidate Ready package is not in the reviewable facility-submission state."));
  }
  const tokenMetadataValid = Array.isArray(packageData.unresolvedTokens) && Array.isArray(packageData.restrictedTokens);
  if (!tokenMetadataValid) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_TOKEN_METADATA_INVALID", "The saved Candidate Ready package has invalid communication-token metadata."));
  } else if (packageData.unresolvedTokens.length || packageData.restrictedTokens.length) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_CONTENT_UNRESOLVED", "The saved Candidate Ready package contains unresolved or restricted communication content."));
  }

  const normalized = normalizeReviewedCommunicationRecord(candidate);
  if (normalized.communicationActionStates?.facilitySubmission === ACTION_STATES.facilitySent || text(candidate.facilitySubmissionSentAt)) {
    errors.push(packageValidationError("REVIEWED_PACKAGE_ALREADY_SENT", "The saved Candidate Ready facility submission has already been recorded as sent."));
  }
  return { valid: errors.length === 0, reasonCode: errors[0]?.code || "", errors };
}
