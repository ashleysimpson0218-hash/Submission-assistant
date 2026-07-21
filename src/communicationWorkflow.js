export const COMMUNICATION_MODES = Object.freeze({
  required: "Required",
  optional: "Optional",
  off: "Off",
});

export const DEFAULT_CANDIDATE_COMMUNICATION_PLAN = "New Hire Liaison Text Only";

export const CANDIDATE_COMMUNICATION_PRESETS = Object.freeze({
  "New Hire Liaison Text Only": { candidateEmailMode: COMMUNICATION_MODES.off, candidateTextMode: COMMUNICATION_MODES.required },
  "Candidate Email and Text": { candidateEmailMode: COMMUNICATION_MODES.required, candidateTextMode: COMMUNICATION_MODES.required },
  "Candidate Text Only": { candidateEmailMode: COMMUNICATION_MODES.off, candidateTextMode: COMMUNICATION_MODES.required },
  "Candidate Email Only": { candidateEmailMode: COMMUNICATION_MODES.required, candidateTextMode: COMMUNICATION_MODES.off },
  "No Candidate Communication": { candidateEmailMode: COMMUNICATION_MODES.off, candidateTextMode: COMMUNICATION_MODES.off },
});

const validMode = (value) => Object.values(COMMUNICATION_MODES).includes(value);

export function normalizeCommunicationWorkflow(settingsOrWorkflow = {}) {
  const workflow = settingsOrWorkflow.communicationWorkflow || settingsOrWorkflow;
  const hasConfiguredPlan = Boolean(workflow.candidateCommunicationPlan || workflow.candidateEmailMode || workflow.candidateTextMode);
  if (!hasConfiguredPlan) {
    return {
      candidateCommunicationPlan: "Legacy Candidate Email",
      candidateEmailMode: COMMUNICATION_MODES.required,
      candidateTextMode: COMMUNICATION_MODES.optional,
    };
  }
  const requestedPlan = String(workflow.candidateCommunicationPlan || DEFAULT_CANDIDATE_COMMUNICATION_PLAN).trim();
  const preset = CANDIDATE_COMMUNICATION_PRESETS[requestedPlan] || CANDIDATE_COMMUNICATION_PRESETS[DEFAULT_CANDIDATE_COMMUNICATION_PLAN];
  const candidateEmailMode = validMode(workflow.candidateEmailMode) ? workflow.candidateEmailMode : preset.candidateEmailMode;
  const candidateTextMode = validMode(workflow.candidateTextMode) ? workflow.candidateTextMode : preset.candidateTextMode;
  const matchesPreset = Object.entries(CANDIDATE_COMMUNICATION_PRESETS).find(([, modes]) => modes.candidateEmailMode === candidateEmailMode && modes.candidateTextMode === candidateTextMode)?.[0];
  return {
    candidateCommunicationPlan: matchesPreset || "Custom",
    candidateEmailMode,
    candidateTextMode,
  };
}

export function applyCommunicationPlanPreset(settings = {}, plan = DEFAULT_CANDIDATE_COMMUNICATION_PLAN) {
  const preset = CANDIDATE_COMMUNICATION_PRESETS[plan];
  if (!preset) return settings;
  return { ...settings, communicationWorkflow: { candidateCommunicationPlan: plan, ...preset } };
}

export function updateCommunicationMode(settings = {}, channel = "", mode = "") {
  if (!validMode(mode) || !["candidateEmail", "candidateText"].includes(channel)) return settings;
  const current = normalizeCommunicationWorkflow(settings);
  const next = { ...current, [`${channel}Mode`]: mode };
  return { ...settings, communicationWorkflow: { ...next, candidateCommunicationPlan: "Custom" } };
}

export const communicationIsRequired = (workflow, channel) => normalizeCommunicationWorkflow(workflow)[`${channel}Mode`] === COMMUNICATION_MODES.required;
export const communicationIsOptional = (workflow, channel) => normalizeCommunicationWorkflow(workflow)[`${channel}Mode`] === COMMUNICATION_MODES.optional;
export const communicationIsOff = (workflow, channel) => normalizeCommunicationWorkflow(workflow)[`${channel}Mode`] === COMMUNICATION_MODES.off;
