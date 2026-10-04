import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const editor='00000000-0000-4000-8000-000000000001', visitor='00000000-0000-4000-8000-000000000002';
async function database(publishMigration=true){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&(publishMigration||!f.endsWith('_publish_curated_catalogs.sql'))).sort())await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
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

test('Landelijke kunstuitbreiding is herhaalbaar en beschermt bestaande kunst en redactiewerk',async()=>{
 const db=await database();try{
 for(const file of readdirSync('supabase/imports').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/imports/${file}`,'utf8'));
 const additions=JSON.parse(readFileSync('data/museums/art-expansion-2026-10-03.json','utf8'));
 const existing=(await db.query<{id:string}>('select id from public.kk_museums where id=any($1::uuid[]) limit 2',[additions.map((r:{id:string})=>r.id)])).rows;
 assert.equal(existing.length,2);
 await db.query("update public.kk_museums set is_art_museum=true,summary='Bestaande kunsttekst' where id=$1",[existing[0]!.id]);
 await role(db,'authenticated',editor);
 const edited=(await db.query<{updated_at:Date}>('select updated_at from public.kk_museums where id=$1',[existing[1]!.id])).rows[0]!;
 await db.query('select * from public.kk_save_museum($1,$2,$3,$4)',[{...payload,is_art_museum:false,name:'Bewust bewerkt'},existing[1]!.id,edited.updated_at,'Behoud notitie']);
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");
 const files=readdirSync('supabase/art-imports').filter(f=>f.endsWith('.sql')).sort();
 for(const file of files)await db.exec(readFileSync(`supabase/art-imports/${file}`,'utf8'));
 assert.equal((await db.query<{summary:string}>('select summary from public.kk_museums where id=$1',[existing[0]!.id])).rows[0]!.summary,'Bestaande kunsttekst');
 assert.equal((await db.query<{name:string}>('select name from public.kk_museums where id=$1',[existing[1]!.id])).rows[0]!.name,'Bewust bewerkt');
 const snapshot=await db.query('select * from public.kk_museums order by id');
 const notes=await db.query('select * from public.kk_museum_editorial order by museum_id');
 for(const file of files)await db.exec(readFileSync(`supabase/art-imports/${file}`,'utf8'));
 assert.deepEqual((await db.query('select * from public.kk_museums order by id')).rows,snapshot.rows);
 assert.deepEqual((await db.query('select * from public.kk_museum_editorial order by museum_id')).rows,notes.rows);
 await role(db,'anon');assert.equal((await db.query('select * from public.kk_museums')).rows.length,0);
 }finally{await db.close();}
});

test('Nieuwe collecties: RLS, agenda-venster, notities en optimistische vergrendeling',async()=>{
 const db=await database();try{
 await role(db,'authenticated',editor);
 const base={category:'evenementen',name:'Testtentoonstelling',city:'Utrecht',province:'Utrecht',street_address:'Teststraat',website_url:'https://example.test',summary:'Kunst om te ontdekken.',creator:'',year:'',tags:['fotografie'],photos:[],sources:[{provider:'Museum',url:'https://example.test'}],selection_reason:'Een specifieke fotografische blik.',visit_notes:'',museum_id:null,starts_on:'2000-01-01',ends_on:'2100-01-01',operating_status:'open',publication_status:'published'};
 const saved=(await db.query<{id:string;updated_at:Date}>('select * from public.kk_save_discovery($1,null,null,$2)',[base,'Privé'])).rows[0]!;
 for(const variation of [{publication_status:'draft'},{starts_on:'2000-01-01',ends_on:'2000-12-31'},{starts_on:'2100-01-01',ends_on:'2100-12-31'}])await db.query('select * from public.kk_save_discovery($1,null,null,$2)',[{...base,...variation},'Niet publiek']);
 await assert.rejects(db.query('select * from public.kk_save_discovery($1,null,null,$2)',[{...base,ends_on:null},'Ongeldig']));
 await db.query('select * from public.kk_save_discovery($1,$2,$3,$4)',[{...base,name:'Bewerkt'},saved.id,saved.updated_at,'Bewaard']);
 await assert.rejects(db.query('select * from public.kk_save_discovery($1,$2,$3,$4)',[base,saved.id,saved.updated_at,'Overschrijven']));
 assert.equal((await db.query<{review_notes:string}>('select review_notes from public.kk_discovery_editorial where discovery_id=$1',[saved.id])).rows[0]?.review_notes,'Bewaard');
 await role(db,'anon');assert.equal((await db.query('select * from public.kk_discoveries')).rows.length,1);await assert.rejects(db.query('select * from public.kk_discovery_editorial'));
 await role(db,'authenticated',visitor);assert.equal((await db.query('select * from public.kk_discoveries')).rows.length,1);await assert.rejects(db.query('select * from public.kk_save_discovery($1,null,null,$2)',[base,'Onbevoegd']));
 assert.equal((await db.query('select * from public.kk_discovery_editorial')).rows.length,0);
 await db.query("update public.kk_discoveries set name='Onbevoegd' where id=$1",[saved.id]);
 assert.equal((await db.query<{name:string}>('select name from public.kk_discoveries where id=$1',[saved.id])).rows[0]?.name,'Bewerkt');
 }finally{await db.close();}
});
test('Nieuwe collecties importeren herhaalbaar zonder museum- of redactiewerk te overschrijven',async()=>{
 const db=await database();try{
 for(const file of readdirSync('supabase/imports').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/imports/${file}`,'utf8'));
 for(const file of readdirSync('supabase/art-imports').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/art-imports/${file}`,'utf8'));
 const before=await db.query('select * from public.kk_museums order by id');
 const files=readdirSync('supabase/discovery-imports').filter(f=>f.endsWith('.sql')).sort();assert.ok(files.length);
 for(const file of files)await db.exec(readFileSync(`supabase/discovery-imports/${file}`,'utf8'));
 const row=(await db.query<{id:string}>('select id from public.kk_discoveries limit 1')).rows[0]!;await db.query("update public.kk_discoveries set name='Redactioneel bewerkt' where id=$1",[row.id]);
 const snapshot=await db.query('select * from public.kk_discoveries order by id');
 for(const file of files)await db.exec(readFileSync(`supabase/discovery-imports/${file}`,'utf8'));
 assert.deepEqual((await db.query('select * from public.kk_discoveries order by id')).rows,snapshot.rows);assert.deepEqual((await db.query('select * from public.kk_museums order by id')).rows,before.rows);
 }finally{await db.close();}
});

test('Eenmalige publicatie publiceert uitsluitend concepten in de vijf keuzes en bewaart bezoekstatus en inhoud',async()=>{
 const db=await database(false);try{
 await role(db,'authenticated',editor);
 const art=(await db.query<{id:string}>('select * from public.kk_save_museum($1,null,null,$2)',[{...payload,name:'Gesloten kunstmuseum',city:'',street_address:'',operating_status:'closed'},'Privé behouden'])).rows[0]!;
 await db.query('select * from public.kk_save_museum($1,null,null,$2)',[{...payload,is_art_museum:false,name:'Geen kunstmuseum'},'Niet publiceren']);
 await db.query('select * from public.kk_save_museum($1,null,null,$2)',[{...payload,publication_status:'archived',name:'Archief'},'Niet publiceren']);
 const discovery={category:'openbare-kunst',name:'Historisch werk',city:'',province:'',street_address:'',website_url:'',summary:'Een historisch kunstwerk.',creator:'',year:'',tags:['kunst'],photos:[],sources:[{provider:'Bron',url:'https://example.test'}],selection_reason:'Sleutelwerk.',visit_notes:'Locatie onbekend.',museum_id:null,starts_on:null,ends_on:null,operating_status:'unknown',publication_status:'draft'};
 await db.query('select * from public.kk_save_discovery($1,null,null,$2)',[discovery,'Interne notitie']);
 await db.exec('reset role');const before=await db.query("select to_jsonb(m)-'publication_status'-'updated_at' as value from kk_museums m order by id");
 const migration=readdirSync('supabase/migrations').find(f=>f.endsWith('_publish_curated_catalogs.sql'))!;await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
 assert.deepEqual((await db.query("select to_jsonb(m)-'publication_status'-'updated_at' as value from kk_museums m order by id")).rows,before.rows);
 assert.equal((await db.query<{n:number}>("select count(*)::int n from kk_museums where publication_status='published'")).rows[0]?.n,1);
 await role(db,'anon');const visible=(await db.query<{id:string;operating_status:string}>('select * from kk_museums')).rows;assert.equal(visible.length,1);assert.equal(visible[0]?.id,art.id);assert.equal(visible[0]?.operating_status,'closed');
 assert.equal((await db.query<{operating_status:string}>('select * from kk_discoveries')).rows[0]?.operating_status,'unknown');
 await assert.rejects(db.query('select * from kk_discovery_editorial'));await assert.rejects(db.query('select * from kk_museum_editorial'));
 }finally{await db.close();}
});

test('Rangschikking is publiek leesbaar, alleen redacteur schrijft, bewaart balans en voorkomt overschrijven',async()=>{
 const db=await database();try{
 await role(db,'anon');const original=(await db.query<{updated_at:Date;distance_weight:number}>('select * from public.kk_ranking_settings')).rows[0]!;assert.equal(original.distance_weight,56);
 await assert.rejects(db.query('update public.kk_ranking_settings set distance_weight=50,tag_weight=50'));
 await role(db,'authenticated',visitor);assert.equal((await db.query('update public.kk_ranking_settings set distance_weight=50,tag_weight=50 returning *')).rows.length,0);
 await assert.rejects(db.query('select * from public.kk_save_ranking_settings(50,50,30,$1)',[original.updated_at]));
 await role(db,'authenticated',editor);
 await assert.rejects(db.query('select * from public.kk_save_ranking_settings(80,50,30,$1)',[original.updated_at]));
 await assert.rejects(db.query('select * from public.kk_save_ranking_settings(50,50,0,$1)',[original.updated_at]));
 const changed=(await db.query<{distance_weight:number}>(`select * from public.kk_save_ranking_v2('{"distance_weight":60,"tag_weight":20,"rating_weight":20,"rating_prior":5,"distance_scale_km":40}', $1)`,[original.updated_at])).rows[0]!;assert.equal(changed.distance_weight,60);
 await assert.rejects(db.query('select * from public.kk_save_ranking_settings(50,50,30,$1)',[original.updated_at]));
 await role(db,'anon');assert.equal((await db.query<{tag_weight:number}>('select tag_weight from public.kk_ranking_settings')).rows[0]!.tag_weight,20);
 }finally{await db.close();}
});
test('Coördinaten en nauwkeurigheid worden bewaard, ook bij opslaan door een oudere redactietool',async()=>{
 const db=await database();try{await role(db,'authenticated',editor);
 const input={category:'architectuur',name:'Gebouw',city:'Utrecht',province:'Utrecht',street_address:'',website_url:'',summary:'',creator:'',year:'',tags:['kunst'],photos:[],sources:[],selection_reason:'',visit_notes:'',museum_id:null,starts_on:null,ends_on:null,operating_status:'open',publication_status:'draft'};
 const row=(await db.query<{id:string;updated_at:Date;latitude:number}>('select * from public.kk_save_discovery($1)',[{...input,latitude:52,longitude:5,coordinate_precision:'city',coordinate_source:'PDOK'}])).rows[0]!;assert.equal(row.latitude,52);
 const changed=(await db.query<{id:string;updated_at:Date;latitude:number;coordinate_precision:string}>('select * from public.kk_save_discovery($1,$2,$3,$4)',[input,row.id,row.updated_at,'privé'])).rows[0]!;assert.equal(changed.latitude,52);assert.equal(changed.coordinate_precision,'city');
 await assert.rejects(db.query('select * from public.kk_save_discovery($1,$2,$3,$4)',[{...input,latitude:52,longitude:null},row.id,changed.updated_at,'']));
 const cleared=(await db.query<{latitude:null}>('select * from public.kk_save_discovery($1,$2,$3,$4)',[{...input,latitude:null,longitude:null},row.id,changed.updated_at,''])).rows[0]!;assert.equal(cleared.latitude,null);
 const museum=(await db.query<{coordinate_precision:string}>('select * from public.kk_save_museum($1)',[{...payload,latitude:52,longitude:5,coordinate_precision:'address',coordinate_source:'PDOK'}])).rows[0]!;assert.equal(museum.coordinate_precision,'address');
 }finally{await db.close();}
});

test('Maandagbronnen zijn uitsluitend bewerkbaar door redacteurs; wijzigingen en verwijderingen hebben conflictcontrole',async()=>{
 const db=await database();try{
 await role(db,'anon');await assert.rejects(db.query('select * from public.kk_update_sources'));
 await role(db,'authenticated',visitor);assert.equal((await db.query('select * from public.kk_update_sources')).rows.length,0);
 const source={name:'Gemeentelijke collectie',url:'https://example.test/kunst',notes:'Beoordeel alle relevante categorieën.',enabled:true};
 await assert.rejects(db.query('select * from public.kk_save_update_source($1)',[source]));
 await assert.rejects(db.query('insert into public.kk_update_sources(name,url) values($1,$2)',['Verboden','https://example.test']));
 await role(db,'authenticated',editor);assert.equal((await db.query('select * from public.kk_update_sources')).rows.length,15);
 const row=(await db.query<{id:string;revision:string}>('select id,updated_at::text as revision from public.kk_save_update_source($1)',[source])).rows[0]!;
 const changed=(await db.query<{revision:string;enabled:boolean}>('select updated_at::text as revision,enabled from public.kk_save_update_source($1,$2,$3)',[{...source,enabled:false},row.id,row.revision])).rows[0]!;
 assert.equal(changed.enabled,false);
 await assert.rejects(db.query('select * from public.kk_save_update_source($1,$2,$3)',[source,row.id,row.revision]));
 await assert.rejects(db.query('select public.kk_delete_update_source($1,$2)',[row.id,row.revision]));
 await assert.rejects(db.query('select * from public.kk_save_update_source($1)',[{...source,url:'javascript:alert(1)'}]));
 await assert.rejects(db.query('select * from public.kk_save_update_source($1)',[{...source,url:'',notes:''}]));
 await role(db,'authenticated',visitor);
 assert.equal((await db.query('update public.kk_update_sources set name=$1 where id=$2 returning id',['Onbevoegd',row.id])).rows.length,0);
 assert.equal((await db.query('delete from public.kk_update_sources where id=$1 returning id',[row.id])).rows.length,0);
 await assert.rejects(db.query('select public.kk_delete_update_source($1,$2)',[row.id,changed.revision]));
 await role(db,'authenticated',editor);await db.query('select public.kk_delete_update_source($1,$2)',[row.id,changed.revision]);
 assert.equal((await db.query('select * from public.kk_update_sources where id=$1',[row.id])).rows.length,0);
 }finally{await db.close();}
});

test('Accounts: eigen profiel en bezoeken, conflicten en geen inzage door beheerders',async()=>{
 const db=await database();try{
 await role(db,'authenticated',visitor);
 const row=(await db.query<{updated_at:Date}>('select * from public.kk_save_profile($1,true,null)',[['fotografie']])).rows[0]!;
 await db.query('insert into public.kk_seen(user_id,item_id,category,name,rating) values($1,$2,$3,$4,5)',[visitor,editor,'musea','Eigen bezoek']);
 await assert.rejects(db.query('insert into public.kk_seen(user_id,item_id,category,name,rating) values($1,$2,$3,$4,6)',[visitor,visitor,'musea','Ongeldige score']));
 await assert.rejects(db.query('insert into public.kk_profiles(user_id,tags) values($1,$2)',[editor,['ongewenst']]));
 await db.query('select * from public.kk_save_profile($1,true,$2)',[['design'],row.updated_at]);
 await assert.rejects(db.query('select * from public.kk_save_profile($1,true,$2)',[['oude gegevens'],row.updated_at]));
 await db.query("update public.kk_seen set status='wanted',rating=null where user_id=$1",[visitor]);
 assert.equal((await db.query<{status:string}>("select status from public.kk_seen")).rows[0]?.status,'wanted');
 await assert.rejects(db.query("update public.kk_seen set rating=5"));
 await assert.rejects(db.query("update public.kk_seen set status='invalid'"));
 await assert.rejects(db.query("update public.kk_seen set user_id=$1",[editor]));
 await role(db,'authenticated',editor);
 assert.equal((await db.query("update public.kk_seen set status='seen' returning item_id")).rows.length,0);
 assert.equal((await db.query('select * from public.kk_profiles')).rows.length,0);
 assert.equal((await db.query('select * from public.kk_seen')).rows.length,0);
 await role(db,'anon');await assert.rejects(db.query('select * from public.kk_profiles'));await assert.rejects(db.query('select * from public.kk_seen'));
 }finally{await db.close();}
});
test('Beheerrechten: alleen beheerders mogen rollen wijzigen; laatste beheerder beschermd',async()=>{
 const db=await database();try{
 await role(db,'authenticated',visitor);await assert.rejects(db.query('select * from public.kk_list_members()'));await assert.rejects(db.query('select public.kk_set_admin($1,true)',[visitor]));
 await role(db,'authenticated',editor);assert.equal((await db.query('select * from public.kk_list_members()')).rows.length,2);
 await assert.rejects(db.query('select public.kk_set_admin($1,false)',[editor]));
 await db.query('select public.kk_set_admin($1,true)',[visitor]);
 await role(db,'authenticated',visitor);assert.equal((await db.query<{allowed:boolean}>('select public.kk_is_editor() allowed')).rows[0]?.allowed,true);
 await db.query('select public.kk_set_admin($1,false)',[editor]);
 await role(db,'authenticated',editor);await assert.rejects(db.query('select * from public.kk_list_members()'));
 await db.exec('reset role');await assert.rejects(db.query('delete from auth.users where id=$1',[visitor]));
 await db.query('delete from auth.users where id=$1',[editor]);
 }finally{await db.close();}
});
test('Updates: alleen beheer kan aanvragen, deduplicatie, alleen vertrouwde runner, schema en zomertijd',async()=>{
 const db=await database();try{
 await role(db,'anon');await assert.rejects(db.query('select public.kk_request_update()'));
 await role(db,'authenticated',visitor);await assert.rejects(db.query('select public.kk_request_update()'));assert.equal((await db.query('select * from public.kk_update_schedule')).rows.length,0);
 await role(db,'authenticated',editor);
 const first=(await db.query<{id:string}>('select public.kk_request_update() id')).rows[0]!.id;
 assert.equal((await db.query<{id:string}>('select public.kk_request_update() id')).rows[0]!.id,first);
 await assert.rejects(db.query('select * from kunstkiezer_private.claim_update()'));
 await assert.rejects(db.query("update public.kk_update_runs set status='completed'"));
 await db.query("update public.kk_update_schedule set weekday=2,local_time='11:30' where id");
 await db.exec('reset role');assert.equal((await db.query('select * from kunstkiezer_private.claim_update()')).rows.length,1);assert.equal((await db.query('select * from kunstkiezer_private.claim_update()')).rows.length,0);
 await db.query("update public.kk_update_runs set status='completed',finished_at=now() where id=$1",[first]);
 const next=(await db.query<{due:Date}>("select kunstkiezer_private.next_update(1,'09:00','2026-10-24T12:00:00Z') due")).rows[0]!.due;
 assert.equal(next.toISOString(),'2026-10-26T08:00:00.000Z');
 }finally{await db.close();}
});

test('Verdwenen aanbod is privé en gezamenlijke sterren lekken geen individuele stemmen',async()=>{
 const db=await database();try{
 await role(db,'authenticated',editor);
 const row=(await db.query<{id:string}>('select * from kk_save_museum($1)',[{...payload,publication_status:'published'}])).rows[0]!;
 await db.exec('reset role');
 const third='00000000-0000-4000-8000-000000000003';await db.query('insert into auth.users(id,email) values($1,$2)',[third,'third@example.test']);
 for(const [id,stars] of [[editor,5],[visitor,1]] as const)await db.query('insert into public.kk_seen(user_id,item_id,category,name,rating) values($1,$2,\'musea\',\'test\',$3)',[id,row.id,stars]);
 await role(db,'anon');assert.equal((await db.query('select * from kk_rating_totals()')).rows.length,0);await assert.rejects(db.query('select * from kk_seen'));
 await db.exec('reset role');await db.query('insert into public.kk_seen(user_id,item_id,category,name,rating) values($1,$2,\'musea\',\'test\',4)',[third,row.id]);
 await role(db,'anon');const aggregate=(await db.query<{votes:number;stars:number[]}>('select * from kk_rating_totals()')).rows[0]!;assert.equal(Number(aggregate.votes),3);assert.deepEqual(aggregate.stars.map(Number),[1,0,0,1,1]);assert.deepEqual(Object.keys(aggregate).sort(),['category','item_id','stars','votes']);
 await role(db,'authenticated',visitor);assert.equal((await db.query('update kk_preference_questions set questions=\'[]\' returning id')).rows.length,0);
 await role(db,'authenticated',editor);await db.query("update kk_museums set operating_status='disappeared' where id=$1",[row.id]);
 await role(db,'anon');assert.equal((await db.query('select * from kk_museums')).rows.length,0);assert.equal((await db.query('select * from kk_rating_totals()')).rows.length,0);
 }finally{await db.close();}
});

test('Archiveren is alleen voor beheerders, verbergt aanbod en bewaart gegevens; herstel blijft concept',async()=>{
 const db=await database();try{
 await role(db,'authenticated',editor);
 const museum=(await db.query<{id:string;updated_at:Date}>('select * from public.kk_save_museum($1,null,null,$2)',[{...payload,publication_status:'published'},'Bewaren'])).rows[0]!;
 const discovery=(await db.query<{id:string;updated_at:Date}>("insert into public.kk_discoveries(category,name,city,summary,selection_reason,tags,sources,publication_status,operating_status) values('openbare-kunst','Testbeeld','Utrecht','Een beeld','Opvallend',array['kunst'],'[{\"provider\":\"Test\",\"url\":\"https://example.test\"}]','published','open') returning id,updated_at")).rows[0]!;
 for(const [table,row] of [['kk_museums',museum],['kk_discoveries',discovery]] as const){
  await role(db,'authenticated',visitor);
  assert.equal((await db.query(`update public.${table} set publication_status='archived' where id=$1 returning id`,[row.id])).rows.length,0);
  await role(db,'authenticated',editor);
  assert.equal((await db.query(`update public.${table} set publication_status='archived' where id=$1 and updated_at=$2 returning id`,[row.id,row.updated_at])).rows.length,1);
  assert.equal((await db.query(`update public.${table} set publication_status='draft' where id=$1 and updated_at=$2 returning id`,[row.id,row.updated_at])).rows.length,0);
  await role(db,'anon');assert.equal((await db.query(`select id from public.${table} where id=$1`,[row.id])).rows.length,0);
  await role(db,'authenticated',editor);assert.equal((await db.query(`select id from public.${table} where id=$1`,[row.id])).rows.length,1);
  await db.query(`update public.${table} set publication_status='draft' where id=$1`,[row.id]);
  await role(db,'anon');assert.equal((await db.query(`select id from public.${table} where id=$1`,[row.id])).rows.length,0);
 }
 await role(db,'authenticated',editor);assert.equal((await db.query<{review_notes:string}>('select review_notes from public.kk_museum_editorial where museum_id=$1',[museum.id])).rows[0]?.review_notes,'Bewaren');
 }finally{await db.close();}
});
