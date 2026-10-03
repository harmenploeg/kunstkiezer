begin;
create table public.kk_discoveries(
 id uuid primary key default gen_random_uuid(), inventory_key text unique,
 category text not null check(category in('openbare-kunst','beeldenparken','architectuur','evenementen')),
 name text not null check(length(trim(name))>0), city text not null default '',province text not null default '',street_address text not null default '',website_url text not null default '' check(website_url='' or website_url ~ '^https?://[^[:space:]]+$'),
 summary text not null default '' check(summary='' or cardinality(regexp_split_to_array(trim(summary),'\s+'))<=80),
 creator text not null default '',year text not null default '',tags text[] not null default '{}',photos jsonb not null default '[]' check(jsonb_typeof(photos)='array'),sources jsonb not null default '[]' check(jsonb_typeof(sources)='array'),
 selection_reason text not null default '',visit_notes text not null default '',museum_id uuid references public.kk_museums(id),
 starts_on date,ends_on date,operating_status text not null default 'open' check(operating_status in('open','temporarily_closed','closed','unknown')),
 publication_status text not null default 'draft' check(publication_status in('draft','published','archived')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(ends_on is null or starts_on is null or ends_on>=starts_on),
 check(publication_status<>'published' or (length(trim(city))>0 and length(trim(summary))>0 and length(trim(selection_reason))>0 and cardinality(tags)>0 and jsonb_array_length(sources)>0 and operating_status='open' and (category<>'evenementen' or (starts_on is not null and ends_on is not null))))
);
create index kk_discoveries_category_status on public.kk_discoveries(category,publication_status,name);
create index kk_discoveries_dates on public.kk_discoveries(starts_on,ends_on) where category='evenementen';
create index kk_discoveries_museum_id on public.kk_discoveries(museum_id);
create table public.kk_discovery_editorial(discovery_id uuid primary key references public.kk_discoveries(id) on delete cascade,review_notes text not null default '');
create table kunstkiezer_private.discovery_changes(id bigint generated always as identity primary key,discovery_id uuid not null,editor_id uuid,changed_at timestamptz not null default now(),before_row jsonb,after_row jsonb);
alter table kunstkiezer_private.discovery_changes enable row level security;
revoke all on kunstkiezer_private.discovery_changes from public,anon,authenticated;
create function kunstkiezer_private.audit_discovery() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into kunstkiezer_private.discovery_changes(discovery_id,editor_id,before_row,after_row) values(new.id,auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;end;$$;
revoke all on function kunstkiezer_private.audit_discovery() from public,anon,authenticated;
create trigger kk_discovery_audit after insert or update on public.kk_discoveries for each row execute function kunstkiezer_private.audit_discovery();
create function public.kk_prepare_discovery() returns trigger language plpgsql security invoker set search_path='' as $$declare v jsonb;begin
 new.updated_at=clock_timestamp();
 for v in select value from jsonb_array_elements(new.sources) loop
  if coalesce(v->>'url','') !~ '^https?://[^[:space:]]+$' then raise exception 'Invalid source URL';end if;
 end loop;
 for v in select value from jsonb_array_elements(new.photos) loop
  if coalesce(v->>'url','') !~ '^https?://[^[:space:]]+$' or coalesce(v->>'source_url','') !~ '^https?://[^[:space:]]+$' or coalesce(v->>'credit','')='' or coalesce(v->>'license','')='' then raise exception 'Photo requires source and license';end if;
 end loop;return new;end;$$;
create trigger kk_discovery_prepare before insert or update on public.kk_discoveries for each row execute function public.kk_prepare_discovery();
alter table public.kk_discoveries enable row level security;
alter table public.kk_discovery_editorial enable row level security;
grant select on public.kk_discoveries to anon,authenticated;
grant insert,update on public.kk_discoveries to authenticated;
grant select,insert,update on public.kk_discovery_editorial to authenticated;
create policy discovery_read on public.kk_discoveries for select to anon,authenticated using((select public.kk_is_editor()) or (publication_status='published' and operating_status='open' and (category<>'evenementen' or (ends_on>=(now() at time zone 'Europe/Amsterdam')::date and starts_on<=((now() at time zone 'Europe/Amsterdam')::date+interval '1 month')::date))));
create policy discovery_insert on public.kk_discoveries for insert to authenticated with check((select public.kk_is_editor()));
create policy discovery_update on public.kk_discoveries for update to authenticated using((select public.kk_is_editor())) with check((select public.kk_is_editor()));
create policy discovery_notes on public.kk_discovery_editorial for all to authenticated using((select public.kk_is_editor())) with check((select public.kk_is_editor()));
create function public.kk_save_discovery(payload jsonb,discovery_id uuid default null,expected_updated_at timestamptz default null,editorial_notes text default '') returns public.kk_discoveries language plpgsql security invoker set search_path='' as $$
declare input public.kk_discoveries;current_row public.kk_discoveries;saved public.kk_discoveries;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501';end if;
 input=jsonb_populate_record(null::public.kk_discoveries,payload);
 if discovery_id is null then
 insert into public.kk_discoveries(category,name,city,province,street_address,website_url,summary,creator,year,tags,photos,sources,selection_reason,visit_notes,museum_id,starts_on,ends_on,operating_status,publication_status)
 values(input.category,input.name,input.city,input.province,input.street_address,input.website_url,input.summary,input.creator,input.year,input.tags,input.photos,input.sources,input.selection_reason,input.visit_notes,input.museum_id,input.starts_on,input.ends_on,input.operating_status,input.publication_status) returning * into saved;
 else
 select * into current_row from public.kk_discoveries where id=discovery_id for update;
 if not found or expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then raise exception 'Changed; reload' using errcode='40001';end if;
 if current_row.category<>input.category then raise exception 'Category cannot change';end if;
 update public.kk_discoveries set name=input.name,city=input.city,province=input.province,street_address=input.street_address,website_url=input.website_url,summary=input.summary,creator=input.creator,year=input.year,tags=input.tags,photos=input.photos,sources=input.sources,selection_reason=input.selection_reason,visit_notes=input.visit_notes,museum_id=input.museum_id,starts_on=input.starts_on,ends_on=input.ends_on,operating_status=input.operating_status,publication_status=input.publication_status where id=discovery_id returning * into saved;
 end if;
 insert into public.kk_discovery_editorial(discovery_id,review_notes) values(saved.id,coalesce(editorial_notes,'')) on conflict on constraint kk_discovery_editorial_pkey do update set review_notes=excluded.review_notes;
 return saved;
end;$$;
revoke all on function public.kk_save_discovery(jsonb,uuid,timestamptz,text) from public,anon;
grant execute on function public.kk_save_discovery(jsonb,uuid,timestamptz,text) to authenticated;
commit;
