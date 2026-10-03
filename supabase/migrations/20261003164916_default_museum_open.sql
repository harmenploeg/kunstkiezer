begin;
alter table public.kk_museums alter column operating_status set default 'open';
update public.kk_museums set operating_status='open' where is_art_museum and operating_status='unknown';
commit;
