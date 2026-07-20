import React, { useEffect, useMemo, useState } from "react";
import { readRuntimeConfig } from "./runtimeConfig";
import { getRuntimeSupabaseClient } from "./supabaseRuntimeClient";

const GENERIC_AUTH_ERROR = "WelcomeFlow could not verify this Owner UAT account.";

export async function verifyOwnerUatAccess(client) {
  if (!client) return false;
  const { data, error } = await client.from("welcomeflow_workspace_state").select("workspace_id").eq("workspace_id", "default").maybeSingle();
  return !error && data?.workspace_id === "default";
}

export default function OwnerUatAuthGate({ children }) {
  const config = useMemo(() => readRuntimeConfig(), []);
  const client = useMemo(() => getRuntimeSupabaseClient(config), [config]);
  const [loading, setLoading] = useState(true);
  const [authorizedSession, setAuthorizedSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [passwordSetup, setPasswordSetup] = useState(() => /(?:type=invite|type=recovery)/i.test(String(window.location.hash || window.location.search || "")));

  useEffect(() => {
    let active = true;
    async function acceptSession(session) {
      if (!active) return;
      if (!session) {
        setAuthorizedSession(null);
        setLoading(false);
        return;
      }
      const authorized = await verifyOwnerUatAccess(client);
      if (!active) return;
      if (!authorized) {
        await client.auth.signOut();
        setAuthorizedSession(null);
        setMessage(GENERIC_AUTH_ERROR);
      } else {
        setAuthorizedSession(session);
      }
      setLoading(false);
    }
    client?.auth.getSession().then(({ data }) => acceptSession(data?.session || null)).catch(() => { if (active) { setMessage(GENERIC_AUTH_ERROR); setLoading(false); } });
    const { data: subscription } = client?.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPasswordSetup(true);
      if (event === "SIGNED_OUT") setAuthorizedSession(null);
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) acceptSession(session);
    }) || { data: null };
    return () => { active = false; subscription?.subscription?.unsubscribe(); };
  }, [client]);

  async function signIn(event) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setWorking(true);
    setMessage("");
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    setPassword("");
    if (error || !data?.session || !(await verifyOwnerUatAccess(client))) {
      await client.auth.signOut();
      setMessage(GENERIC_AUTH_ERROR);
    } else {
      setAuthorizedSession(data.session);
    }
    setWorking(false);
  }

  async function requestReset() {
    if (!email.trim()) { setMessage("Enter the approved owner email first."); return; }
    setWorking(true);
    await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    setMessage("If this is the approved Owner UAT account, a password reset message has been requested.");
    setWorking(false);
  }

  async function updatePassword(event) {
    event.preventDefault();
    if (newPassword.length < 12) { setMessage("Use a password with at least 12 characters."); return; }
    setWorking(true);
    const { error } = await client.auth.updateUser({ password: newPassword });
    setNewPassword("");
    setMessage(error ? GENERIC_AUTH_ERROR : "Owner UAT password updated.");
    if (!error) setPasswordSetup(false);
    setWorking(false);
  }

  if (loading) return <main aria-busy="true" style={shellStyle}>Verifying Owner UAT access…</main>;
  if (!authorizedSession) return <main style={shellStyle}><form onSubmit={signIn} style={cardStyle}><div style={{ color: "#991b1b", fontSize: 12, fontWeight: 950 }}>OWNER UAT · REAL DATA</div><h1 style={{ margin: "6px 0" }}>Sign in to WelcomeFlow</h1><p style={{ color: "#6b5f93", lineHeight: 1.55 }}>Only Ash’s approved owner account can access this writable UAT workspace. Candidate communications remain disabled.</p><label style={labelStyle}>Owner email<input aria-label="Owner email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} style={inputStyle} /></label><label style={labelStyle}>Password<input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} /></label>{message ? <div role="status" style={{ color: "#991b1b", fontWeight: 750 }}>{message}</div> : null}<button type="submit" disabled={working} style={primaryButton}>{working ? "Verifying…" : "Sign In"}</button><button type="button" disabled={working} onClick={requestReset} style={secondaryButton}>Set or Reset Password</button></form></main>;

  return <div data-testid="owner-uat-authenticated"><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "7px 14px", background: "#fff7ed", borderBottom: "1px solid #fed7aa", fontFamily: "Inter, Arial, sans-serif" }}><span style={{ color: "#7c2d12", fontSize: 12, fontWeight: 800 }}>Authenticated Owner UAT session</span><button type="button" onClick={() => setPasswordSetup((value) => !value)} style={secondaryButton}>Change Password</button><button type="button" onClick={() => client.auth.signOut()} style={secondaryButton}>Sign Out</button></div>{passwordSetup ? <form onSubmit={updatePassword} style={{ ...cardStyle, margin: "12px auto" }}><h2 style={{ marginTop: 0 }}>Set Owner UAT password</h2><label style={labelStyle}>New password<input aria-label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} style={inputStyle} /></label><button type="submit" disabled={working} style={primaryButton}>Save Password</button>{message ? <div role="status">{message}</div> : null}</form> : children}</div>;
}

const shellStyle = { minHeight: "80vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f4ff", color: "#160a43", fontFamily: "Inter, Arial, sans-serif" };
const cardStyle = { width: "min(100%, 460px)", display: "grid", gap: 14, padding: 26, border: "1px solid #ded3ff", borderRadius: 10, background: "#fff", boxShadow: "0 18px 44px rgba(42,24,98,0.14)" };
const labelStyle = { display: "grid", gap: 6, fontWeight: 850 };
const inputStyle = { border: "1px solid #c9bee6", borderRadius: 7, padding: "11px 12px", font: "inherit" };
const primaryButton = { border: "1px solid #6d28d9", borderRadius: 7, padding: "10px 12px", background: "#6d28d9", color: "#fff", fontWeight: 900, cursor: "pointer" };
const secondaryButton = { border: "1px solid #c9bee6", borderRadius: 7, padding: "7px 10px", background: "#fff", color: "#4c1d95", fontWeight: 850, cursor: "pointer" };
