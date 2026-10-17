-- Wat een updateronde heeft veranderd, en op grond van welke bron, zodat de beheerder dat
-- in Beheer kan nalezen. `kk_update_runs.summary` blijft de notitie in een paar regels;
-- deze tabel is de onderbouwing per record.
create table public.kk_update_changes (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.kk_update_runs(id) on delete cascade,
 change text not null check(change in ('added','updated','archived','rejected')),
 record_table text not null check(record_table in ('kk_discoveries','kk_museums')),
 record_id uuid,
 record_name text not null check(length(btrim(record_name)) between 1 and 200),
 fields text[] not null default '{}' check(coalesce(array_length(fields,1),0)<=30),
 source_id text references public.kk_update_sources(id) on delete set null,
 source_url text not null default '' check(length(source_url)<=2000 and (source_url='' or source_url ~ '^https?://[^[:space:]]+$')),
 note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default now(),
 -- een wijziging zonder bron is niet na te lezen, en alleen een afwijzing heeft geen record
 check(source_url<>'' or source_id is not null),
 check(record_id is not null or change='rejected')
);
create index kk_update_changes_run on public.kk_update_changes(run_id,created_at);
alter table public.kk_update_changes enable row level security;
revoke all on public.kk_update_changes from anon,authenticated;
grant select on public.kk_update_changes to authenticated;
create policy admin_changes on public.kk_update_changes for select to authenticated using((select public.kk_is_editor()));

-- De updater draait met de secret key en niet op de beheerverbinding van de database, want
-- het databasewachtwoord is niet in gebruik. Daarom zijn claimen, noteren en afsluiten ook
-- via PostgREST te doen, maar uitsluitend voor service_role: een beheerder vraagt een ronde
-- aan met kk_request_update() en schrijft zelf niets in de uitslag.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
grant usage on schema public to service_role;

create function public.kk_claim_update() returns setof public.kk_update_runs language sql security definer set search_path='' as $$
 select * from kunstkiezer_private.claim_update()
$$;

-- Noteer één wijziging met de bron erbij. Alleen tijdens de ronde, zodat een notitie niet
-- achteraf onder een afgesloten ronde belandt.
create function public.kk_record_update_change(run_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uit uuid;
begin
 if not exists(select 1 from public.kk_update_runs r where r.id=run_id and r.status='running') then
  raise exception 'Deze ronde staat niet op running; noteer wijzigingen tijdens de ronde.';
 end if;
 insert into public.kk_update_changes(run_id,change,record_table,record_id,record_name,fields,source_id,source_url,note)
 values(run_id,payload->>'change',payload->>'record_table',(payload->>'record_id')::uuid,btrim(coalesce(payload->>'record_name','')),
  array(select jsonb_array_elements_text(coalesce(payload->'fields','[]'::jsonb))),
  payload->>'source_id',coalesce(payload->>'source_url',''),coalesce(payload->>'note',''))
 returning id into uit;
 return uit;
end $$;

-- Sluit de ronde af met de notitie erbij. `ok=false` zet 'failed', zodat een afgebroken
-- ronde zichtbaar blijft in plaats van vier uur op 'running' te staan.
create function public.kk_finish_update(run_id uuid,ok boolean,note text) returns public.kk_update_runs language plpgsql security definer set search_path='' as $$
declare uit public.kk_update_runs;
begin
 if length(coalesce(note,''))>8000 then raise exception 'De notitie is te lang (maximaal 8000 tekens).'; end if;
 update public.kk_update_runs set status=case when ok then 'completed' else 'failed' end,
  finished_at=now(),summary=coalesce(note,'')
  where id=run_id and status='running' returning * into uit;
 if uit.id is null then raise exception 'Deze ronde staat niet op running; niets bijgewerkt.'; end if;
 return uit;
end $$;

revoke all on function public.kk_claim_update(),public.kk_record_update_change(uuid,jsonb),public.kk_finish_update(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.kk_claim_update(),public.kk_record_update_change(uuid,jsonb),public.kk_finish_update(uuid,boolean,text) to service_role;
