begin;
-- Publication and availability are separate: a closed or historical place can be described publicly.
alter table public.kk_museums drop constraint publish_art;
alter table public.kk_museums add constraint publish_art check(publication_status<>'published' or is_art_museum);
alter table public.kk_discoveries drop constraint kk_discoveries_check1;
alter table public.kk_discoveries add constraint discovery_publish_content check(publication_status<>'published' or
 (length(trim(summary))>0 and length(trim(selection_reason))>0 and cardinality(tags)>0 and jsonb_array_length(sources)>0 and
 (category<>'evenementen' or (starts_on is not null and ends_on is not null))));
drop policy kk_museum_public on public.kk_museums;
drop policy kk_museum_editor_read on public.kk_museums;
create policy kk_museum_public on public.kk_museums for select to anon,authenticated using
 ((select public.kk_is_editor()) or (is_art_museum and publication_status='published'));
drop policy kk_sources_read on public.kk_museum_sources;
create policy kk_sources_read on public.kk_museum_sources for select to anon,authenticated using
 ((select public.kk_is_editor()) or exists(select 1 from public.kk_museums m where m.id=museum_id and m.is_art_museum and m.publication_status='published'));
drop policy discovery_read on public.kk_discoveries;
create policy discovery_read on public.kk_discoveries for select to anon,authenticated using
 ((select public.kk_is_editor()) or (publication_status='published' and (category<>'evenementen' or
 (ends_on>=(now() at time zone 'Europe/Amsterdam')::date and starts_on<=((now() at time zone 'Europe/Amsterdam')::date+interval '1 month')::date))));
-- One-off request: publish existing concepts in the five curated categories.
-- Keep every content field, visit status, non-art museum and archived record unchanged.
update public.kk_museums set publication_status='published' where is_art_museum and publication_status='draft';
update public.kk_discoveries set publication_status='published' where publication_status='draft';
commit;
