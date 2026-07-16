const STATUS_READY = "Ready";
const STATUS_NEEDS_REVIEW = "Needs Review";
const STATUS_BLOCKED = "Blocked";

export const COMMUNICATION_READINESS_STATUSES = [STATUS_READY, STATUS_NEEDS_REVIEW, STATUS_BLOCKED];

export const COMMUNICATION_READINESS_FILTERS = [
  "All",
  STATUS_READY,
  STATUS_NEEDS_REVIEW,
  STATUS_BLOCKED,
  "Missing Benefits Eligibility",
  "Missing Employment Type",
  "Missing Hours or FTE",
  "Missing Shift",
  "Missing Schedule",
  "Missing Facility Contact",
  "Position Setup Issues",
  "Active Requisitions",
  "Archived or Inactive Requisitions",
];

function safeRecords(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  return [];
}

function normalized(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function displayValue(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  const clean = String(value ?? "").trim();
  return clean || "Blank";
}

function isValidEmail(value = "") {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());
}

function cleanEmailList(value = "") {
  return Array.from(new Set(String(value || "").split(/[;,\s]+/).map((item) => item.trim()).filter(isValidEmail)));
}

function isActiveStatus(status = "") {
  return normalized(status || "Active") === "active";
}

function isRecognizedEmploymentType(value = "") {
  return ["full-time", "full time", "part-time", "part time", "prn", "contract"].includes(normalized(value));
}

function employmentTypeFamily(value = "") {
  const clean = normalized(value);
  if (clean === "full-time" || clean === "full time") return "Full-time";
  if (clean === "part-time" || clean === "part time") return "Part-time";
  if (clean === "prn") return "PRN";
  if (clean === "contract") return "Contract";
  return "";
}

function highestStatus(statuses = []) {
  if (statuses.includes(STATUS_BLOCKED)) return STATUS_BLOCKED;
  if (statuses.includes(STATUS_NEEDS_REVIEW)) return STATUS_NEEDS_REVIEW;
  return STATUS_READY;
}

function findFacility(settings = {}, facilityName = "") {
  const target = normalized(facilityName);
  return safeRecords(settings.sites).find((site) => normalized(site.siteName || site.facility || site.location) === target) || null;
}

function findPosition(settings = {}, positionTitle = "") {
  const target = normalized(positionTitle);
  return safeRecords(settings.roles).find((role) => normalized(role.positionTitle || role.position || role.title) === target) || null;
}

function facilityRecipientResolution(settings = {}, facilityName = "") {
  const site = findFacility(settings, facilityName);
  if (!site) {
    return { site: null, emails: [], sourcePath: "settings.sites", ready: false };
  }
  const additional = safeRecords(site.additionalHiringManagers).map((manager) => manager.email);
  const emails = cleanEmailList([site.hiringManagerEmail, site.adminContactEmail, ...additional].filter(Boolean).join("; "));
  const sourcePath = "settings.sites[].hiringManagerEmail, adminContactEmail, additionalHiringManagers[].email";
  return { site, emails, sourcePath, ready: emails.length > 0 };
}

function templateStatus(settings = {}, key = "") {
  const template = (settings.templates || {})[key] || {};
  const status = normalized(template.status || "Active");
  return { template, active: status !== "inactive", sourcePath: `settings.templates.${key}` };
}

function templateRequiresCompensation(settings = {}) {
  return ["hiringManager", "candidateConfirmation"].some((key) => {
    const { template, active } = templateStatus(settings, key);
    if (!active) return false;
    return /rate|compensation|pay|salary/i.test(`${template.subject || ""} ${template.body || ""}`);
  });
}

function hasRateConfiguration(settings = {}, req = {}) {
  const rules = safeRecords(settings.compensationStructure?.rules);
  const position = normalized(req.positionTitle);
  return Boolean(
    req.payNotes ||
    req.rateRange ||
    req.rateValue ||
    rules.some((rule) => normalized(rule.positionTitle) === position)
  );
}

function sourceIssue({
  facility,
  req,
  position,
  issueLevel,
  field,
  existingValue,
  explanation,
  recommendedAction,
  updateLocation,
  source,
}) {
  return {
    facility: facility || req?.siteName || "No facility",
    reqNumber: req?.reqNumber || "",
    uniqueId: req?.uniqueIdNumber || "",
    position: position || req?.positionTitle || "",
    employmentType: req?.employmentType || "",
    issueLevel,
    status: issueLevel,
    field,
    existingValue: displayValue(existingValue),
    explanation,
    recommendedAction,
    updateLocation,
    source,
    activeState: isActiveStatus(req?.status) ? "Active" : "Archived or Inactive",
  };
}

export function normalizeBenefitsEligibilityForAudit(value) {
  if (value === true) return "yes";
  if (value === false) return "no";
  const clean = normalized(value);
  if (!clean) return "unknown";
  if (["yes", "y", "true", "eligible", "benefits eligible", "with benefits"].includes(clean)) return "yes";
  if (["no", "n", "false", "not eligible", "ineligible", "without benefits", "no benefits"].includes(clean)) return "no";
  return "unknown";
}

export function evaluateRequisitionCommunicationReadiness({
  facility,
  position,
  requisition,
  contacts,
  templates,
  settings = {},
} = {}) {
  const req = requisition || {};
  const workingSettings = { ...settings, contacts, templates };
  const facilityName = req.siteName || req.facility || facility?.siteName || facility?.facility || "";
  const positionTitle = req.positionTitle || req.position || position?.positionTitle || "";
  const issues = [];
  const addIssue = (issue) => issues.push(sourceIssue({ facility: facilityName, req, position: positionTitle, ...issue }));
  const recipient = facilityRecipientResolution(workingSettings, facilityName);
  const benefits = normalizeBenefitsEligibilityForAudit(req.benefitsEligible);
  const employmentFamily = employmentTypeFamily(req.employmentType);
  const fte = req.fte;
  const weeklyHours = req.weeklyHours ?? req.hoursPerWeek;
  const shift = req.shiftPreference || req.shift;
  const schedule = req.workSchedule || req.schedule;
  const contractDuration = req.contractDuration || req.contractLength;

  if (!facilityName) {
    addIssue({
      issueLevel: STATUS_BLOCKED,
      field: "Facility",
      existingValue: facilityName,
      explanation: "Facility is missing. Update the existing requisition.",
      recommendedAction: "Add the facility on the existing requisition.",
      updateLocation: "Existing requisition",
      source: "Requisition",
    });
  } else if (!recipient.site) {
    addIssue({
      issueLevel: STATUS_BLOCKED,
      field: "Facility",
      existingValue: facilityName,
      explanation: `${facilityName}: Facility record was not found for this requisition. Update Facility & Position Setup.`,
      recommendedAction: "Link this requisition to an existing facility or add the facility.",
      updateLocation: "Facility & Position Setup",
      source: "Facility",
    });
  }

  if (!positionTitle) {
    addIssue({
      issueLevel: STATUS_BLOCKED,
      field: "Position",
      existingValue: positionTitle,
      explanation: `${facilityName || "No facility"}: Position is missing. Update the existing requisition.`,
      recommendedAction: "Add the position title on the existing requisition.",
      updateLocation: "Existing requisition",
      source: "Requisition",
    });
  }

  if (!req.reqNumber) {
    addIssue({
      issueLevel: STATUS_BLOCKED,
      field: "Req number",
      existingValue: req.reqNumber,
      explanation: `${facilityName || "No facility"}, ${positionTitle || "No position"}: Req number is missing. Update the existing requisition.`,
      recommendedAction: "Add the req number.",
      updateLocation: "Existing requisition",
      source: "Requisition",
    });
  }

  if (!req.uniqueIdNumber) {
    addIssue({
      issueLevel: STATUS_NEEDS_REVIEW,
      field: "Unique ID",
      existingValue: req.uniqueIdNumber,
      explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Unique ID is missing. Update the existing requisition if this communication needs it.`,
      recommendedAction: "Add the unique ID if it is used in routing, ATS notes, or submission emails.",
      updateLocation: "Existing requisition",
      source: "Requisition",
    });
  }

  if (!isRecognizedEmploymentType(req.employmentType)) {
    addIssue({
      issueLevel: STATUS_BLOCKED,
      field: "Employment type",
      existingValue: req.employmentType,
      explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Employment type is missing or not recognized. Update the existing requisition.`,
      recommendedAction: "Use Full-time, Part-time, PRN, or Contract.",
      updateLocation: "Existing requisition",
      source: "Requisition",
    });
  }

  if (benefits === "unknown") {
    addIssue({
      issueLevel: STATUS_BLOCKED,
      field: "Benefits eligibility",
      existingValue: req.benefitsEligible,
      explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Benefits eligibility is Unknown. Update the existing requisition.`,
      recommendedAction: "Confirm whether this requisition is benefits eligible.",
      updateLocation: "Existing requisition",
      source: "Requisition",
    });
  }

  if (!recipient.ready) {
    addIssue({
      issueLevel: STATUS_BLOCKED,
      field: "Facility submission contact",
      existingValue: recipient.emails.join("; "),
      explanation: `${facilityName || "No facility"}: Facility submission contact email is missing or invalid. Update Facility Contacts.`,
      recommendedAction: "Add a hiring manager, administrative contact, or additional manager email.",
      updateLocation: "Facility Contacts",
      source: "Recipient Routing",
    });
  }

  if (["Full-time", "Part-time"].includes(employmentFamily)) {
    if (!fte && !weeklyHours) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "FTE / weekly hours",
        existingValue: `${displayValue(fte)} / ${displayValue(weeklyHours)}`,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: FTE and weekly hours are both missing. Update either field on the existing requisition.`,
        recommendedAction: "Add FTE or weekly hours.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
    if (!shift) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "Shift",
        existingValue: shift,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Shift is missing. Update the existing requisition.`,
        recommendedAction: "Add the shift.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
    if (!schedule) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "Work schedule",
        existingValue: schedule,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Work schedule is missing. Update the existing requisition.`,
        recommendedAction: "Add the work schedule.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
  }

  if (employmentFamily === "PRN") {
    const hasPrnSchedule = schedule || /prn|as needed/i.test(`${req.employmentType || ""} ${shift || ""} ${req.workType || ""}`);
    if (!hasPrnSchedule) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "Work schedule",
        existingValue: schedule || shift,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: PRN schedule or As Needed designation is missing. Update the existing requisition.`,
        recommendedAction: "Add PRN, As Needed, or schedule language.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
    if (!shift) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "Shift",
        existingValue: shift,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Shift is missing. This is a warning for PRN requisitions.`,
        recommendedAction: "Add shift if it is known.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
  }

  if (employmentFamily === "Contract") {
    if (!contractDuration) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "Contract duration",
        existingValue: contractDuration,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Contract duration is missing. Update the existing requisition.`,
        recommendedAction: "Add the contract duration.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
    if (!schedule) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "Work schedule",
        existingValue: schedule,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Contract schedule is missing. Update the existing requisition.`,
        recommendedAction: "Add the contract schedule.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
    if (!shift) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: "Shift",
        existingValue: shift,
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Shift is missing. Update the existing requisition.`,
        recommendedAction: "Add the shift.",
        updateLocation: "Existing requisition",
        source: "Requisition",
      });
    }
  }

  const role = position || findPosition(workingSettings, positionTitle);
  const reqQuestions = safeRecords(req.screeningQuestions);
  const roleHasRequirements = Boolean(
    role?.requiresLicense ||
    role?.requiresCpr ||
    role?.requiresCredentialing ||
    role?.requiresDegree ||
    role?.requiresBackground ||
    role?.requiresDrugScreen ||
    role?.requiresFacilityClearance ||
    role?.requiresManagerApproval ||
    req.requiredInfo ||
    req.credentialRequirements ||
    reqQuestions.length
  );
  if (positionTitle && !role && !roleHasRequirements) {
    addIssue({
      issueLevel: STATUS_NEEDS_REVIEW,
      field: "Position requirements",
      existingValue: positionTitle,
      explanation: `${facilityName || "No facility"}, ${positionTitle}: No position requirement or screening configuration was found. Review the existing position setup.`,
      recommendedAction: "Review or add position requirements or screening questions.",
      updateLocation: "Position Requirements",
      source: "Position",
    });
  }

  if (templateRequiresCompensation(workingSettings) && !hasRateConfiguration(workingSettings, req)) {
    addIssue({
      issueLevel: STATUS_NEEDS_REVIEW,
      field: "Compensation configuration",
      existingValue: req.payNotes || "",
      explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: Compensation configuration needs review.`,
      recommendedAction: "Review rate rules, rate range, or pay notes for this position.",
      updateLocation: "Rate Rules",
      source: "Template",
    });
  }

  ["hiringManager", "candidateConfirmation", "atsUpdate"].forEach((key) => {
    const status = templateStatus(workingSettings, key);
    if (!status.active) {
      addIssue({
        issueLevel: STATUS_NEEDS_REVIEW,
        field: `${key} template`,
        existingValue: "Inactive",
        explanation: `${facilityName || "No facility"}, Req ${req.reqNumber || "N/A"}, ${positionTitle || "No position"}: ${key} template is inactive. Review Email & Text Templates if this communication should generate.`,
        recommendedAction: "Review active submission templates.",
        updateLocation: "Email & Text Templates",
        source: "Template",
      });
    }
  });

  return {
    status: highestStatus(issues.map((issue) => issue.issueLevel)),
    issues,
    benefitsEligibility: benefits,
    recipientSource: recipient.sourcePath,
    requisition: req,
  };
}

function facilitySetupIssues(settings = {}, facilityName = "") {
  const issues = [];
  const recipient = facilityRecipientResolution(settings, facilityName);
  if (!recipient.site) {
    issues.push(sourceIssue({
      facility: facilityName,
      issueLevel: STATUS_BLOCKED,
      field: "Facility",
      existingValue: facilityName,
      explanation: `${facilityName || "No facility"}: Facility record is missing. Update Facility & Position Setup.`,
      recommendedAction: "Add or link the facility.",
      updateLocation: "Facility & Position Setup",
      source: "Facility",
    }));
  } else if (!recipient.ready) {
    issues.push(sourceIssue({
      facility: facilityName,
      issueLevel: STATUS_BLOCKED,
      field: "Facility submission contact",
      existingValue: "",
      explanation: `${facilityName}: The facility submission contact email is missing. Update Facility Contacts.`,
      recommendedAction: "Add a valid hiring manager, administrative contact, or additional manager email.",
      updateLocation: "Facility Contacts",
      source: "Facility Contact",
    }));
  }
  return issues;
}

export function buildFacilityCommunicationReadinessReport(workspace = {}, options = {}) {
  const settings = workspace.settings || workspace || {};
  const includeInactiveArchived = Boolean(options.includeInactiveArchived);
  const facilities = safeRecords(settings.sites);
  const requisitions = safeRecords(settings.requisitions).filter((req) => includeInactiveArchived || isActiveStatus(req.status));
  const facilityNames = Array.from(new Set([
    ...facilities.filter((site) => includeInactiveArchived || isActiveStatus(site.status)).map((site) => site.siteName || site.facility || site.location).filter(Boolean),
    ...requisitions.map((req) => req.siteName || req.facility).filter(Boolean),
  ])).sort((a, b) => a.localeCompare(b));

  const facilityReports = facilityNames.map((facilityName) => {
    const facility = findFacility(settings, facilityName);
    const facilityReqs = requisitions.filter((req) => normalized(req.siteName || req.facility) === normalized(facilityName));
    const facilityIssues = facilitySetupIssues(settings, facilityName);
    const reqReports = facilityReqs.map((req) => evaluateRequisitionCommunicationReadiness({
      facility,
      position: findPosition(settings, req.positionTitle),
      requisition: req,
      contacts: settings.contacts,
      templates: settings.templates,
      settings,
    }));
    const positionIssues = reqReports.flatMap((report) => report.issues.filter((issue) => issue.source === "Position"));
    const requisitionIssues = reqReports.flatMap((report) => report.issues.filter((issue) => !["Facility", "Facility Contact", "Position"].includes(issue.source)));
    const allIssues = [...facilityIssues, ...reqReports.flatMap((report) => report.issues)];
    const readyReqs = reqReports.filter((report) => report.status === STATUS_READY).length;
    const reviewReqs = reqReports.filter((report) => report.status === STATUS_NEEDS_REVIEW).length;
    const blockedReqs = reqReports.filter((report) => report.status === STATUS_BLOCKED).length;
    return {
      facilityName,
      status: highestStatus([...facilityIssues, ...reqReports].map((item) => item.issueLevel || item.status)),
      activeRequisitionCount: facilityReqs.filter((req) => isActiveStatus(req.status)).length,
      readyRequisitions: readyReqs,
      needsReviewRequisitions: reviewReqs,
      blockedRequisitions: blockedReqs,
      unresolvedIssues: allIssues.length,
      sections: {
        facilitySetup: facilityIssues,
        positionSetup: positionIssues,
        requisitionSetup: requisitionIssues,
      },
      requisitions: reqReports,
      issues: allIssues,
    };
  });

  const allIssues = facilityReports.flatMap((facility) => facility.issues);
  const reqReports = facilityReports.flatMap((facility) => facility.requisitions);
  const summary = {
    totalActiveFacilities: facilities.filter((site) => isActiveStatus(site.status)).length,
    facilitiesReady: facilityReports.filter((facility) => facility.status === STATUS_READY).length,
    facilitiesNeedingReview: facilityReports.filter((facility) => facility.status === STATUS_NEEDS_REVIEW).length,
    facilitiesBlocked: facilityReports.filter((facility) => facility.status === STATUS_BLOCKED).length,
    totalActiveRequisitions: requisitions.filter((req) => isActiveStatus(req.status)).length,
    activeRequisitionsReady: reqReports.filter((report) => isActiveStatus(report.requisition?.status) && report.status === STATUS_READY).length,
    activeRequisitionsNeedingReview: reqReports.filter((report) => isActiveStatus(report.requisition?.status) && report.status === STATUS_NEEDS_REVIEW).length,
    activeRequisitionsBlocked: reqReports.filter((report) => isActiveStatus(report.requisition?.status) && report.status === STATUS_BLOCKED).length,
    totalUnresolvedIssues: allIssues.length,
  };

  return {
    summary,
    facilities: facilityReports,
    issues: allIssues,
    generatedAt: new Date().toISOString(),
    includeInactiveArchived,
  };
}

export function filterCommunicationReadinessReport(report = {}, { filter = "All", search = "" } = {}) {
  const query = normalized(search);
  const issueMatchesFilter = (issue) => {
    if (filter === "All") return true;
    if ([STATUS_READY, STATUS_NEEDS_REVIEW, STATUS_BLOCKED].includes(filter)) return issue.issueLevel === filter;
    if (filter === "Missing Benefits Eligibility") return normalized(issue.field).includes("benefits");
    if (filter === "Missing Employment Type") return normalized(issue.field).includes("employment type");
    if (filter === "Missing Hours or FTE") return normalized(issue.field).includes("fte") || normalized(issue.field).includes("weekly hours");
    if (filter === "Missing Shift") return normalized(issue.field).includes("shift");
    if (filter === "Missing Schedule") return normalized(issue.field).includes("schedule");
    if (filter === "Missing Facility Contact") return issue.source === "Facility Contact" || issue.source === "Recipient Routing";
    if (filter === "Position Setup Issues") return issue.source === "Position";
    if (filter === "Active Requisitions") return issue.activeState === "Active";
    if (filter === "Archived or Inactive Requisitions") return issue.activeState === "Archived or Inactive";
    return true;
  };
  const issueMatchesSearch = (issue) => {
    if (!query) return true;
    return [issue.facility, issue.position, issue.reqNumber, issue.uniqueId, issue.field, issue.explanation].join(" ").toLowerCase().includes(query);
  };

  const facilities = safeRecords(report.facilities).map((facility) => {
    const sections = Object.fromEntries(Object.entries(facility.sections || {}).map(([key, issues]) => [
      key,
      safeRecords(issues).filter((issue) => issueMatchesFilter(issue) && issueMatchesSearch(issue)),
    ]));
    const issues = Object.values(sections).flat();
    const facilitySearchMatch = !query || [facility.facilityName, facility.status].join(" ").toLowerCase().includes(query);
    return {
      ...facility,
      sections,
      issues,
      hiddenByFilter: !issues.length && !(filter === STATUS_READY && facility.status === STATUS_READY) && !facilitySearchMatch,
    };
  }).filter((facility) => !facility.hiddenByFilter);
  const issues = facilities.flatMap((facility) => facility.issues);
  return { ...report, facilities, issues };
}

export function communicationReadinessIssuesToCsv(issues = []) {
  const columns = [
    "Facility",
    "Req Number",
    "Unique ID",
    "Position",
    "Employment Type",
    "Issue Level",
    "Status",
    "Field",
    "Existing Value",
    "Recommended Action",
    "Update Location",
    "Active or Archived",
  ];
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = safeRecords(issues).map((issue) => [
    issue.facility,
    issue.reqNumber,
    issue.uniqueId,
    issue.position,
    issue.employmentType || "",
    issue.issueLevel,
    issue.status,
    issue.field,
    issue.existingValue,
    issue.recommendedAction,
    issue.updateLocation,
    issue.activeState,
  ]);
  return [columns, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
