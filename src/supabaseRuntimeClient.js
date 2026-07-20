import { createClient } from "@supabase/supabase-js";

let currentKey = "";
let currentClient = null;

export function getRuntimeSupabaseClient(config = {}) {
  if (!config.ok || !config.supabaseUrl || !config.supabasePublishableKey) return null;
  const key = `${config.environment}|${config.projectRef}|${config.supabaseUrl}|${config.supabasePublishableKey}`;
  if (currentClient && currentKey === key) return currentClient;
  currentKey = key;
  currentClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: `welcomeflow-auth-${config.projectRef}`,
    },
  });
  return currentClient;
}

export function resetRuntimeSupabaseClientForTests() {
  currentKey = "";
  currentClient = null;
}
