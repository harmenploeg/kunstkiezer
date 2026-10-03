import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const rows=JSON.parse(readFileSync('data/museums/art-expansion-2026-10-03.json','utf8'));
const fields=['id','inventory_key','name','city','province','street_address','postal_code','country','website_url','latitude','longitude','summary','operating_status','publication_status','verification_status','tags','photos','is_art_museum'];
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
mkdirSync('supabase/art-imports',{recursive:true});
for(let start=0;start<rows.length;start+=25){
 const batch=rows.slice(start,start+25);
 const records=batch.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]])));
 const notes=batch.map(r=>({museum_id:r.id,review_notes:r.review_notes,suggested_tags:[]}));
 const sources=batch.flatMap(r=>r.sources.map(s=>({...s,museum_id:r.id,external_id:s.external_id??''})));
 const sql=`-- Only promote untouched non-art drafts. Art records and editor changes are protected.\nbegin;
create temporary table kk_art_changed(id uuid primary key) on commit drop;
with changed as (
 insert into public.kk_museums as m(${fields.join(',')})
 select ${fields.join(',')} from jsonb_populate_recordset(null::public.kk_museums,${literal(records)})
 on conflict(id) do update set ${fields.filter(k=>k!=='id').map(k=>`${k}=excluded.${k}`).join(',')}
 where not m.is_art_museum and m.publication_status='draft'
 and not exists(select 1 from kunstkiezer_private.museum_changes c where c.museum_id=m.id and c.editor_id is not null)
 returning id
) insert into kk_art_changed select id from changed;
insert into public.kk_museum_editorial(museum_id,review_notes,suggested_tags)
select museum_id,review_notes,suggested_tags from jsonb_populate_recordset(null::public.kk_museum_editorial,${literal(notes)}) n where n.museum_id in(select id from kk_art_changed)
on conflict(museum_id) do update set review_notes=concat_ws(E'\\n',nullif(kk_museum_editorial.review_notes,''),excluded.review_notes);
insert into public.kk_museum_sources(museum_id,provider,url,external_id,retrieved_at,evidence_fields)
select museum_id,provider,url,external_id,retrieved_at,evidence_fields from jsonb_populate_recordset(null::public.kk_museum_sources,${literal(sources)}) s where s.museum_id in(select id from kk_art_changed) on conflict do nothing;
select count(*) as imported from kk_art_changed;
commit;\n`;
 writeFileSync(`supabase/art-imports/${String(start/25+1).padStart(3,'0')}.sql`,sql);
}
console.log(`${rows.length} curated additions in ${Math.ceil(rows.length/25)} protected batches`);
