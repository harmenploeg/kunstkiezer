import {readFileSync,writeFileSync} from 'node:fs';
const rows=JSON.parse(readFileSync('data/museums/art-curation-2026-10-03.json','utf8'));
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const sql=`-- First curated art selection. Preserve later editorial work when rerun.\nbegin;\nwith content as (select * from jsonb_to_recordset(${quote(JSON.stringify(rows))}::jsonb) as x(id uuid, summary text,tags text[],photos jsonb))
update public.kk_museums m set is_art_museum=true,
 operating_status=case when m.operating_status='unknown' then 'open' else m.operating_status end,
 summary=case when m.summary='' then c.summary else m.summary end,
 photos=case when m.photos='[]'::jsonb then c.photos else m.photos end,
 tags=array(select distinct unnest(m.tags||c.tags) order by 1)
from content c where m.id=c.id;
with content as (select * from jsonb_to_recordset(${quote(JSON.stringify(rows.map(({id,url})=>({id,url}))))}::jsonb) as x(id uuid,url text))
insert into public.kk_museum_sources(museum_id,provider,url,retrieved_at,evidence_fields)
select id,'Collectiebron',url,'2026-10-03T16:30:00Z',array['summary','tags','is_art_museum'] from content
on conflict(museum_id,provider,url) do nothing;
commit;\n`;
writeFileSync('supabase/art-curation.sql',sql);
console.log(`${rows.length} kunstmusea; bestaande redactie en publicatiestatus blijven behouden.`);
