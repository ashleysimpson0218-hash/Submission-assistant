import {
  COMMUNICATION_MODES,
  applyCommunicationPlanPreset,
  normalizeCommunicationWorkflow,
  updateCommunicationMode,
} from "./communicationWorkflow";

describe("candidate communication workflow", () => {
  test("new liaison plan requires text and turns candidate email off", () => {
    const settings = applyCommunicationPlanPreset({}, "New Hire Liaison Text Only");
    expect(normalizeCommunicationWorkflow(settings)).toEqual({
      candidateCommunicationPlan: "New Hire Liaison Text Only",
      candidateEmailMode: COMMUNICATION_MODES.off,
      candidateTextMode: COMMUNICATION_MODES.required,
    });
  });

  test("no candidate communication turns both channels off", () => {
    expect(normalizeCommunicationWorkflow(applyCommunicationPlanPreset({}, "No Candidate Communication"))).toMatchObject({
      candidateEmailMode: "Off",
      candidateTextMode: "Off",
    });
  });

  test("manual mode edits become a custom plan", () => {
    const settings = updateCommunicationMode(applyCommunicationPlanPreset({}, "Candidate Email and Text"), "candidateEmail", "Optional");
    expect(normalizeCommunicationWorkflow(settings)).toMatchObject({ candidateCommunicationPlan: "Custom", candidateEmailMode: "Optional", candidateTextMode: "Required" });
  });

  test("packages without a stored plan keep their legacy compatibility", () => {
    expect(normalizeCommunicationWorkflow({})).toMatchObject({ candidateEmailMode: "Required", candidateTextMode: "Optional" });
  });
});
