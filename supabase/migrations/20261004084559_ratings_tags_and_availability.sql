begin;
alter table public.kk_museums drop constraint kk_museums_operating_status_check;
alter table public.kk_museums add constraint kk_museums_operating_status_check check(operating_status in('open','unknown','temporarily_closed','closed','disappeared'));
alter table public.kk_discoveries drop constraint kk_discoveries_operating_status_check;
alter table public.kk_discoveries add constraint kk_discoveries_operating_status_check check(operating_status in('open','unknown','temporarily_closed','closed','disappeared'));
drop policy kk_museum_public on public.kk_museums;
create policy kk_museum_public on public.kk_museums for select to anon,authenticated using ((select public.kk_is_editor()) or (is_art_museum and publication_status='published' and operating_status='open'));
drop policy discovery_read on public.kk_discoveries;
create policy discovery_read on public.kk_discoveries for select to anon,authenticated using ((select public.kk_is_editor()) or (publication_status='published' and operating_status='open' and (category<>'evenementen' or (ends_on>=(now() at time zone 'Europe/Amsterdam')::date and starts_on<=((now() at time zone 'Europe/Amsterdam')::date+interval '1 month')::date))));
alter table public.kk_ranking_settings add column rating_weight integer not null default 0 check(rating_weight between 0 and 100);
alter table public.kk_ranking_settings add column rating_prior integer not null default 5 check(rating_prior between 0 and 100);
alter table public.kk_ranking_settings drop constraint kk_ranking_settings_check;
alter table public.kk_ranking_settings add constraint ranking_total check(distance_weight+tag_weight+rating_weight=100);
-- Preserve the administrator's distance/taste ratio, reserving 20% for ratings.
update public.kk_ranking_settings set distance_weight=round(distance_weight*.8),tag_weight=80-round(distance_weight*.8),rating_weight=20;
create function public.kk_save_ranking_v2(payload jsonb,expected_updated_at timestamptz) returns public.kk_ranking_settings language plpgsql security invoker set search_path='' as $$
declare saved public.kk_ranking_settings;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501';end if;
 update public.kk_ranking_settings set distance_weight=(payload->>'distance_weight')::integer,tag_weight=(payload->>'tag_weight')::integer,rating_weight=(payload->>'rating_weight')::integer,rating_prior=(payload->>'rating_prior')::integer,distance_scale_km=(payload->>'distance_scale_km')::double precision where id=1 and updated_at=expected_updated_at returning * into saved;
 if not found then raise exception 'Changed; reload' using errcode='40001';end if;return saved;
end $$;
revoke all on function public.kk_save_ranking_v2(jsonb,timestamptz) from public,anon;
grant execute on function public.kk_save_ranking_v2(jsonb,timestamptz) to authenticated;
-- Expose only grouped ratings with at least three distinct accounts. Never expose voters.
create function kunstkiezer_private.rating_totals() returns table(item_id uuid,category text,votes bigint,stars bigint[]) language sql stable security definer set search_path='' as $$
 select s.item_id,s.category,count(*),array[count(*) filter(where rating=1),count(*) filter(where rating=2),count(*) filter(where rating=3),count(*) filter(where rating=4),count(*) filter(where rating=5)]
 from public.kk_seen s where rating is not null and (
 (s.category='musea' and exists(select 1 from public.kk_museums m where m.id=s.item_id and m.is_art_museum and m.publication_status='published' and m.operating_status='open'))
 or exists(select 1 from public.kk_discoveries d where d.id=s.item_id and d.category=s.category and d.publication_status='published' and d.operating_status='open' and (d.category<>'evenementen' or (d.ends_on>=(now() at time zone 'Europe/Amsterdam')::date and d.starts_on<=((now() at time zone 'Europe/Amsterdam')::date+interval '1 month')::date)))
 ) group by s.item_id,s.category having count(*)>=3;
$$;
revoke all on function kunstkiezer_private.rating_totals() from public;
grant execute on function kunstkiezer_private.rating_totals() to anon,authenticated;
create function public.kk_rating_totals() returns table(item_id uuid,category text,votes bigint,stars bigint[]) language sql stable security invoker set search_path='' as $$select * from kunstkiezer_private.rating_totals()$$;
revoke all on function public.kk_rating_totals() from public;
grant execute on function public.kk_rating_totals() to anon,authenticated;
alter table public.kk_tags add column enabled boolean not null default true;
alter table public.kk_tags add column updated_at timestamptz not null default clock_timestamp();
create trigger kk_tags_timestamp before update on public.kk_tags for each row execute function public.kk_prepare_ranking_settings();
create function kunstkiezer_private.valid_preference_questions(value jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare q jsonb; answer jsonb; tag jsonb;
begin
 if jsonb_typeof(value) is distinct from 'array' then return false;end if;
 if jsonb_array_length(value)>30 then return false;end if;
 for q in select jsonb_array_elements(value) loop
  if jsonb_typeof(q->'title') is distinct from 'string' or length(trim(q->>'title')) not between 1 and 200 or jsonb_typeof(q->'description') is distinct from 'string' or length(q->>'description')>500 or jsonb_typeof(q->'options') is distinct from 'array' then return false;end if;
  if jsonb_array_length(q->'options') not between 1 and 40 then return false;end if;
  for answer in select jsonb_array_elements(q->'options') loop
   if jsonb_typeof(answer->'label') is distinct from 'string' or length(trim(answer->>'label')) not between 1 and 150 or jsonb_typeof(answer->'tags') is distinct from 'array' then return false;end if;
   if jsonb_array_length(answer->'tags') not between 1 and 30 then return false;end if;
   for tag in select jsonb_array_elements(answer->'tags') loop
    if jsonb_typeof(tag) is distinct from 'string' or length(trim(tag#>>'{}')) not between 1 and 120 then return false;end if;
   end loop;
  end loop;
 end loop;
 return true;
end $$;
revoke all on function kunstkiezer_private.valid_preference_questions(jsonb) from public;
grant execute on function kunstkiezer_private.valid_preference_questions(jsonb) to authenticated;
create table public.kk_preference_questions(id integer primary key check(id=1),questions jsonb not null check(kunstkiezer_private.valid_preference_questions(questions)),updated_at timestamptz not null default clock_timestamp());
alter table public.kk_preference_questions enable row level security;
revoke all on public.kk_preference_questions from public,anon,authenticated;
grant select on public.kk_preference_questions to anon,authenticated;
grant update(questions) on public.kk_preference_questions to authenticated;
create policy questions_read on public.kk_preference_questions for select to anon,authenticated using(true);
create policy questions_edit on public.kk_preference_questions for update to authenticated using((select public.kk_is_editor())) with check((select public.kk_is_editor()));
create trigger questions_timestamp before update on public.kk_preference_questions for each row execute function public.kk_prepare_ranking_settings();
-- Creator tags are separate from subject tags and follow the existing maker field.
create function public.kk_creator_tag() returns trigger language plpgsql security invoker set search_path='' as $$
declare label text;
begin
 if tg_op='UPDATE' and old.creator<>new.creator and length(trim(old.creator))>0 then new.tags=array_remove(new.tags,'maker: '||lower(trim(old.creator)));end if;
 if length(trim(new.creator)) between 1 and 110 and lower(trim(new.creator)) not in('onbekend','diversen','diverse kunstenaars','meerdere kunstenaars') then
 label='maker: '||lower(trim(new.creator));
 if not label=any(new.tags) then new.tags=array_append(new.tags,label);end if;
 insert into public.kk_tags(label,dimension,description) values(label,'maker',trim(new.creator)) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger discovery_creator_tag before insert or update of creator,tags on public.kk_discoveries for each row execute function public.kk_creator_tag();
update public.kk_discoveries set creator=creator where length(trim(creator)) between 1 and 110;
insert into public.kk_preference_questions(id,questions) values(1,'[{"title":"Welke kunst trekt je aandacht?","description":"Kies gerust meerdere vormen.","options":[{"label":"Schilderkunst","tags":["schilderkunst"]},{"label":"Fotografie","tags":["fotografie","documentaire fotografie"]},{"label":"Beelden en installaties","tags":["beeldhouwkunst","installaties","beeldenensemble"]},{"label":"Design en mode","tags":["design","mode","toegepaste kunst"]},{"label":"Keramiek en glas","tags":["keramiek","glaskunst"]},{"label":"Tekeningen en grafiek","tags":["tekenkunst","tekeningen","grafiek","prentkunst"]},{"label":"Digitale kunst en video","tags":["digitale kunst","videokunst","mediakunst"]}]},{"title":"Welke stijlen en periodes spreken je aan?","description":"Van oude meesters tot nieuwe experimenten.","options":[{"label":"Oude meesters","tags":["oude meesters","oude kunst"]},{"label":"Moderne kunst","tags":["moderne kunst","naoorlogse kunst"]},{"label":"Hedendaags en experimenteel","tags":["hedendaagse kunst","experiment"]},{"label":"Abstract","tags":["abstract"]},{"label":"Figuratief en realistisch","tags":["figuratief","figuratieve kunst","realisme"]},{"label":"De Stijl en modernisme","tags":["de stijl","modernisme"]}]},{"title":"Waar kijk je graag naar tijdens een uitstapje?","description":"Deze voorkeuren tellen ook mee binnen de vijf verzamelingen.","options":[{"label":"Kunst buiten en in het landschap","tags":["kunst in de openbare ruimte","land art","landschap"]},{"label":"Beeldentuinen en routes","tags":["beeldentuin","museumtuin","beeldenroute"]},{"label":"Historische gebouwen","tags":["historische architectuur","rijksmonument"]},{"label":"Moderne architectuur","tags":["hedendaagse architectuur","naoorlogse architectuur"]},{"label":"Industrieel erfgoed","tags":["industrieel erfgoed"]},{"label":"Straatkunst","tags":["street art","graffiti"]},{"label":"Identiteit en samenleving","tags":["identiteit","maatschappij","migratie"]},{"label":"Natuur en ecologie","tags":["mens en natuur","ecologie"]}]}]');
-- Every onboarding answer must be available in the editable tag library.
insert into public.kk_tags(label,dimension,description)
select distinct tag#>>'{}','onderwerp','' from public.kk_preference_questions p,
lateral jsonb_array_elements(p.questions) q,
lateral jsonb_array_elements(q->'options') a,
lateral jsonb_array_elements(a->'tags') tag on conflict do nothing;
commit;
