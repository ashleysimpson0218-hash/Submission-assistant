begin;

create table if not exists public.welcomeflow_screening_slot_reservations (
  workspace_id text not null,
  recruiter_key text not null,
  requested_date date not null,
  requested_time time without time zone not null,
  lead_id text not null,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  requisition_id text not null,
  facility_id text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (workspace_id, recruiter_key, requested_date, requested_time)
);

alter table public.welcomeflow_screening_slot_reservations enable row level security;
revoke all privileges on table public.welcomeflow_screening_slot_reservations from public, anon, authenticated;
grant select, insert, update, delete on table public.welcomeflow_screening_slot_reservations to service_role;

create or replace function public.welcomeflow_reserve_screening_slot(
  p_workspace_id text,
  p_expected_updated_at timestamptz,
  p_token_hash text,
  p_lead_id text,
  p_recruiter_key text,
  p_requisition_id text,
  p_facility_id text,
  p_requested_date date,
  p_requested_time text,
  p_next_data jsonb,
  p_next_updated_at timestamptz
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_data jsonb;
  v_updated_at timestamptz;
  v_lead jsonb;
  v_scope jsonb;
  v_requisition jsonb;
  v_existing_lead_id text;
  v_existing_token_hash text;
  v_rows integer := 0;
  v_status text;
begin
  if p_workspace_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$'
     or p_token_hash !~ '^[a-f0-9]{64}$'
     or coalesce(p_lead_id, '') = ''
     or coalesce(p_recruiter_key, '') = ''
     or coalesce(p_requisition_id, '') = ''
     or coalesce(p_facility_id, '') = ''
     or p_requested_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
     or jsonb_typeof(p_next_data) <> 'object' then
    return 'inactive';
  end if;

  select state.data, state.updated_at
    into v_data, v_updated_at
  from public.welcomeflow_workspace_state as state
  where state.workspace_id = p_workspace_id
  for update;

  if v_data is null then return 'inactive'; end if;

  select item
    into v_lead
  from jsonb_array_elements(coalesce(v_data -> 'hotLeads', '[]'::jsonb)) as item
  where item ->> 'bookingAccessTokenHash' = p_token_hash
  limit 1;

  if v_lead is null then return 'inactive'; end if;
  v_scope := coalesce(v_lead -> 'bookingAccessScope', '{}'::jsonb);
  v_status := lower(trim(coalesce(v_lead ->> 'status', v_lead ->> 'outreachStatus', '')));

  if coalesce(v_lead ->> 'archivedAt', '') <> ''
     or coalesce((v_lead ->> 'archived')::boolean, false)
     or coalesce(v_lead ->> 'bookingAccessRevokedAt', '') <> ''
     or coalesce((v_lead ->> 'bookingAccessIssuedAt')::timestamptz, 'infinity'::timestamptz) > clock_timestamp()
     or coalesce((v_lead ->> 'bookingAccessExpiresAt')::timestamptz, '-infinity'::timestamptz) <= clock_timestamp()
     or v_status not in (
       'new', 'outreach needed', 'outreach sent', 'second outreach sent',
       'final outreach sent', 'follow-up due', 'call attempted', 'text sent',
       'email sent', 'booking link sent', 'responded'
     )
     or v_scope ->> 'action' <> 'book-screening'
     or v_scope ->> 'workspaceId' <> p_workspace_id
     or v_scope ->> 'leadId' <> p_lead_id
     or v_scope ->> 'candidateId' <> p_lead_id
     or v_scope ->> 'requisitionId' <> p_requisition_id
     or v_scope ->> 'facilityId' <> p_facility_id
     or v_scope ->> 'recruiterId' <> p_recruiter_key
     or coalesce(v_lead ->> 'leadId', v_lead ->> 'id', '') <> p_lead_id
     or coalesce(v_lead ->> 'selectedRequisitionId', v_lead ->> 'requisitionId', '') <> p_requisition_id
     or coalesce(v_lead ->> 'facilityId', v_lead ->> 'canonicalFacilityId', v_lead #>> '{reqSnapshot,facilityId}', '') <> p_facility_id then
    return 'inactive';
  end if;

  select requisition
    into v_requisition
  from (
    select value as requisition
    from jsonb_array_elements(
      case when jsonb_typeof(v_data #> '{settings,requisitions}') = 'array'
        then v_data #> '{settings,requisitions}' else '[]'::jsonb end
    )
    union all
    select value as requisition
    from jsonb_each(
      case when jsonb_typeof(v_data #> '{settings,requisitions}') = 'object'
        then v_data #> '{settings,requisitions}' else '{}'::jsonb end
    )
  ) as requisitions
  where coalesce(requisition ->> 'id', requisition ->> 'requisitionId', '') = p_requisition_id
  limit 1;

  if v_requisition is null
     or lower(trim(coalesce(v_requisition ->> 'status', 'active'))) <> 'active'
     or coalesce(v_requisition ->> 'facilityId', v_requisition ->> 'canonicalFacilityId', v_requisition ->> 'siteId', '') <> p_facility_id then
    return 'inactive';
  end if;

  select reservation.lead_id, reservation.token_hash
    into v_existing_lead_id, v_existing_token_hash
  from public.welcomeflow_screening_slot_reservations as reservation
  where reservation.workspace_id = p_workspace_id
    and reservation.recruiter_key = p_recruiter_key
    and reservation.requested_date = p_requested_date
    and reservation.requested_time = p_requested_time::time
  for update;

  if v_existing_lead_id is not null then
    if v_existing_lead_id = p_lead_id and v_existing_token_hash = p_token_hash then return 'duplicate'; end if;
    return 'slot_taken';
  end if;

  if v_updated_at is distinct from p_expected_updated_at then return 'conflict'; end if;

  insert into public.welcomeflow_screening_slot_reservations (
    workspace_id, recruiter_key, requested_date, requested_time,
    lead_id, token_hash, requisition_id, facility_id
  ) values (
    p_workspace_id, p_recruiter_key, p_requested_date, p_requested_time::time,
    p_lead_id, p_token_hash, p_requisition_id, p_facility_id
  ) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then return 'slot_taken'; end if;

  update public.welcomeflow_workspace_state
  set data = p_next_data, updated_at = p_next_updated_at
  where workspace_id = p_workspace_id and updated_at = p_expected_updated_at;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    delete from public.welcomeflow_screening_slot_reservations
    where workspace_id = p_workspace_id
      and recruiter_key = p_recruiter_key
      and requested_date = p_requested_date
      and requested_time = p_requested_time::time
      and lead_id = p_lead_id
      and token_hash = p_token_hash;
    return 'conflict';
  end if;

  return 'booked';
end;
$$;

revoke all privileges on function public.welcomeflow_reserve_screening_slot(
  text, timestamptz, text, text, text, text, text, date, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.welcomeflow_reserve_screening_slot(
  text, timestamptz, text, text, text, text, text, date, text, jsonb, timestamptz
) to service_role;

commit;
