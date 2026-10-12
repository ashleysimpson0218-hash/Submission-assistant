import React, { useEffect, useMemo, useState } from "react";
import { readRuntimeConfig } from "../runtimeConfig";
import { getRuntimeSupabaseClient } from "../supabaseRuntimeClient";
import WorkflowPanel from "./WorkflowPanel";
import CalendarConnectionPanel from "./CalendarConnectionPanel";
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
    [session, setSession] = useState(null),
    [sessionReady, setSessionReady] = useState(false),
    [passwordSaved, setPasswordSaved] = useState(false),
    [setup, setSetup] = useState(() => query.get("setup") === "password" || /(?:type=invite|type=recovery)/i.test(window.location.hash + window.location.search)),
    [newPassword, setNewPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  useEffect(() => {
    if (!client) return undefined;
    client.auth.getSession().then(({ data }) => {
      setSession(data?.session || null);
      setSessionReady(true);
    });
    const listener = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession || null);
      setSessionReady(true);
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
      {!token && passwordSaved ? (
        <section className="wf-workflow wf-password-success" aria-labelledby="password-updated-title">
          <div className="wf-success-check" aria-hidden="true">&#10003;</div>
          <h2 id="password-updated-title">Your password has been updated</h2>
          <p>Your new WelcomeFlow password is saved for {session?.user?.email || email || "this account"}.</p>
          <p>Review the account above, then continue to your interview workspace.</p>
          <button type="button" onClick={() => {
            setPasswordSaved(false);
            setMessage("");
            window.history.replaceState({}, "", "/workflow");
          }}>Continue to WelcomeFlow</button>
        </section>
      ) : null}
      {!token && setup && !passwordSaved ? (
        <form className="wf-workflow" onSubmit={async e => {
          e.preventDefault(); setBusy(true); setMessage("");
          try {
            if (newPassword !== confirmPassword) throw new Error("The passwords do not match. Re-enter both passwords.");
            const { data } = await client.auth.getSession();
            if (!data?.session) throw new Error("Open your WelcomeFlow setup email link first.");
            const { error } = await client.auth.updateUser({ password: newPassword });
            if (error) {
              if (/different from the old password/i.test(error.message || "")) {
                throw new Error("Choose a new password you have not used for this account before.");
              }
              throw new Error("Password setup could not be completed. Request a new setup link.");
            }
            setSession(data.session); setNewPassword(""); setConfirmPassword(""); setSetup(false); setPasswordSaved(true); setVersion(v => v + 1);
          } catch (error) { setMessage(error.message); }
          finally { setBusy(false); }
        }}>
          <h2>Set your WelcomeFlow password</h2>
          <label>New password<input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>
          <button disabled={busy}>Save password</button>
        </form>
      ) : null}
      {!token && !setup && !passwordSaved && !session ? (
        <details className="wf-workflow">
          <summary>Sign in</summary>
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
                else {
                  setSession(result.data?.session || null);
                  setVersion((v) => v + 1);
                }
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
                const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/workflow?setup=password` });
                if (error) {
                  setMessage(error.code === "over_email_send_rate_limit" || error.status === 429
                    ? "The email service has reached its sending limit. No setup email was sent. Please wait before requesting another link."
                    : "The setup email could not be sent. Please try again later.");
                  return;
                }
                setMessage("If this is an invited WelcomeFlow account, a setup email has been requested. Open its link to set your WelcomeFlow password.");
              } catch { setMessage("The setup email could not be requested. Please try again."); }
              finally { setBusy(false); }
            }}>Set or reset password</button>
          </form>
        </details>
      ) : null}
      {!token && sessionReady && session && !setup && !passwordSaved ? (
        <section className="wf-workflow wf-account" aria-labelledby="account-calendar-title">
          <header>
            <div>
              <h2 id="account-calendar-title">Account &amp; calendar</h2>
              <p>Signed in as {session.user?.email || "your WelcomeFlow account"}.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                await client.auth.signOut();
                setSession(null);
                setVersion((v) => v + 1);
              }}
            >
              Sign out
            </button>
          </header>
          <CalendarConnectionPanel client={client} workspaceId={workspaceId} />
        </section>
      ) : null}
      {(token || (sessionReady && session && !setup && !passwordSaved)) ? (
        <WorkflowPanel
          key={version}
          client={client}
          workspaceId={workspaceId}
          token={token}
          entry={{caseId: query.get("case") || "", action: query.get("action") || "", version: query.get("version") || ""}}
        />
      ) : null}
    </main>
  );
}
