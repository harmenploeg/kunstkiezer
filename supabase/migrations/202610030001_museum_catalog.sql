begin;
create schema if not exists kunstkiezer_private;
revoke all on schema kunstkiezer_private from public, anon, authenticated;
create table if not exists kunstkiezer_private.editors (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table kunstkiezer_private.editors enable row level security;

create or replace function public.kk_is_editor() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from kunstkiezer_private.editors where user_id = auth.uid());
$$;
revoke all on function public.kk_is_editor() from public;
grant execute on function public.kk_is_editor() to anon, authenticated;

create table public.kk_museums (
 id uuid primary key default gen_random_uuid(),
 inventory_key text unique,
 name text not null check (char_length(trim(name)) between 1 and 250),
 city text not null default '',
 province text not null default '' check (province in ('','Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland')),
 street_address text not null default '',
 postal_code text not null default '',
 country text not null default 'NL' check (country = 'NL'),
 website_url text not null default '' check (website_url = '' or website_url ~ '^https?://[^[:space:]]+$'),
 latitude double precision check (latitude between -90 and 90),
 longitude double precision check (longitude between -180 and 180),
 summary text not null default '' check (char_length(summary) <= 5000),
 operating_status text not null default 'unknown' check (operating_status in ('unknown','open','temporarily_closed','closed')),
 publication_status text not null default 'draft' check (publication_status in ('draft','review','published','archived')),
 verification_status text not null default 'unreviewed' check (verification_status in ('unreviewed','verified','needs_update')),
 tags text[] not null default '{}',
 verified_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint coordinate_pair check ((latitude is null) = (longitude is null)),
 constraint publish_checked check (publication_status <> 'published' or (
   verification_status = 'verified' and length(trim(city)) > 0 and
   (length(trim(street_address)) > 0 or latitude is not null) and operating_status = 'open'
 ))
);
create index kk_museums_catalog on public.kk_museums(publication_status, province, city);
create index kk_museums_tags on public.kk_museums using gin(tags);

create table public.kk_museum_sources (
 id uuid primary key default gen_random_uuid(),
 museum_id uuid not null references public.kk_museums(id) on delete cascade,
 provider text not null,
 url text not null check (url ~ '^https?://[^[:space:]]+$'),
 external_id text not null default '',
 retrieved_at timestamptz not null,
 evidence_fields text[] not null default '{}',
 unique(museum_id, provider, url)
);
create table public.kk_museum_editorial (
 museum_id uuid primary key references public.kk_museums(id) on delete cascade,
 review_notes text not null default '',
 suggested_tags jsonb not null default '[]' check (jsonb_typeof(suggested_tags) = 'array')
);
create table public.kk_tags (
 label text primary key,
 dimension text not null,
 description text not null default ''
);
create table kunstkiezer_private.museum_changes (
 id bigint generated always as identity primary key,
 museum_id uuid not null,
 editor_id uuid,
 changed_at timestamptz not null default now(),
 operation text not null,
 before_row jsonb,
 after_row jsonb
);
revoke all on kunstkiezer_private.museum_changes from public, anon, authenticated;
alter table kunstkiezer_private.museum_changes enable row level security;

create or replace function kunstkiezer_private.touch_museum() returns trigger
language plpgsql set search_path = '' as $$
begin
 new.updated_at := clock_timestamp();
 if new.verification_status = 'verified' and (tg_op = 'INSERT' or old.verification_status is distinct from 'verified') then
   new.verified_at := clock_timestamp();
 elsif new.verification_status <> 'verified' then new.verified_at := null;
 end if;
 return new;
end; $$;
create trigger kk_touch_museum before insert or update on public.kk_museums
 for each row execute function kunstkiezer_private.touch_museum();

create or replace function kunstkiezer_private.audit_museum() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into kunstkiezer_private.museum_changes(museum_id,editor_id,operation,before_row,after_row)
 values(coalesce(new.id,old.id), auth.uid(), tg_op, case when tg_op <> 'INSERT' then to_jsonb(old) end,
 case when tg_op <> 'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end; $$;
create trigger kk_audit_museum after insert or update or delete on public.kk_museums
 for each row execute function kunstkiezer_private.audit_museum();

alter table public.kk_museums enable row level security;
alter table public.kk_museum_sources enable row level security;
alter table public.kk_museum_editorial enable row level security;
alter table public.kk_tags enable row level security;
create policy kk_museum_public on public.kk_museums for select to anon,authenticated using (
 publication_status='published' and verification_status='verified' and operating_status='open'
);
create policy kk_museum_editor_read on public.kk_museums for select to authenticated using (public.kk_is_editor());
create policy kk_museum_editor_insert on public.kk_museums for insert to authenticated with check (public.kk_is_editor());
create policy kk_museum_editor_update on public.kk_museums for update to authenticated using (public.kk_is_editor()) with check (public.kk_is_editor());
create policy kk_sources_read on public.kk_museum_sources for select to anon,authenticated using (
 public.kk_is_editor() or exists(select 1 from public.kk_museums m where m.id=museum_id and m.publication_status='published' and m.verification_status='verified' and m.operating_status='open')
);
create policy kk_sources_editor_insert on public.kk_museum_sources for insert to authenticated with check (public.kk_is_editor());
create policy kk_sources_editor_update on public.kk_museum_sources for update to authenticated using (public.kk_is_editor()) with check (public.kk_is_editor());
create policy kk_editorial_read on public.kk_museum_editorial for select to authenticated using (public.kk_is_editor());
create policy kk_editorial_insert on public.kk_museum_editorial for insert to authenticated with check (public.kk_is_editor());
create policy kk_editorial_update on public.kk_museum_editorial for update to authenticated using (public.kk_is_editor()) with check (public.kk_is_editor());
create policy kk_tags_read on public.kk_tags for select to anon,authenticated using (true);
create policy kk_tags_editor_insert on public.kk_tags for insert to authenticated with check (public.kk_is_editor());
create policy kk_tags_editor_update on public.kk_tags for update to authenticated using (public.kk_is_editor()) with check (public.kk_is_editor());
revoke all on public.kk_museums,public.kk_museum_sources,public.kk_museum_editorial,public.kk_tags from anon,authenticated;
grant select on public.kk_museums,public.kk_museum_sources,public.kk_tags to anon;
grant select,insert,update on public.kk_museums,public.kk_museum_sources,public.kk_museum_editorial,public.kk_tags to authenticated;
commit;
