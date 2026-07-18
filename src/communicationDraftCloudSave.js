import { assertTestRuntime } from "./requisitionCommunicationDetails";
import { saveCommunicationDraftSafely } from "./communicationTemplateDrafts";

export const CLOUD_DRAFT_CONFLICT_ERROR = "The workspace changed while this draft was saving. Refresh and try again.";

export function preserveLatestCommunicationDrafts(outgoingSettings = {}, latestSettings = {}) {
  const settings = { ...outgoingSettings, templates: { ...(outgoingSettings.templates || {}) } };
  ["hiringManager", "candidateConfirmation", "atsUpdate"].forEach((templateKey) => {
    const outgoingRoot = outgoingSettings.templates?.[templateKey] || {};
    const latestVariants = latestSettings.templates?.[templateKey]?.draftVariants;
    const root = { ...outgoingRoot };
    if (latestVariants) root.draftVariants = latestVariants;
    else delete root.draftVariants;
    settings.templates[templateKey] = root;
  });
  if (latestSettings.communicationTemplateDrafts) {
    settings.communicationTemplateDrafts = latestSettings.communicationTemplateDrafts;
  } else {
    delete settings.communicationTemplateDrafts;
  }
  return settings;
}

export async function loadLatestDraftSettings({ client, table, workspaceId, runtime, normalizeSettings = (value) => value } = {}) {
  const guard = assertTestRuntime(runtime);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!client) return { ok: false, error: "WelcomeFlow Test storage is unavailable." };
  const { data, error } = await client.from(table).select("data,updated_at").eq("workspace_id", workspaceId).maybeSingle();
  if (error || !data?.data?.settings) return { ok: false, error: "WelcomeFlow could not load the latest draft settings." };
  return { ok: true, workspace: data.data, settings: normalizeSettings(data.data.settings), updatedAt: data.updated_at };
}

export async function saveCommunicationDraftToCloud({ client, table, workspaceId, runtime, baseline, operation, normalizeSettings, now = () => new Date().toISOString() } = {}) {
  const guard = assertTestRuntime(runtime);
  if (!guard.ok) return { ok: false, error: guard.error };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const latest = await loadLatestDraftSettings({ client, table, workspaceId, runtime, normalizeSettings });
    if (!latest.ok) return latest;
    const result = saveCommunicationDraftSafely({ ...operation, latestSettings: latest.settings, baseline, now: now() });
    if (!result.ok) return result;
    const savedAt = now();
    const payload = { ...latest.workspace, settings: result.settings, savedAt };
    const query = client.from(table)
      .update({ data: payload, updated_at: savedAt })
      .eq("workspace_id", workspaceId)
      .eq("updated_at", latest.updatedAt)
      .select("updated_at")
      .maybeSingle();
    const { data, error } = await query;
    if (!error && data?.updated_at) return { ...result, updatedAt: data.updated_at };
    if (attempt === 1) return { ok: false, error: CLOUD_DRAFT_CONFLICT_ERROR };
  }
  return { ok: false, error: CLOUD_DRAFT_CONFLICT_ERROR };
}

export async function saveWorkspacePreservingCommunicationDraftsToCloud({ client, table, workspaceId, runtime, workspaceState, normalizeSettings = (value) => value, now = () => new Date().toISOString() } = {}) {
  const guard = assertTestRuntime(runtime);
  if (!guard.ok) return { ok: false, error: guard.error };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const latest = await loadLatestDraftSettings({ client, table, workspaceId, runtime, normalizeSettings });
    if (!latest.ok) return latest;
    const savedAt = now();
    const payload = {
      ...workspaceState,
      settings: preserveLatestCommunicationDrafts(workspaceState.settings, latest.settings),
      savedAt,
    };
    const { data, error } = await client.from(table)
      .update({ data: payload, updated_at: savedAt })
      .eq("workspace_id", workspaceId)
      .eq("updated_at", latest.updatedAt)
      .select("updated_at")
      .maybeSingle();
    if (!error && data?.updated_at) return { ok: true, updatedAt: data.updated_at };
    if (attempt === 1) return { ok: false, error: CLOUD_DRAFT_CONFLICT_ERROR };
  }
  return { ok: false, error: CLOUD_DRAFT_CONFLICT_ERROR };
}
