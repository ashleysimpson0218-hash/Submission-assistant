const test = require('node:test');
const assert = require('node:assert/strict');
const { createConnectionService, subjectId } = require('../server/workflow/calendarConnection');
const { emptyState } = require('../src/workflow/engine');
const { createCalendarProvider } = require('../server/workflow/calendarProviders');
function fixture() {
  let state = emptyState();
  const receipts = new Map(), writes = [];
  const client = {
    from(table) {
      const q = { select(){return q;}, eq(){return q;}, order(){return q;}, limit(){return q;},
        maybeSingle(){return q;}, then(resolve) {
          const data = table === 'welcomeflow_workflow_state' ? { revision: state.revision, data: state }
            : table === 'welcomeflow_workflow_members' ? [{ user_id: 'user-1', role: 'admin', active: true, version: 1 }]
            : table === 'welcomeflow_workspace_state' ? { data: { settings: {} }, updated_at: '2026-10-01T00:00:00Z' } : [];
          return Promise.resolve({ data }).then(resolve);
        } };
      return q;
    },
    async rpc(name, args) {
      assert.equal(name, 'welcomeflow_commit_workflow');
      if (receipts.has(args.p_command_id)) return { data: { status: receipts.get(args.p_command_id) === args.p_fingerprint ? 'duplicate' : 'command_conflict' } };
      if (args.p_expected_revision !== state.revision) return { data: { status: 'revision_conflict' } };
      state = args.p_state; receipts.set(args.p_command_id, args.p_fingerprint);
      return { data: { status: 'committed' } };
    },
  };
  let account = 'outlook-owner', find = true, throwWrite = false;
  const adapter = { async inspectAccount(){return {accountId: account, email:'owner@example.test',providerCalendarId:'primary-id'};},
    async busy(){return [];}, async createTestAppointment(booking) {
      assert(state.calendarTests.some(x=>x.id===booking.id && x.status==='pending'), 'intent must exist before write');
      writes.push(booking);
      if(throwWrite) throw Object.assign(new Error('secret-provider-diagnostic'),{code:'CALENDAR_WRITE_UNKNOWN'});
      return {eventId:'event-1'};
    }, async findTestAppointment(){return find ? {eventId:'event-1',verified:true} : null;} };
  const service = createConnectionService({client,workspaceId:'workspace-1',userId:'user-1',projectRef:'test-ref',providerFactory:()=>adapter});
  return {service,writes,state:()=>state,changeAccount:()=>{account='someone-else';},uncertain:()=>{throwWrite=true;find=false;},found:()=>{find=true;}};
}
const future = () => new Date(Date.now()+86400000).toISOString();
const id = '11111111-1111-4111-8111-111111111111';
test('subjects isolate workspace, member and database; browser cannot supply the SDK subject',()=>{
  assert.notEqual(subjectId('a','u','p'),subjectId('b','u','p'));
  assert.notEqual(subjectId('a','u','p'),subjectId('a','v','p'));
  assert.notEqual(subjectId('a','u','p'),subjectId('a','u','q'));
});
test('saved intent precedes Outlook write; replay verifies without creating again',async()=>{
  const f=fixture(); await f.service.verify(); const start=future();
  assert.equal((await f.service.book(id,start)).tests[0].status,'verified');
  await f.service.book(id,start); assert.equal(f.writes.length,1);
  await assert.rejects(f.service.book(id,new Date(Date.parse(start)+900000).toISOString()),{code:'COMMAND_REUSED'});
});
test('uncertain write survives reconnect/replay and never retries POST',async()=>{
  const f=fixture();await f.service.verify();f.uncertain();const start=future();
  assert.equal((await f.service.book(id,start)).tests[0].status,'unknown');
  await f.service.book(id,start);assert.equal(f.writes.length,1);
  await assert.rejects(f.service.disconnect(),{code:'CALENDAR_RECONCILIATION_REQUIRED'});
  f.found();assert.equal((await f.service.reconcile(id)).tests[0].status,'verified');
});
test('concurrent duplicate creates one Outlook appointment',async()=>{
  const f=fixture();await f.service.verify();const start=future();
  await Promise.all([f.service.book(id,start),f.service.book(id,start)]);
  assert.equal(f.writes.length,1);
});
test('overlapping saved reservations block another test ID',async()=>{
  const f=fixture();await f.service.verify();const start=future();await f.service.book(id,start);
  await assert.rejects(f.service.book('22222222-2222-4222-8222-222222222222',start),{code:'CALENDAR_SLOT_UNAVAILABLE'});
  assert.equal(f.writes.length,1);
});
test('changed provider identity cannot write using an old trusted binding',async()=>{
  const f=fixture();await f.service.verify();f.changeAccount();
  await assert.rejects(f.service.availability(future(),future()),{code:'CALENDAR_CONNECTION_REQUIRED'});
  await assert.rejects(f.service.book(id,future()),{code:'CALENDAR_CONNECTION_REQUIRED'});
  assert.equal(f.writes.length,0);
});
test('public status exposes own test results without Connect subject or connector credentials',async()=>{
  const f=fixture();await f.service.verify();const result=JSON.stringify(await f.service.status());
  assert(!result.includes('connectorId'));assert(!result.includes('memberId'));assert(!result.includes('userId'));
});
test('Outlook test appointment has no recipients and uses a stable transaction ID',async()=>{
  const calls=[];const binding={provider:'microsoft',workspaceId:'w',userId:'u',connectorId:'microsoft/test',calendarId:'primary',email:'owner@example.test'};
  const p=createCalendarProvider(binding,{getToken:async()=> 'do-not-print',fetch:async(url,opts)=>{
    calls.push({url,...opts});return {ok:true,status:200,json:async()=>opts.method==='POST'?{id:'e'}:{value:[]}};
  }});
  await p.createTestAppointment({id,start:'2026-11-01T15:00:00Z',end:'2026-11-01T15:15:00Z'});
  const body=JSON.parse(calls.find(x=>x.method==='POST').body);
  assert.deepEqual(body.attendees,[]);assert.equal(body.isReminderOn,false);assert.equal(body.showAs,'busy');
  assert.match(body.transactionId,/^[a-f0-9]{64}$/);assert.match(body.subject,/TEST/);
});
test('provider identity requires a writable mailbox',async()=>{
  const p=createCalendarProvider({provider:'microsoft',workspaceId:'w',userId:'u',connectorId:'microsoft/test',calendarId:'primary',email:'pending'},
    {getToken:async()=> 'hidden',fetch:async(url)=>({ok:true,status:200,json:async()=>url.includes('/me?')?{id:'u',mail:'owner@example.test'}:{id:'c',canEdit:false}})});
  await assert.rejects(p.inspectAccount(),{code:'CALENDAR_CONNECTION_REQUIRED'});
});
