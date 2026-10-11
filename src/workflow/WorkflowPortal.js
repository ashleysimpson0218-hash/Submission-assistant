import React, { useEffect, useMemo, useState } from "react";
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
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(() => /(?:type=invite|type=recovery)/i.test(window.location.hash)),
    [newPassword, setNewPassword] = useState("");
  useEffect(() => {
    if (!client) return undefined;
    const listener = client.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setSetup(true);
    });
    return () => listener?.data?.subscription?.unsubscribe();
  }, [client]);
  if (process.env.REACT_APP_WELCOMEFLOW_WORKFLOW_ENABLED !== "true")
    return (
      <main className="wf-portal">
        <h1>Interview work is not enabled in this environment.</h1>
      </main>
    );
  return (
    <main className="wf-portal">
      <h1>WelcomeFlow</h1>
      {message ? <p role="status">{message}</p> : null}
      {!token && setup ? (
        <form className="wf-workflow" onSubmit={async e => {
          e.preventDefault(); setBusy(true); setMessage("");
          try {
            const { data } = await client.auth.getSession();
            if (!data?.session) throw new Error("Open your WelcomeFlow setup email link first.");
            const { error } = await client.auth.updateUser({ password: newPassword });
            if (error) throw new Error("Password setup could not be completed. Request a new setup link.");
            setNewPassword(""); setSetup(false); setMessage("Your WelcomeFlow password is saved."); setVersion(v => v + 1);
          } catch (error) { setMessage(error.message); }
          finally { setBusy(false); }
        }}>
          <h2>Set your WelcomeFlow password</h2>
          <label>New password<input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
          <button disabled={busy}>Save password</button>
        </form>
      ) : null}
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
            <button type="button" disabled={busy || !email.trim()} onClick={async () => {
              setBusy(true); setMessage("");
              try {
                await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/workflow` });
                setMessage("If this is an invited WelcomeFlow account, a setup email has been requested. Open its link to set your WelcomeFlow password.");
              } catch { setMessage("The setup email could not be requested. Please try again."); }
              finally { setBusy(false); }
            }}>Set or reset password</button>
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
          </form>
        </details>
      ) : null}
      <WorkflowPanel
        key={version}
        client={client}
        workspaceId={workspaceId}
        token={token}
        entry={{caseId: query.get("case") || "", action: query.get("action") || "", version: query.get("version") || ""}}
      />
    </main>
  );
}
