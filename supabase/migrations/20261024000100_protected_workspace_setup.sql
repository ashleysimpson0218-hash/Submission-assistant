begin;

-- Staged only. Does not provision accounts, grant browser table access or send messages.
-- Dependency: existing workspace state, current workflow membership, and its version trigger.
create function public.welcomeflow_access_workspace_setup(
  p_workspace_id text,
  p_actor_id uuid,
  p_actor_role text,
  p_operation text,
  p_expected_updated_at timestamptz,
  p_changes jsonb
) returns jsonb
language plpgsql security invoker
set search_path = ''
set lock_timeout = '2s'
as $$
declare
  v_member public.welcomeflow_workflow_members%rowtype;
  v_data jsonb;
  v_settings jsonb;
  v_general jsonb;
  v_fields jsonb;
  v_version timestamptz;
  v_saved_at timestamptz;
  v_key text;
  v_value jsonb;
  v_text text;
  v_limit integer;
  v_keys constant text[] := array['companyName','recruiterName','recruiterEmail','signOffLine','includeSignatureLineInEmails'];
begin
  if current_user <> 'service_role' then
    raise exception 'Protected setup requires the server service';
  end if;
  if p_workspace_id is null or p_workspace_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$'
    or p_actor_id is null or p_actor_role is null or p_actor_role not in ('admin','recruiter') then
    return jsonb_build_object('status','forbidden');
  end if;
  if p_operation is null or p_operation not in ('read','save')
    or jsonb_typeof(p_changes) is distinct from 'object' or octet_length(p_changes::text) > 8192 then
    return jsonb_build_object('status','invalid');
  end if;
  if p_operation = 'read' and (p_changes <> '{}'::jsonb or p_expected_updated_at is not null) then
    return jsonb_build_object('status','invalid');
  end if;
  if p_operation = 'save' then
    if p_changes = '{}'::jsonb or p_expected_updated_at is null then
      return jsonb_build_object('status','invalid');
    end if;
    for v_key, v_value in select key,value from jsonb_each(p_changes) loop
      if not (v_key = any(v_keys)) then return jsonb_build_object('status','invalid'); end if;
      if v_key = 'includeSignatureLineInEmails' then
        if jsonb_typeof(v_value) is distinct from 'boolean' then return jsonb_build_object('status','invalid'); end if;
      else
        if jsonb_typeof(v_value) is distinct from 'string' then return jsonb_build_object('status','invalid'); end if;
        v_text := v_value #>> '{}';
        v_limit := case when v_key = 'signOffLine' then 1000 when v_key = 'recruiterEmail' then 254 else 200 end;
        if char_length(v_text) > v_limit then return jsonb_build_object('status','invalid'); end if;
        if v_key = 'recruiterEmail' and btrim(v_text) <> ''
          and v_text !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
          return jsonb_build_object('status','invalid');
        end if;
      end if;
    end loop;
  end if;

  -- Authenticated actor values come from the server, never from a browser payload.
  -- SHARE (not KEY SHARE) prevents removal/demotion during this transaction.
  select * into v_member from public.welcomeflow_workflow_members
    where workspace_id = p_workspace_id and user_id = p_actor_id for share;
  if not found or not v_member.active or v_member.role <> p_actor_role then
    return jsonb_build_object('status','forbidden');
  end if;

  -- Match existing workflow lock order: membership first, then workspace.
  if p_operation = 'save' then
    select data,updated_at into v_data,v_version from public.welcomeflow_workspace_state
      where workspace_id = p_workspace_id for update;
  else
    select data,updated_at into v_data,v_version from public.welcomeflow_workspace_state
      where workspace_id = p_workspace_id for share;
  end if;
  if not found or v_version is null or jsonb_typeof(v_data) is distinct from 'object' then
    return jsonb_build_object('status','unavailable');
  end if;
  if p_operation = 'save' and v_version is distinct from p_expected_updated_at then
    return jsonb_build_object('status','conflict');
  end if;
  v_settings := coalesce(v_data->'settings','{}'::jsonb);
  v_general := coalesce(v_settings->'general','{}'::jsonb);
  if jsonb_typeof(v_settings) is distinct from 'object' or jsonb_typeof(v_general) is distinct from 'object' then
    return jsonb_build_object('status','unavailable');
  end if;

  if p_operation = 'save' then
    v_general := v_general || p_changes;
    v_settings := jsonb_set(v_settings,'{general}',v_general,true);
    v_data := jsonb_set(v_data,'{settings}',v_settings,true);
    v_saved_at := greatest(clock_timestamp(),v_version + interval '1 microsecond');
    v_data := jsonb_set(v_data,'{savedAt}',to_jsonb(v_saved_at),true);
    update public.welcomeflow_workspace_state set data=v_data,updated_at=v_saved_at
      where workspace_id=p_workspace_id;
    v_version := v_saved_at;
  end if;

  -- Do not return candidates, private notes, credentials, templates or other settings.
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into v_fields
    from jsonb_each(v_general) where key = any(v_keys);
  return jsonb_build_object('status',case when p_operation='read' then 'loaded' else 'saved' end,
    'workspaceId',p_workspace_id,'updatedAt',v_version,'fields',v_fields);
end;
$$;

revoke all on function public.welcomeflow_access_workspace_setup(text,uuid,text,text,timestamptz,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.welcomeflow_access_workspace_setup(text,uuid,text,text,timestamptz,jsonb)
  to service_role;

-- Deliberately no table GRANT, RLS policy, data backfill, automatic activation or triggers.
commit;
