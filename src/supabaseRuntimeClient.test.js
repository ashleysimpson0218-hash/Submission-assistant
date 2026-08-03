import { createClient } from "@supabase/supabase-js";
import { getRuntimeSupabaseClient, resetRuntimeSupabaseClientForTests } from "./supabaseRuntimeClient";

jest.mock("@supabase/supabase-js", () => ({ createClient: jest.fn(() => ({ mocked: true })) }));

const config = {
  ok: true,
  environment: "test",
  projectRef: "syntheticproject123",
  supabaseUrl: "https://syntheticproject123.supabase.co",
  supabasePublishableKey: "public-test-key",
};

afterEach(() => {
  resetRuntimeSupabaseClientForTests();
  createClient.mockClear();
  window.localStorage.clear();
});

test("acceptance client cannot consume or persist stale browser auth sessions", () => {
  window.localStorage.setItem("welcomeflow-auth-syntheticproject123", JSON.stringify({ access_token: "stale-token" }));
  getRuntimeSupabaseClient({ ...config, acceptanceMode: true });

  const options = createClient.mock.calls[0][2].auth;
  expect(options).toMatchObject({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  expect(options.storage.getItem("welcomeflow-auth-syntheticproject123")).toBeNull();
  options.storage.setItem("temporary", "session");
  expect(window.localStorage.getItem("temporary")).toBeNull();
});

test("normal runtime retains its existing browser session behavior", () => {
  getRuntimeSupabaseClient(config);
  expect(createClient.mock.calls[0][2].auth).toMatchObject({
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "welcomeflow-auth-syntheticproject123",
  });
});
