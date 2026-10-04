-- Personal data is never readable by other visitors or editors.
create table public.kk_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 tags text[] not null default '{}' check(cardinality(tags)<=500),
 completed boolean not null default false,
 updated_at timestamptz not null default clock_timestamp()
);
create table public.kk_seen (
 user_id uuid not null references auth.users(id) on delete cascade,
 item_id uuid not null,
 category text not null check(category in ('musea','openbare-kunst','beeldenparken','architectuur','evenementen')),
 name text not null check(length(name) between 1 and 250),
 rating integer check(rating between 1 and 5),
 seen_at timestamptz not null default now(),
 primary key(user_id,category,item_id)
);
alter table public.kk_profiles enable row level security;
alter table public.kk_seen enable row level security;
revoke all on public.kk_profiles,public.kk_seen from anon,authenticated;
grant select,insert,update,delete on public.kk_profiles,public.kk_seen to authenticated;
create policy own_profile on public.kk_profiles for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_seen on public.kk_seen for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.kk_save_profile(new_tags text[],is_completed boolean,expected_updated_at timestamptz default null)
returns setof public.kk_profiles language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Aanmelden vereist' using errcode='42501'; end if;
 if exists(select 1 from unnest(new_tags) t where length(t)>120 or length(trim(t))=0) then raise exception 'Ongeldige tags'; end if;
 if expected_updated_at is null then
  insert into public.kk_profiles(user_id,tags,completed) values(auth.uid(),new_tags,is_completed) on conflict do nothing;
 else
  update public.kk_profiles set tags=new_tags,completed=is_completed,updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where user_id=auth.uid() and updated_at=expected_updated_at;
 end if;
 if not found then raise exception 'Het profiel is op een ander apparaat gewijzigd. Herlaad voor je opnieuw opslaat.' using errcode='40001'; end if;
 return query select * from public.kk_profiles where user_id=auth.uid();
end $$;
revoke all on function public.kk_save_profile(text[],boolean,timestamptz) from public,anon;
grant execute on function public.kk_save_profile(text[],boolean,timestamptz) to authenticated;

-- A locked, server-side role list: user_metadata never grants privileges.
create function kunstkiezer_private.list_members()
returns table(user_id uuid,email text,is_admin boolean) language plpgsql security definer set search_path='' as $$
begin
 if not public.kk_is_editor() then raise exception 'Alleen beheerders' using errcode='42501'; end if;
 return query select u.id,u.email::text,e.user_id is not null from auth.users u left join kunstkiezer_private.editors e on e.user_id=u.id order by u.email limit 1000;
end $$;
create function kunstkiezer_private.set_admin(member_id uuid,allowed boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(7483921);
 if not public.kk_is_editor() then raise exception 'Alleen beheerders' using errcode='42501'; end if;
 if allowed then insert into kunstkiezer_private.editors(user_id) values(member_id) on conflict do nothing;
 else
  if exists(select 1 from kunstkiezer_private.editors where user_id=member_id) and (select count(*) from kunstkiezer_private.editors)<=1 then raise exception 'De laatste beheerder kan niet worden verwijderd.'; end if;
  delete from kunstkiezer_private.editors where user_id=member_id;
 end if;
end $$;
create function kunstkiezer_private.protect_last_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(7483921);
 if exists(select 1 from kunstkiezer_private.editors where user_id=old.id) and (select count(*) from kunstkiezer_private.editors)<=1 then raise exception 'Draag het beheer eerst over aan een andere gebruiker.'; end if;
 return old;
end $$;
create trigger kk_protect_last_admin before delete on auth.users for each row execute function kunstkiezer_private.protect_last_admin();
revoke all on function kunstkiezer_private.list_members(),kunstkiezer_private.set_admin(uuid,boolean),kunstkiezer_private.protect_last_admin() from public,anon,authenticated;
grant usage on schema kunstkiezer_private to authenticated;
grant execute on function kunstkiezer_private.list_members(),kunstkiezer_private.set_admin(uuid,boolean) to authenticated;
create function public.kk_list_members() returns table(user_id uuid,email text,is_admin boolean) language sql security invoker set search_path='' as $$select * from kunstkiezer_private.list_members()$$;
create function public.kk_set_admin(member_id uuid,allowed boolean) returns void language sql security invoker set search_path='' as $$select kunstkiezer_private.set_admin(member_id,allowed)$$;
revoke all on function public.kk_list_members(),public.kk_set_admin(uuid,boolean) from public,anon;
grant execute on function public.kk_list_members(),public.kk_set_admin(uuid,boolean) to authenticated;

create table public.kk_update_schedule (
 id boolean primary key default true check(id),enabled boolean not null default true,
 weekday integer not null default 1 check(weekday between 0 and 6),
 local_time time not null default '09:00',next_due timestamptz not null,
 updated_at timestamptz not null default clock_timestamp()
);
create table public.kk_update_runs (
 id uuid primary key default gen_random_uuid(), requested_by uuid references auth.users(id) on delete set null,
 reason text not null check(reason in ('manual','scheduled')),status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 requested_at timestamptz not null default now(),started_at timestamptz,finished_at timestamptz,
 summary text not null default '' check(length(summary)<=8000)
);
create unique index kk_one_active_update on public.kk_update_runs((true)) where status in ('queued','running');
alter table public.kk_update_schedule enable row level security;
alter table public.kk_update_runs enable row level security;
revoke all on public.kk_update_schedule,public.kk_update_runs from anon,authenticated;
grant select on public.kk_update_schedule,public.kk_update_runs to authenticated;
grant update(enabled,weekday,local_time) on public.kk_update_schedule to authenticated;
create policy admin_schedule_read on public.kk_update_schedule for select to authenticated using((select public.kk_is_editor()));
create policy admin_schedule_update on public.kk_update_schedule for update to authenticated using((select public.kk_is_editor())) with check((select public.kk_is_editor()));
create policy admin_runs on public.kk_update_runs for select to authenticated using((select public.kk_is_editor()));
create function kunstkiezer_private.next_update(day_number integer,at_time time,after_time timestamptz default now()) returns timestamptz language sql stable set search_path='' as $$
 select min((d::date+at_time) at time zone 'Europe/Amsterdam') from generate_series((after_time at time zone 'Europe/Amsterdam')::date, (after_time at time zone 'Europe/Amsterdam')::date+7,interval '1 day') d
 where extract(dow from d)=day_number and (d::date+at_time) at time zone 'Europe/Amsterdam'>after_time
$$;
create function kunstkiezer_private.schedule_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.next_due:=kunstkiezer_private.next_update(new.weekday,new.local_time);
 new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');return new;
end $$;
create trigger schedule_changed before update of enabled,weekday,local_time on public.kk_update_schedule for each row execute function kunstkiezer_private.schedule_changed();
insert into public.kk_update_schedule(next_due) values(kunstkiezer_private.next_update(1,'09:00'));
create function kunstkiezer_private.request_update() returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.kk_is_editor() then raise exception 'Alleen beheerders' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(7483922);
 select id into result from public.kk_update_runs where status in ('queued','running');
 if result is not null then return result; end if;
 if exists(select 1 from public.kk_update_runs where requested_at>now()-interval '5 minutes') then raise exception 'Wacht vijf minuten voordat je opnieuw een update aanvraagt.'; end if;
 insert into public.kk_update_runs(reason,requested_by) values('manual',auth.uid()) returning id into result;return result;
end $$;
create function public.kk_request_update() returns uuid language sql security invoker set search_path='' as $$select kunstkiezer_private.request_update()$$;
revoke all on function public.kk_request_update() from public,anon;
revoke all on function kunstkiezer_private.request_update(),kunstkiezer_private.next_update(integer,time,timestamptz),kunstkiezer_private.schedule_changed() from public,anon,authenticated;
grant execute on function kunstkiezer_private.request_update(),public.kk_request_update() to authenticated;
-- Called only by the trusted updater using the database management connection.
create function kunstkiezer_private.claim_update() returns setof public.kk_update_runs language plpgsql security invoker set search_path='' as $$
declare schedule public.kk_update_schedule; job uuid;
begin
 perform pg_advisory_xact_lock(7483922);
 update public.kk_update_runs set status='failed',finished_at=now(),summary='Updater onderbroken; na vier uur vrijgegeven. Controleer het verslag voordat je opnieuw start.' where status='running' and started_at<now()-interval '4 hours';
 if exists(select 1 from public.kk_update_runs where status='running') then return; end if;
 select * into schedule from public.kk_update_schedule where id for update;
 if schedule.enabled and schedule.next_due<=now() then
  insert into public.kk_update_runs(reason) values('scheduled') on conflict do nothing;
  update public.kk_update_schedule set next_due=kunstkiezer_private.next_update(schedule.weekday,schedule.local_time) where id;
 end if;
 select id into job from public.kk_update_runs where status='queued' order by requested_at limit 1 for update;
 return query update public.kk_update_runs set status='running',started_at=now() where id=job returning *;
end $$;
revoke all on function kunstkiezer_private.claim_update() from public,anon,authenticated;
-- Keep the privilege boundary outside the exposed public schema.
create function kunstkiezer_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from kunstkiezer_private.editors where user_id=(select auth.uid()))
$$;
revoke all on function kunstkiezer_private.is_admin() from public;
grant usage on schema kunstkiezer_private to anon;
grant execute on function kunstkiezer_private.is_admin() to anon,authenticated;
create or replace function public.kk_is_editor() returns boolean language sql stable security invoker set search_path='' as $$select kunstkiezer_private.is_admin()$$;
create index kk_update_runs_requested_by on public.kk_update_runs(requested_by);
