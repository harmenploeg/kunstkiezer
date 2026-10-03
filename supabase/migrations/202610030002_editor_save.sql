begin;
create or replace function public.kk_save_museum(
 payload jsonb, museum_id uuid default null, expected_updated_at timestamptz default null, editorial_notes text default ''
) returns public.kk_museums
language plpgsql security invoker set search_path = '' as $$
declare input public.kk_museums; current_row public.kk_museums; saved public.kk_museums;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501'; end if;
 input := jsonb_populate_record(null::public.kk_museums,payload);
 if museum_id is null then
  insert into public.kk_museums(name,city,province,street_address,postal_code,country,website_url,latitude,longitude,summary,operating_status,publication_status,verification_status,tags)
  values(input.name,input.city,input.province,input.street_address,input.postal_code,input.country,input.website_url,input.latitude,input.longitude,input.summary,input.operating_status,input.publication_status,input.verification_status,input.tags)
  returning * into saved;
 else
  select * into current_row from public.kk_museums where id=museum_id for update;
  if not found or expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then
   raise exception 'Museum changed; reload before saving' using errcode='40001';
  end if;
  update public.kk_museums set name=input.name,city=input.city,province=input.province,street_address=input.street_address,postal_code=input.postal_code,country=input.country,website_url=input.website_url,latitude=input.latitude,longitude=input.longitude,summary=input.summary,operating_status=input.operating_status,publication_status=input.publication_status,verification_status=input.verification_status,tags=input.tags where id=museum_id returning * into saved;
 end if;
 insert into public.kk_museum_editorial(museum_id,review_notes) values(saved.id,coalesce(editorial_notes,''))
 on conflict on constraint kk_museum_editorial_pkey do update set review_notes=excluded.review_notes;
 return saved;
end; $$;
revoke all on function public.kk_save_museum(jsonb,uuid,timestamptz,text) from public,anon;
grant execute on function public.kk_save_museum(jsonb,uuid,timestamptz,text) to authenticated;
commit;
