import React, { useMemo, useState } from "react";
import { readRuntimeConfig } from "../runtimeConfig";
import { getRuntimeSupabaseClient } from "../supabaseRuntimeClient";
import WorkflowPanel from "./WorkflowPanel";
export default function WorkflowPortal() {
  const runtime = useMemo(() => readRuntimeConfig(), []),
    client = useMemo(() => getRuntimeSupabaseClient(runtime), [runtime]);
  const query = new URLSearchParams(window.location.search),
    token = query.get("token") || "",
    workspaceId = query.get("workspace") || runtime.workspaceId;
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [version, setVersion] = useState(0),
    [busy, setBusy] = useState(false);
  if (process.env.REACT_APP_WELCOMEFLOW_WORKFLOW_ENABLED !== "true")
    return (
      <main className="wf-portal">
        <h1>Interview work is not enabled in this environment.</h1>
      </main>
    );
  return (
    <main className="wf-portal">
      <h1>WelcomeFlow</h1>
      {!token ? (
        <details className="wf-workflow">
          <summary>Sign in or change account</summary>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const result = await client.auth.signInWithPassword({
                  email,
                  password,
                });
                setPassword("");
                if (result.error) setMessage("Sign-in could not be verified.");
                else setVersion((v) => v + 1);
              } catch {
                setMessage("Sign-in is temporarily unavailable.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Email
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button disabled={busy}>Sign in</button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await client.auth.signOut();
                setVersion((v) => v + 1);
              }}
            >
              Sign out
            </button>
            {message ? <p role="alert">{message}</p> : null}
          </form>
        </details>
      ) : null}
      <WorkflowPanel
        key={version}
        client={client}
        workspaceId={workspaceId}
        token={token}
      />
    </main>
  );
}
