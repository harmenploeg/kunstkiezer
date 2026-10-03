import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const editor='00000000-0000-4000-8000-000000000001', visitor='00000000-0000-4000-8000-000000000002';
async function database(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[editor,'editor@example.test',visitor,'visitor@example.test']);
 await db.query('insert into kunstkiezer_private.editors(user_id) values($1)',[editor]);
 return db;
}
async function role(db:PGlite,which:'anon'|'authenticated',uid=''){await db.exec(`reset role;set role ${which};`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);}
const payload={name:'Testmuseum',city:'Utrecht',province:'Utrecht',street_address:'Teststraat 1',postal_code:'',country:'NL',website_url:'https://example.test',latitude:null,longitude:null,summary:'',operating_status:'open',publication_status:'draft',is_art_museum:true,photos:[],tags:['kunst']};
test('RLS houdt concepten en interne notities privé; bezoekers kunnen zichzelf geen editor maken',async()=>{
 const db=await database();try{
 await role(db,'authenticated',editor);
 const {rows}=await db.query<{id:string}>('select * from public.kk_save_museum($1,null,null,$2)',[payload,'Interne notitie']);assert.equal(rows.length,1);
 await role(db,'anon');assert.equal((await db.query('select * from public.kk_museums')).rows.length,0);
 await assert.rejects(db.query('select * from public.kk_museum_editorial'));
 await role(db,'authenticated',visitor);assert.equal((await db.query<{allowed:boolean}>('select public.kk_is_editor() as allowed')).rows[0]?.allowed,false);
 await assert.rejects(db.query('select * from public.kk_save_museum($1,null,null,$2)',[payload,'Onbevoegd']));
 await assert.rejects(db.query('insert into kunstkiezer_private.editors(user_id) values($1)',[visitor]));
 }finally{await db.close();}
});
test('Publiceren vereist een kunstmuseum; atomic save beschermt museum en notities tegen verloren updates',async()=>{
 const db=await database();try{
 await role(db,'authenticated',editor);
 await assert.rejects(db.query('select * from public.kk_save_museum($1,null,null,$2)',[{...payload,is_art_museum:false,publication_status:'published'},'Geen kunstmuseum']));
 const original=(await db.query<{id:string;updated_at:Date}>('select * from public.kk_save_museum($1,null,null,$2)',[payload,'Eerste notitie'])).rows[0]!;
 const approved={...payload,publication_status:'published'};
 await db.query('select * from public.kk_save_museum($1,$2,$3,$4)',[approved,original.id,original.updated_at,'Gecontroleerd']);
 await assert.rejects(db.query('select * from public.kk_save_museum($1,$2,$3,$4)',[{...approved,name:'Overschreven'},original.id,original.updated_at,'Verloren update']));
 assert.equal((await db.query<{review_notes:string}>('select review_notes from public.kk_museum_editorial')).rows[0]?.review_notes,'Gecontroleerd');
 await role(db,'anon');assert.equal((await db.query('select * from public.kk_museums')).rows.length,1);
 await assert.rejects(db.query('update public.kk_museums set name=$1',['Onbevoegd']));
 }finally{await db.close();}
});
test('Alle inventarisbatches zijn importeerbaar en opnieuw importeren behoudt bewerkingen',async()=>{
 const db=await database();try{
 const files=readdirSync('supabase/imports').filter(f=>f.endsWith('.sql')).sort();assert.ok(files.length>0);
 for(const file of files)await db.exec(readFileSync(`supabase/imports/${file}`,'utf8'));
 const expected=JSON.parse(readFileSync('data/museums/inventory.json','utf8')).length;
 assert.equal((await db.query<{n:number}>('select count(*)::int as n from public.kk_museums')).rows[0]?.n,expected);
 const first=(await db.query<{id:string}>('select id from public.kk_museums order by id limit 1')).rows[0]!;
 await db.query('update public.kk_museums set name=$1 where id=$2',['Redactionele wijziging',first.id]);
 for(const file of files)await db.exec(readFileSync(`supabase/imports/${file}`,'utf8'));
 assert.equal((await db.query<{name:string}>('select name from public.kk_museums where id=$1',[first.id])).rows[0]?.name,'Redactionele wijziging');
 }finally{await db.close();}
});

test('Collectietekst maximaal 80 woorden en foto’s blijven bewaard',async()=>{
 const db=await database();try{await role(db,'authenticated',editor);
 const photos=[{url:'https://example.test/photo.jpg',caption:'Museum',credit:'Maker',source_url:'https://example.test',license:'CC BY'}];
 const good={...payload,summary:Array(80).fill('kunst').join(' '),photos};
 const row=(await db.query<{photos:unknown}>('select * from public.kk_save_museum($1,null,null,$2)',[good,''])).rows[0];
 assert.deepEqual(row?.photos,photos);
 await assert.rejects(db.query('select * from public.kk_save_museum($1,null,null,$2)',[{...good,summary:good.summary+' kunst'},'']));
 await assert.rejects(db.query('select * from public.kk_save_museum($1,null,null,$2)',[{...good,photos:[{url:'javascript:alert(1)'}]},'']));
 }finally{await db.close();}
});
