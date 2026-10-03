begin;
alter table public.kk_museums add column coordinate_precision text not null default 'unknown' check(coordinate_precision in('exact','address','street','city','unknown'));
alter table public.kk_museums add column coordinate_source text not null default '';
update public.kk_museums set coordinate_precision='exact',coordinate_source='Bestaande museumcoördinaten' where is_art_museum and latitude is not null and longitude is not null;
alter table public.kk_discoveries add column latitude double precision check(latitude between -90 and 90);
alter table public.kk_discoveries add column longitude double precision check(longitude between -180 and 180);
alter table public.kk_discoveries add constraint discovery_coordinate_pair check((latitude is null)=(longitude is null));
alter table public.kk_discoveries add column coordinate_precision text not null default 'unknown' check(coordinate_precision in('exact','address','street','city','unknown'));
alter table public.kk_discoveries add column coordinate_source text not null default '';
create table public.kk_ranking_settings(
 id integer primary key default 1 check(id=1),
 distance_weight integer not null default 70 check(distance_weight between 0 and 100),
 tag_weight integer not null default 30 check(tag_weight between 0 and 100),
 distance_scale_km double precision not null default 30 check(distance_scale_km between 1 and 500),
 updated_at timestamptz not null default clock_timestamp(),
 check(distance_weight+tag_weight=100)
);
insert into public.kk_ranking_settings(id) values(1);
alter table public.kk_ranking_settings enable row level security;
revoke all on public.kk_ranking_settings from public,anon,authenticated;
grant select on public.kk_ranking_settings to anon,authenticated;
grant update on public.kk_ranking_settings to authenticated;
create policy ranking_public_read on public.kk_ranking_settings for select to anon,authenticated using(true);
create policy ranking_editor_update on public.kk_ranking_settings for update to authenticated using((select public.kk_is_editor())) with check((select public.kk_is_editor()));
create function public.kk_prepare_ranking_settings() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at=clock_timestamp();return new;end;$$;
create trigger kk_ranking_timestamp before update on public.kk_ranking_settings for each row execute function public.kk_prepare_ranking_settings();
create function public.kk_save_ranking_settings(distance_weight integer,tag_weight integer,distance_scale_km double precision,expected_updated_at timestamptz) returns public.kk_ranking_settings language plpgsql security invoker set search_path='' as $$
declare current_row public.kk_ranking_settings;saved public.kk_ranking_settings;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501';end if;
 select * into current_row from public.kk_ranking_settings where id=1 for update;
 if expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then raise exception 'Changed; reload' using errcode='40001';end if;
 update public.kk_ranking_settings set distance_weight=kk_save_ranking_settings.distance_weight,tag_weight=kk_save_ranking_settings.tag_weight,distance_scale_km=kk_save_ranking_settings.distance_scale_km where id=1 returning * into saved;
 return saved;
end;$$;
revoke all on function public.kk_save_ranking_settings(integer,integer,double precision,timestamptz) from public,anon;
grant execute on function public.kk_save_ranking_settings(integer,integer,double precision,timestamptz) to authenticated;

create or replace function public.kk_save_museum(
 payload jsonb, museum_id uuid default null, expected_updated_at timestamptz default null, editorial_notes text default ''
) returns public.kk_museums
language plpgsql security invoker set search_path = '' as $$
declare input public.kk_museums; current_row public.kk_museums; saved public.kk_museums;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501'; end if;
 input := jsonb_populate_record(null::public.kk_museums,payload);
 if museum_id is null then
  insert into public.kk_museums(name,city,province,street_address,postal_code,country,website_url,latitude,longitude,summary,operating_status,publication_status,is_art_museum,photos,tags,coordinate_precision,coordinate_source)
  values(input.name,input.city,input.province,input.street_address,input.postal_code,input.country,input.website_url,input.latitude,input.longitude,input.summary,input.operating_status,input.publication_status,coalesce(input.is_art_museum,true),coalesce(input.photos,'[]'),input.tags,coalesce(input.coordinate_precision,'unknown'),coalesce(input.coordinate_source,''))
  returning * into saved;
 else
  select * into current_row from public.kk_museums where id=museum_id for update;
  if not found or expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then
   raise exception 'Museum changed; reload before saving' using errcode='40001';
  end if;
  update public.kk_museums set name=input.name,city=input.city,province=input.province,street_address=input.street_address,postal_code=input.postal_code,country=input.country,website_url=input.website_url,latitude=input.latitude,longitude=input.longitude,summary=input.summary,operating_status=input.operating_status,publication_status=input.publication_status,is_art_museum=coalesce(input.is_art_museum,true),photos=coalesce(input.photos,'[]'),tags=input.tags,coordinate_precision=case when payload ? 'coordinate_precision' then coalesce(input.coordinate_precision,'unknown') else current_row.coordinate_precision end,coordinate_source=case when payload ? 'coordinate_source' then coalesce(input.coordinate_source,'') else current_row.coordinate_source end where id=museum_id returning * into saved;
 end if;
 insert into public.kk_museum_editorial(museum_id,review_notes) values(saved.id,coalesce(editorial_notes,''))
 on conflict on constraint kk_museum_editorial_pkey do update set review_notes=excluded.review_notes;
 return saved;
end; $$;

create or replace function public.kk_save_discovery(payload jsonb,discovery_id uuid default null,expected_updated_at timestamptz default null,editorial_notes text default '') returns public.kk_discoveries language plpgsql security invoker set search_path='' as $$
declare input public.kk_discoveries;current_row public.kk_discoveries;saved public.kk_discoveries;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501';end if;
 input=jsonb_populate_record(null::public.kk_discoveries,payload);
 if discovery_id is null then
 insert into public.kk_discoveries(category,name,city,province,street_address,website_url,summary,creator,year,tags,photos,sources,selection_reason,visit_notes,museum_id,starts_on,ends_on,operating_status,publication_status,latitude,longitude,coordinate_precision,coordinate_source)
 values(input.category,input.name,input.city,input.province,input.street_address,input.website_url,input.summary,input.creator,input.year,input.tags,input.photos,input.sources,input.selection_reason,input.visit_notes,input.museum_id,input.starts_on,input.ends_on,input.operating_status,input.publication_status,input.latitude,input.longitude,coalesce(input.coordinate_precision,'unknown'),coalesce(input.coordinate_source,'')) returning * into saved;
 else
 select * into current_row from public.kk_discoveries where id=discovery_id for update;
 if not found or expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then raise exception 'Changed; reload' using errcode='40001';end if;
 if current_row.category<>input.category then raise exception 'Category cannot change';end if;
 update public.kk_discoveries set name=input.name,city=input.city,province=input.province,street_address=input.street_address,website_url=input.website_url,summary=input.summary,creator=input.creator,year=input.year,tags=input.tags,photos=input.photos,sources=input.sources,selection_reason=input.selection_reason,visit_notes=input.visit_notes,museum_id=input.museum_id,starts_on=input.starts_on,ends_on=input.ends_on,operating_status=input.operating_status,publication_status=input.publication_status,latitude=case when payload ? 'latitude' then input.latitude else current_row.latitude end,longitude=case when payload ? 'longitude' then input.longitude else current_row.longitude end,coordinate_precision=case when payload ? 'coordinate_precision' then coalesce(input.coordinate_precision,'unknown') else current_row.coordinate_precision end,coordinate_source=case when payload ? 'coordinate_source' then coalesce(input.coordinate_source,'') else current_row.coordinate_source end where id=discovery_id returning * into saved;
 end if;
 insert into public.kk_discovery_editorial(discovery_id,review_notes) values(saved.id,coalesce(editorial_notes,'')) on conflict on constraint kk_discovery_editorial_pkey do update set review_notes=excluded.review_notes;
 return saved;
end;$$;

commit;
