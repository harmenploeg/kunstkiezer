import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs';
const dir='supabase/discovery-imports';mkdirSync(dir,{recursive:true});
for(const file of readdirSync(dir))if(/^discovery-\d+\.sql$/.test(file))unlinkSync(`${dir}/${file}`);
const categories=['openbare-kunst','beeldenparken','architectuur','evenementen'];
const rows=categories.flatMap(c=>JSON.parse(readFileSync(`data/discovery/${c}.json`,'utf8')));
const columns=['id','inventory_key','category','name','city','province','street_address','website_url','summary','creator','year','tags','photos','sources','selection_reason','visit_notes','museum_id','starts_on','ends_on','operating_status','publication_status'];
for(let i=0;i<rows.length;i+=25){
 const data=JSON.stringify(rows.slice(i,i+25).map(r=>Object.fromEntries(columns.map(k=>[k,r[k]])))).replaceAll("'","''");
 writeFileSync(`${dir}/discovery-${String(i/25+1).padStart(3,'0')}.sql`,`-- Generated from data/discovery/*.json. Existing editorial work is never overwritten.\nbegin;\ninsert into public.kk_discoveries (${columns.join(',')})\nselect ${columns.map(c=>'r.'+c).join(',')} from jsonb_populate_recordset(null::public.kk_discoveries,'${data}'::jsonb) r\non conflict do nothing;\ncommit;\n`);
}
console.log(`${rows.length} discovery records in ${Math.ceil(rows.length/25)} batches.`);
