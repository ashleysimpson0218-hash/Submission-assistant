import {
  buildFacilityCommunicationReadinessReport,
  filterCommunicationReadinessReport,
  normalizeBenefitsEligibilityForAudit,
} from "./communicationReadiness";

const baseSettings = {
  sites: [
    {
      id: "site-1",
      siteName: "GDCP",
      status: "Active",
      hiringManagerEmail: "manager@example.com",
    },
  ],
  roles: [
    {
      id: "role-1",
      positionTitle: "Licensed Practical Nurse",
      requiresLicense: true,
      requiresCpr: true,
    },
  ],
  contacts: [
    { id: "contact-1", department: "Human Resources", name: "HR Inbox", email: "hr@example.com", status: "Active" },
  ],
  templates: {
    hiringManager: { status: "Active", subject: "Candidate", body: "Candidate update" },
    candidateConfirmation: { status: "Active", subject: "Candidate", body: "Candidate update" },
    atsUpdate: { status: "Active", subject: "ATS", body: "ATS note" },
  },
  compensationStructure: {
    rules: [{ id: "rate-1", positionTitle: "Licensed Practical Nurse", baseAmount: "$31/hr" }],
  },
};

function settingsWithReq(req) {
  return {
    ...baseSettings,
    requisitions: [
      {
        id: "req-1",
        reqNumber: "79060",
        uniqueIdNumber: "34039",
        siteName: "GDCP",
        positionTitle: "Licensed Practical Nurse",
        employmentType: "Full-time",
        benefitsEligible: true,
        fte: "1.0",
        shiftPreference: "Day",
        workSchedule: "Monday-Friday",
        status: "Active",
        ...req,
      },
    ],
  };
}

function firstReqReport(settings) {
  return buildFacilityCommunicationReadinessReport({ settings }).facilities[0].requisitions[0];
}

test("normalizes benefits eligibility for audit without inferring from employment type", () => {
  expect(normalizeBenefitsEligibilityForAudit(true)).toBe("yes");
  expect(normalizeBenefitsEligibilityForAudit(false)).toBe("no");
  expect(normalizeBenefitsEligibilityForAudit("eligible")).toBe("yes");
  expect(normalizeBenefitsEligibilityForAudit("not eligible")).toBe("no");
  expect(normalizeBenefitsEligibilityForAudit("")).toBe("unknown");
  expect(normalizeBenefitsEligibilityForAudit(undefined)).toBe("unknown");
  expect(normalizeBenefitsEligibilityForAudit("maybe")).toBe("unknown");
});

test("PRN with explicit benefits yes and As Needed schedule is valid", () => {
  const report = firstReqReport(settingsWithReq({ employmentType: "PRN", benefitsEligible: "yes", fte: "", weeklyHours: "", shiftPreference: "As needed", workSchedule: "" }));
  expect(report.status).toBe("Ready");
  expect(report.issues.find((issue) => /weekly hours/i.test(issue.field))).toBeUndefined();
});

test("PRN with explicit benefits no and As Needed schedule is valid", () => {
  const report = firstReqReport(settingsWithReq({ employmentType: "PRN", benefitsEligible: "no", fte: "", weeklyHours: "", shiftPreference: "As needed", workSchedule: "" }));
  expect(report.status).toBe("Ready");
});

test("PRN without weekly hours is not flagged for missing weekly hours", () => {
  const report = firstReqReport(settingsWithReq({ employmentType: "PRN", benefitsEligible: true, fte: "", weeklyHours: "", shiftPreference: "As needed", workSchedule: "" }));
  expect(report.issues.map((issue) => issue.field)).not.toContain("FTE / weekly hours");
});

test("Full-time with benefits no is valid", () => {
  const report = firstReqReport(settingsWithReq({ benefitsEligible: false }));
  expect(report.status).toBe("Ready");
});

test("Full-time with benefits yes is valid", () => {
  const report = firstReqReport(settingsWithReq({ benefitsEligible: true }));
  expect(report.status).toBe("Ready");
});

test("Full-time with benefits unknown is blocked", () => {
  const report = firstReqReport(settingsWithReq({ benefitsEligible: "" }));
  expect(report.status).toBe("Blocked");
  expect(report.issues.some((issue) => issue.field === "Benefits eligibility")).toBe(true);
});

test("Part-time with benefits yes and 24 weekly hours is valid", () => {
  const report = firstReqReport(settingsWithReq({ employmentType: "Part-time", benefitsEligible: true, fte: "", weeklyHours: "24" }));
  expect(report.status).toBe("Ready");
});

test("Contract with missing duration is Needs Review", () => {
  const report = firstReqReport(settingsWithReq({ employmentType: "Contract", benefitsEligible: true, contractDuration: "" }));
  expect(report.status).toBe("Needs Review");
  expect(report.issues.some((issue) => issue.field === "Contract duration")).toBe(true);
});

test("missing facility contact creates a facility-level issue", () => {
  const settings = settingsWithReq({});
  settings.sites = [{ ...settings.sites[0], hiringManagerEmail: "", adminContactEmail: "", additionalHiringManagers: [] }];
  const report = buildFacilityCommunicationReadinessReport({ settings });
  expect(report.facilities[0].sections.facilitySetup.some((issue) => issue.source === "Facility Contact")).toBe(true);
});

test("missing position creates a requisition-level blocker", () => {
  const report = firstReqReport(settingsWithReq({ positionTitle: "" }));
  expect(report.status).toBe("Blocked");
  expect(report.issues.some((issue) => issue.field === "Position")).toBe(true);
});

test("archived requisitions are excluded by default", () => {
  const settings = settingsWithReq({ status: "Archived" });
  const report = buildFacilityCommunicationReadinessReport({ settings });
  expect(report.summary.totalActiveRequisitions).toBe(0);
  expect(report.facilities[0]?.requisitions || []).toHaveLength(0);
});

test("rehire candidate type remains unchanged because audit only reads requisitions", () => {
  const workspace = { settings: settingsWithReq({}), tracker: [{ id: "cand-1", candidateType: "Rehire", status: "Submitted" }] };
  buildFacilityCommunicationReadinessReport(workspace);
  expect(workspace.tracker[0].candidateType).toBe("Rehire");
});

test("audit normalization does not mutate the workspace", () => {
  const settings = settingsWithReq({ benefitsEligible: "" });
  const original = JSON.stringify(settings);
  buildFacilityCommunicationReadinessReport({ settings });
  expect(JSON.stringify(settings)).toBe(original);
});

test("opening the report does not save workspace data", () => {
  const setItem = jest.spyOn(Storage.prototype, "setItem");
  buildFacilityCommunicationReadinessReport({ settings: settingsWithReq({}) });
  expect(setItem).not.toHaveBeenCalled();
  setItem.mockRestore();
});

test("existing templates remain unchanged", () => {
  const settings = settingsWithReq({});
  const original = JSON.stringify(settings.templates);
  buildFacilityCommunicationReadinessReport({ settings });
  expect(JSON.stringify(settings.templates)).toBe(original);
});

test("existing candidate statuses remain unchanged", () => {
  const workspace = { settings: settingsWithReq({}), tracker: [{ id: "cand-1", status: "Onboarding" }] };
  buildFacilityCommunicationReadinessReport(workspace);
  expect(workspace.tracker[0].status).toBe("Onboarding");
});

test("existing Mark Candidate Ready behavior is not part of the read-only audit module", () => {
  const report = buildFacilityCommunicationReadinessReport({ settings: settingsWithReq({}) });
  expect(report).not.toHaveProperty("generateOutput");
  expect(report).not.toHaveProperty("markCandidateReady");
});

test("feature flag off data can be computed without changing current behavior", () => {
  const report = buildFacilityCommunicationReadinessReport({ settings: settingsWithReq({ benefitsEligible: "" }) });
  const filtered = filterCommunicationReadinessReport(report, { filter: "Missing Benefits Eligibility" });
  expect(filtered.issues).toHaveLength(1);
});
