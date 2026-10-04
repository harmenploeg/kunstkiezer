begin;
create table public.kk_update_sources (
 id text primary key default gen_random_uuid()::text check(length(id) between 1 and 100),
 name text not null check(length(btrim(name)) between 1 and 150),
 url text not null default '' check(length(url)<=2000 and (url='' or url ~ '^https?://[^[:space:]]+$')),
 notes text not null default '' check(length(notes)<=8000),
 enabled boolean not null default true,
 updated_at timestamptz not null default clock_timestamp(),
 check(url<>'' or length(btrim(notes))>0)
);
alter table public.kk_update_sources enable row level security;
revoke all on public.kk_update_sources from public,anon,authenticated;
grant select,insert,update,delete on public.kk_update_sources to authenticated;
create policy update_sources_read on public.kk_update_sources for select to authenticated using((select public.kk_is_editor()));
create policy update_sources_insert on public.kk_update_sources for insert to authenticated with check((select public.kk_is_editor()));
create policy update_sources_update on public.kk_update_sources for update to authenticated using((select public.kk_is_editor())) with check((select public.kk_is_editor()));
create policy update_sources_delete on public.kk_update_sources for delete to authenticated using((select public.kk_is_editor()));
create function public.kk_prepare_update_source() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at=greatest(clock_timestamp(),old.updated_at + interval '1 microsecond');return new;end;$$;
create trigger kk_update_source_timestamp before update on public.kk_update_sources for each row execute function public.kk_prepare_update_source();
create function public.kk_save_update_source(payload jsonb,source_id text default null,expected_updated_at timestamptz default null) returns public.kk_update_sources language plpgsql security invoker set search_path='' as $$
declare saved public.kk_update_sources;current_row public.kk_update_sources;
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501';end if;
 if source_id is null then
  insert into public.kk_update_sources(name,url,notes,enabled) values(btrim(payload->>'name'),btrim(coalesce(payload->>'url','')),btrim(coalesce(payload->>'notes','')),coalesce((payload->>'enabled')::boolean,true)) returning * into saved;
 else
  select * into current_row from public.kk_update_sources where id=source_id for update;
  if not found or expected_updated_at is null or current_row.updated_at is distinct from expected_updated_at then raise exception 'Changed; reload' using errcode='40001';end if;
  update public.kk_update_sources set name=btrim(payload->>'name'),url=btrim(coalesce(payload->>'url','')),notes=btrim(coalesce(payload->>'notes','')),enabled=coalesce((payload->>'enabled')::boolean,true) where id=source_id returning * into saved;
 end if;
 return saved;
end;$$;
create function public.kk_delete_update_source(source_id text,expected_updated_at timestamptz) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not public.kk_is_editor() then raise exception 'Editor access required' using errcode='42501';end if;
 delete from public.kk_update_sources where id=source_id and updated_at=expected_updated_at;
 if not found then raise exception 'Changed; reload' using errcode='40001';end if;
end;$$;
revoke all on function public.kk_save_update_source(jsonb,text,timestamptz),public.kk_delete_update_source(text,timestamptz) from public,anon;
grant execute on function public.kk_save_update_source(jsonb,text,timestamptz),public.kk_delete_update_source(text,timestamptz) to authenticated;

-- Initial list only. Future maintenance reads the live table and never reseeds it.
insert into public.kk_update_sources(id,name,url,notes) select id,name,url,notes from jsonb_to_recordset('[{"id": "official-institutions", "name": "Musea, kunstinstellingen, kunstenaars en terreinbeheerders", "url": "", "notes": "Officiële websites en bronlinks van bestaande en nieuwe vermeldingen"}, {"id": "municipal-collections", "name": "Gemeentelijke kunstcollecties en monumenteninformatie", "url": "", "notes": "Gemeentelijke inventarissen en locatiespecifieke projectpagina’s"}, {"id": "sleutelwerken", "name": "Sleutelwerken", "url": "https://www.sleutelwerken.nl/", "notes": "Onderscheid de officiële honderd Sleutelwerken van overige inzendingen; controleer tijdelijke en verplaatste werken."}, {"id": "11fountains", "name": "11fountains", "url": "https://11fountains.nl/", "notes": ""}, {"id": "architectuurgids", "name": "Architectuurgids Top 100", "url": "https://www.architectuurgids.nl/project/list_projects_of_tag/tag_id/15", "notes": ""}, {"id": "architectuur-org", "name": "Architectuur.ORG", "url": "https://www.architectuur.org/", "notes": ""}, {"id": "rdmz100", "name": "Historische RDMZ Top 100", "url": "https://nl.wikipedia.org/wiki/Top_100_van_de_Rijksdienst_voor_de_Monumentenzorg", "notes": "Een historisch geselecteerd gebouw is niet vanzelf openbaar toegankelijk of een kunstmuseum."}, {"id": "nai250", "name": "Nederlandse architectuur in 250 topstukken", "url": "https://www.nai010.com/product/nederlandse-architectuur-in-250-topstukken/", "notes": "Alleen uitgeversinformatie en gedeeltelijk inkijkexemplaar beoordeeld; volledige lijst niet beschikbaar. Archiefontwerpen zijn niet automatisch bezoekbare locaties."}, {"id": "whichmuseum", "name": "WhichMuseum Kunst & Design", "url": "https://whichmuseum.nl/plaats/nederland-1?category%5B%5D=art-design", "notes": "Toets aan de afgesproken kunstselectie; een brede categorie op deze site is geen bewijs dat kunst de hoofdzaak is."}, {"id": "kunstvensters", "name": "KunstVensters", "url": "https://kunstvensters.com/", "notes": ""}, {"id": "museumtijdschrift", "name": "Museumtijdschrift", "url": "https://museumtijdschrift.nl/", "notes": ""}, {"id": "kunstmeisjes", "name": "De Kunstmeisjes", "url": "", "notes": "Toegankelijke artikelen en sociale berichten; leg de werkelijk geraadpleegde URL vast."}, {"id": "culty-pleasures", "name": "Culty Pleasures", "url": "", "notes": "Toegankelijke artikelen en sociale berichten; leg de werkelijk geraadpleegde URL vast.\n\nAfgeschermde berichten niet als geraadpleegd opvoeren."}, {"id": "newspapers", "name": "Landelijke kranten", "url": "", "notes": "Toegankelijke recensies, architectuurartikelen, interviews en culturele reportages. Bewaar de specifieke krant en artikel-URL.\n\nGeen claim van inhoudelijke controle achter een niet toegankelijke betaalmuur."}, {"id": "commons", "name": "Wikimedia Commons", "url": "https://commons.wikimedia.org/", "notes": "Controleer beeldidentiteit, maker en licentie. Bestandsnaam of cameracoördinaten bewijzen niet de actuele bezoeklocatie."}]'::jsonb) as s(id text,name text,url text,notes text) on conflict(id) do nothing;
commit;
