import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const records=JSON.parse(readFileSync('data/museums/inventory.json','utf8'));
const fields=['id','inventory_key','name','city','province','street_address','postal_code','country','website_url','latitude','longitude','summary','operating_status','publication_status','verification_status','tags'];
mkdirSync('supabase/imports',{recursive:true});
// Stage first, preserving existing editorial work on reruns. Never replace edited rows.
for(let start=0;start<records.length;start+=50){
 const batch=records.slice(start,start+50);
 const json=JSON.stringify(batch.map(r=>Object.fromEntries(fields.map(k=>[k,r[k]]))));
 const editorial=JSON.stringify(batch.map(r=>({museum_id:r.id,review_notes:r.review_notes,suggested_tags:r.suggested_tags})));
 const sources=JSON.stringify(batch.flatMap(r=>r.sources.map(s=>({...s,museum_id:r.id}))));
 const sql=`begin;\ninsert into public.kk_museums(${fields.join(',')})\nselect ${fields.join(',')} from jsonb_populate_recordset(null::public.kk_museums,$kk$${json}$kk$::jsonb) on conflict do nothing;\ninsert into public.kk_museum_editorial(museum_id,review_notes,suggested_tags)\nselect museum_id,review_notes,suggested_tags from jsonb_populate_recordset(null::public.kk_museum_editorial,$kk$${editorial}$kk$::jsonb) on conflict do nothing;\ninsert into public.kk_museum_sources(museum_id,provider,url,external_id,retrieved_at,evidence_fields)\nselect museum_id,provider,url,external_id,retrieved_at,evidence_fields from jsonb_populate_recordset(null::public.kk_museum_sources,$kk$${sources}$kk$::jsonb) on conflict do nothing;\ncommit;\n`;
 if(sql.includes('$kk$\n')||batch.some(r=>JSON.stringify(r).includes('$kk$')))throw Error('Unsafe SQL delimiter');
 writeFileSync(`supabase/imports/${String(start/50+1).padStart(3,'0')}.sql`,sql);
}
const header=fields.join(',')+'\n';
const csv=records.map(r=>fields.map(k=>{const value=k==='tags'?'{'+r.tags.join(',')+'}':r[k]??'';return '"'+String(value).replaceAll('"','""')+'"';}).join(',')).join('\n');
writeFileSync('data/museums/supabase-museums.csv',header+csv+'\n');
console.log(`${records.length} concepten, ${Math.ceil(records.length/50)} transactie-imports. Bestaande redactionele gegevens blijven behouden.`);
