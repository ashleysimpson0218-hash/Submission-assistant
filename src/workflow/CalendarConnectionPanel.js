import React, { useEffect, useState } from 'react';
export default function CalendarConnectionPanel({ client, workspaceId }) {
  const [status, setStatus] = useState(null), [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false), [start, setStart] = useState(''),
    [checked, setChecked] = useState(null), [authorizationUrl, setAuthorizationUrl] = useState('');
  async function request(payload) {
    const { data, error } = await client.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error('Sign in to WelcomeFlow first.');
    const response = await fetch('/api/calendar', { method: payload ? 'POST' : 'GET', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-WelcomeFlow-Workspace-Id': workspaceId,
        Authorization: `Bearer ${data.session.access_token}` },
      ...(payload ? { body: JSON.stringify(payload) } : {}) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Calendar check could not be completed.');
    return result;
  }
  useEffect(() => {
    let live = true;
    request().then(r => { if (live) setStatus(r); }).catch(() => {});
    return () => { live = false; };
    // Reload for a different authenticated workspace; never retain another member's status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, workspaceId]);
  async function run(payload) {
    setBusy(true); setMessage('');
    try {
      const result = await request(payload);
      if (result.authorizationUrl) setAuthorizationUrl(result.authorizationUrl);
      else if (result.busy) {
        setChecked({ start: payload.start, free: result.busy.length === 0 });
        setMessage(result.busy.length ? 'This 15-minute time is busy. Choose another time.' : 'This 15-minute time is currently free.');
      } else { setStatus(result); setAuthorizationUrl(''); }
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  if (!status) return null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const iso = start && Number.isFinite(new Date(start).getTime()) ? new Date(start).toISOString() : '';
  return <details className="wf-card">
    <summary>Outlook calendar connection test</summary>
    <p>Connect your Outlook calendar, check a time, then create a 15-minute test appointment. Candidate interview scheduling still requires separate end-to-end testing.</p>
    <p>{status.connection ? `Verified mailbox: ${status.connection.email}` : 'Your WelcomeFlow account has no verified Outlook calendar yet.'}</p>
    <div className="wf-actions">
      <button disabled={busy} onClick={() => run({ action: 'authorize' })}>Connect Outlook</button>
      <button disabled={busy} onClick={() => run({ action: 'verify' })}>Verify connected calendar</button>
      {status.connection && <button disabled={busy} onClick={() => run({ action: 'disconnect' })}>Disconnect from test app</button>}
    </div>
    {authorizationUrl && <p><a href={authorizationUrl} target="_blank" rel="noopener noreferrer">Continue to Microsoft</a>. After approving, return here and select Verify connected calendar.</p>}
    {status.connection && <>
      <label className="wf-field">Test appointment start ({zone})
        <input type="datetime-local" value={start} onChange={e => { setStart(e.target.value); setChecked(null); }} />
      </label>
      <p>The appointment is labeled “WelcomeFlow TEST — calendar connection,” lasts 15 minutes, and has no invitees. You can remove it in Outlook after checking it.</p>
      <button disabled={busy || !iso} onClick={() => run({ action: 'availability', start: iso, end: new Date(Date.parse(iso) + 900000).toISOString() })}>Check this time</button>
      <button disabled={busy || !iso || checked?.start !== iso || !checked?.free}
        onClick={() => { setChecked(null); run({ action: 'book_test', id: crypto.randomUUID(), start: iso }); }}>Create test appointment in Outlook</button>
    </>}
    {message && <p role="status">{message}</p>}
    {(status.tests || []).map(test => <article className="wf-card" key={test.id}>
      <strong>{new Date(test.start).toLocaleString()} · {test.status === 'verified' ? 'Confirmed in Outlook' : test.status === 'failed' ? 'Not created' : 'Awaiting verification'}</strong>
      {test.status !== 'failed' && <button disabled={busy} onClick={() => run({ action: 'reconcile', id: test.id })}>Check saved test appointment</button>}
      {['pending', 'unknown', 'created'].includes(test.status) && <p>The request is saved. Check it here before creating another appointment.</p>}
    </article>)}
  </details>;
}
