begin;
alter table public.kk_museums add column is_art_museum boolean not null default false,
 add column photos jsonb not null default '[]';
alter table public.kk_museums drop constraint publish_checked;
alter table public.kk_museums add constraint publish_art check (publication_status <> 'published' or
 (is_art_museum and length(trim(city))>0 and (length(trim(street_address))>0 or latitude is not null) and operating_status='open'));
alter table public.kk_museums add constraint collection_80_words check (cardinality(regexp_split_to_array(trim(summary), '[[:space:]]+'))<=80);
create function public.kk_valid_photos(items jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select case when jsonb_typeof(items)<>'array' then false else
 jsonb_array_length(items)<=20 and not exists(select 1 from jsonb_array_elements(items) p where
 jsonb_typeof(p)<>'object' or coalesce(p->>'url','') !~ '^https?://[^[:space:]@]+$' or
 (coalesce(p->>'source_url','')<>'' and p->>'source_url' !~ '^https?://[^[:space:]@]+$')) end;
$$;
revoke all on function public.kk_valid_photos(jsonb) from public;
grant execute on function public.kk_valid_photos(jsonb) to anon,authenticated;
alter table public.kk_museums add constraint museum_photos check (public.kk_valid_photos(photos));
drop policy kk_museum_public on public.kk_museums;
create policy kk_museum_public on public.kk_museums for select to anon,authenticated using (is_art_museum and publication_status='published' and operating_status='open');
drop policy kk_sources_read on public.kk_museum_sources;
create policy kk_sources_read on public.kk_museum_sources for select to anon,authenticated using (public.kk_is_editor() or exists(select 1 from public.kk_museums m where m.id=museum_id and m.is_art_museum and m.publication_status='published' and m.operating_status='open'));
create or replace function public.kk_save_museum(
 payload jsonb, museum_id uuid default null, expected_updated_at timestamptz default null, editorial_notes text default ''
) returns public.kk_museums
language plpgsql security invoker set search_path = '' as $$
declare input public.kk_museums; current_row public.kk_museums; saved public.kk_museums;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501'; end if;
 input := jsonb_populate_record(null::public.kk_museums,payload);
 if museum_id is null then
  insert into public.kk_museums(name,city,province,street_address,postal_code,country,website_url,latitude,longitude,summary,operating_status,publication_status,is_art_museum,photos,tags)
  values(input.name,input.city,input.province,input.street_address,input.postal_code,input.country,input.website_url,input.latitude,input.longitude,input.summary,input.operating_status,input.publication_status,coalesce(input.is_art_museum,true),coalesce(input.photos,'[]'),input.tags)
  returning * into saved;
 else
  select * into current_row from public.kk_museums where id=museum_id for update;
  if not found or expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then
   raise exception 'Museum changed; reload before saving' using errcode='40001';
  end if;
  update public.kk_museums set name=input.name,city=input.city,province=input.province,street_address=input.street_address,postal_code=input.postal_code,country=input.country,website_url=input.website_url,latitude=input.latitude,longitude=input.longitude,summary=input.summary,operating_status=input.operating_status,publication_status=input.publication_status,is_art_museum=coalesce(input.is_art_museum,true),photos=coalesce(input.photos,'[]'),tags=input.tags where id=museum_id returning * into saved;
 end if;
 insert into public.kk_museum_editorial(museum_id,review_notes) values(saved.id,coalesce(editorial_notes,''))
 on conflict on constraint kk_museum_editorial_pkey do update set review_notes=excluded.review_notes;
 return saved;
end; $$;
revoke all on function public.kk_save_museum(jsonb,uuid,timestamptz,text) from public,anon;
grant execute on function public.kk_save_museum(jsonb,uuid,timestamptz,text) to authenticated;
commit;
