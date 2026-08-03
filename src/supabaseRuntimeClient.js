import { createClient } from "@supabase/supabase-js";

let currentKey = "";
let currentClient = null;

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(String(key)) ?? null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: (key) => values.delete(String(key)),
  };
}

export function getRuntimeSupabaseClient(config = {}) {
  if (!config.ok || !config.supabaseUrl || !config.supabasePublishableKey) return null;
  const acceptanceMode = config.acceptanceMode === true;
  const key = `${config.environment}|${config.projectRef}|${config.supabaseUrl}|${config.supabasePublishableKey}|acceptance:${acceptanceMode}`;
  if (currentClient && currentKey === key) return currentClient;
  currentKey = key;
  currentClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: !acceptanceMode,
      autoRefreshToken: !acceptanceMode,
      detectSessionInUrl: !acceptanceMode,
      storage: acceptanceMode ? createMemoryStorage() : undefined,
      storageKey: acceptanceMode ? `welcomeflow-acceptance-memory-${config.projectRef}` : `welcomeflow-auth-${config.projectRef}`,
    },
  });
  return currentClient;
}

export function resetRuntimeSupabaseClientForTests() {
  currentKey = "";
  currentClient = null;
}
