import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const rows=JSON.parse(readFileSync('data/locations/coordinates.json','utf8'));
mkdirSync('supabase/location-imports',{recursive:true});
for(let start=0;start<rows.length;start+=50){
 const batch=JSON.stringify(rows.slice(start,start+50));
 if(batch.includes('$locations$'))throw Error('Unsafe SQL delimiter');
 const sql=`-- Public destination coordinates from PDOK / existing museum records. No visitor data.
-- Preserve coordinates and any changed address; repeatable without overwriting editorial work.
with input as (select * from jsonb_to_recordset($locations$${batch}$locations$::jsonb) as x(id uuid,kind text,city text,street_address text,latitude double precision,longitude double precision,coordinate_precision text,coordinate_source text)),
m as (update public.kk_museums m set latitude=x.latitude,longitude=x.longitude,coordinate_precision=x.coordinate_precision,coordinate_source=x.coordinate_source from input x where x.kind='museum' and m.id=x.id and m.is_art_museum and m.latitude is null and m.longitude is null and m.city=x.city and m.street_address=x.street_address returning m.id),
d as (update public.kk_discoveries d set latitude=x.latitude,longitude=x.longitude,coordinate_precision=x.coordinate_precision,coordinate_source=x.coordinate_source from input x where x.kind='discovery' and d.id=x.id and d.latitude is null and d.longitude is null and d.city=x.city and d.street_address=x.street_address returning d.id)
select (select count(*) from m) as museums_updated,(select count(*) from d) as discoveries_updated;
`;
 writeFileSync(`supabase/location-imports/${String(1+start/50).padStart(2,'0')}-coordinates.sql`,sql);
}
console.log(`${rows.length} destination coordinates in ${Math.ceil(rows.length/50)} repeatable batches.`);
