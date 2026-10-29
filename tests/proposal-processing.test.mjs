import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {atomicJson} from '../scripts/weekly-updater.mjs';
import {inspectProposal,approveProposal,applicationSql,applyProposal,stagePublication,verifyPublication,verifyControlledDeployment,PRODUCTION,SUPABASE,CATEGORIES} from '../scripts/proposal-processing.mjs';
const id1='00000000-0000-4000-a000-000000000001',id2='00000000-0000-4000-a000-000000000002',stamp='2026-10-29T12:00:00+00:00';
const baseRecord=(id=id1)=>({record_table:'kk_discoveries',id,name:'Fontein',summary:'Een fontein.',visit_notes:'Oude tekst',starts_on:null,ends_on:null,operating_status:'open',updated_at:stamp});
const changes=(id=id1)=>[{record_id:id,table:'kk_discoveries',field:'visit_notes',before:'Oude tekst',after:'Onderhoud op woensdag.',expected_updated_at:stamp,evidence_url:'https://example.test/faq',evidence_quote:'Onderhoud op woensdag.'}];
const makeBundle=()=>({source:{id:'source1',name:'Bron',url:'https://example.test/',updated_at:stamp},records:[baseRecord(),baseRecord(id2)],pages:[{url:'https://example.test/faq',text:'Bezoekinformatie: Onderhoud op woensdag.'}]});
const makeArtifact=(cs=changes())=>({source_id:'source1',status:'needs_review',summary:'Bezoekinformatie corrigeren.',changes:cs,candidates:[],catalog_changed:false,published:false});
const fetchEvidence=async()=>new Response('<p>Bezoekinformatie: Onderhoud op woensdag.</p>',{headers:{'content-type':'text/html'}});
async function fixture(fn){
 const dir=await mkdtemp(path.join(tmpdir(),'kk-process-')),db=new PGlite();
 try{
 await db.exec(`create table kk_update_sources(id text primary key,enabled boolean,updated_at timestamptz);insert into kk_update_sources values('source1',true,'${stamp}');
 create table kk_update_runs(id uuid primary key,reason text,status text,started_at timestamptz,finished_at timestamptz,summary text);
 create unique index one_active on kk_update_runs((true)) where status in ('queued','running');
 create table kk_discoveries(id uuid primary key,name text,summary text,visit_notes text,starts_on date,ends_on date,operating_status text,publication_status text,category text,updated_at timestamptz,check(ends_on is null or starts_on is null or ends_on>=starts_on));
 create table kk_museums(id uuid primary key,name text,summary text,operating_status text,publication_status text,is_art_museum boolean,updated_at timestamptz);
 create table kk_update_changes(id uuid primary key,run_id uuid references kk_update_runs,change text,record_table text,record_id uuid,record_name text,fields text[],source_id text references kk_update_sources,source_url text,note text);
 create function touch_record() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp();return new;end$$;
 create trigger touch before update on kk_discoveries for each row execute function touch_record();
 insert into kk_discoveries values('${id1}','Fontein','Een fontein.','Oude tekst',null,null,'open','published','openbare-kunst','${stamp}'),('${id2}','Tweede','Een fontein.','Oude tekst',null,null,'open','published','openbare-kunst','${stamp}');`);
 const sql=async q=>(await db.exec(q)).at(-1)?.rows||[],bundle=makeBundle(),artifact=makeArtifact(),file=path.join(dir,'proposal.json');
 artifact.bundle_file=path.join(dir,'input.json');await atomicJson(artifact.bundle_file,bundle);await atomicJson(file,artifact);
 const approve=async()=>{const digest=inspectProposal(artifact,bundle).digest;await approveProposal(file,digest,'redacteur');return digest;};
 await fn({dir,db,sql,bundle,artifact,file,approve});
 }finally{await db.close();await rm(dir,{recursive:true,force:true});}
}
test('goedkeuring bindt exact voorstel en bronpakket; gewijzigde inhoud is ongeldig',()=>fixture(async f=>{
 const digest=await f.approve();f.artifact.summary='Gewijzigd na beoordeling';await atomicJson(f.file,f.artifact);
 await assert.rejects(applyProposal({file:f.file,sql:()=>assert.fail()}),/approval_required/);
 await assert.rejects(approveProposal(f.file,digest,'redacteur'),/approval_does_not_match/);
}));
test('één database-transactie schrijft alleen goedgekeurde velden en audit, zonder dubbel toepassen',()=>fixture(async f=>{
 await f.approve();let r=await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});assert.equal(r.status,'database_verified');assert.equal(r.published,false);
 const row=(await f.sql(`select * from kk_discoveries where id='${id1}'`))[0];assert.equal(row.visit_notes,'Onderhoud op woensdag.');assert.equal(row.summary,'Een fontein.');
 r=await applyProposal({file:f.file,sql:f.sql,fetcher:()=>assert.fail()});assert.equal(r.status,'database_verified');assert.equal((await f.sql('select * from kk_update_changes')).length,1);
 assert.equal((await f.sql('select * from kk_update_runs'))[0].status,'failed');
}));
test('tweede record met redactiewijziging rolt alle wijzigingen en audit terug',()=>fixture(async f=>{
 f.artifact.changes=[...changes(),...changes(id2)];await atomicJson(f.file,f.artifact);await f.approve();await f.sql(`update kk_discoveries set summary='Handmatige redactie' where id='${id2}'`);
 await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence}),/record_version_conflict/);
 assert.equal((await f.sql(`select visit_notes from kk_discoveries where id='${id1}'`))[0].visit_notes,'Oude tekst');assert.equal((await f.sql('select * from kk_update_changes')).length,0);assert.equal((await f.sql('select * from kk_update_runs')).length,0);
}));
test('gewijzigde oorspronkelijke waarde blokkeert ook wanneer timestamp gelijk is',()=>fixture(async f=>{
 await f.approve();await f.sql('alter table kk_discoveries disable trigger touch');await f.sql(`update kk_discoveries set visit_notes='Redactie' where id='${id1}'`);
 await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence}),/original_value_conflict/);
}));
test('uitgeschakelde bron, verdwenen bewijs en actieve andere update blokkeren schrijven',()=>fixture(async f=>{
 await f.approve();await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:async()=>new Response('ander bericht',{headers:{'content-type':'text/html'}})}),/evidence_changed/);
 await f.sql("update kk_update_sources set enabled=false");await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence}),/source_changed/);
 await f.sql("update kk_update_sources set enabled=true");await f.sql(`insert into kk_update_runs(id,status) values('${id2}','running')`);
 await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence}),/another_update/);
 assert.equal((await f.sql('select * from kk_update_changes')).length,0);
}));
test('twee wijzigingen op hetzelfde record gebruiken één versiecontrole en behouden overige velden',()=>fixture(async f=>{
 f.artifact.changes.push({...changes()[0],field:'summary',before:'Een fontein.',after:'Onderhoud op woensdag.'});await atomicJson(f.file,f.artifact);await f.approve();
 await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});assert.equal((await f.sql('select * from kk_update_changes')).length,2);
}));
test('onduidelijk netwerkantwoord na commit wordt uit database hersteld zonder dubbel schrijven',()=>fixture(async f=>{
 await f.approve();let writes=0;const sql=async q=>{const result=await f.sql(q);if(q.startsWith('DO ')){writes++;throw new Error('network_reply_lost');}return result;};
 const r=await applyProposal({file:f.file,sql,fetcher:fetchEvidence});assert.equal(r.status,'database_verified');assert.equal(writes,1);assert.equal((await f.sql('select * from kk_update_changes')).length,1);
}));
test('herstel na kapotte lokale receipt schrijft de catalogus niet opnieuw',()=>fixture(async f=>{
 await f.approve();await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence,store:async(file,value)=>{if(value.status==='database_verified')throw new Error('disk_full');await atomicJson(file,value);}}),/disk_full/);
 await applyProposal({file:f.file,sql:f.sql,fetcher:()=>assert.fail()});assert.equal((await f.sql('select * from kk_update_changes')).length,1);
 await f.sql(`update kk_discoveries set visit_notes='Latere redactie' where id='${id1}'`);await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:()=>assert.fail()}),/database_verification_failed/);
}));
test('lege wijzigingenlijst blijft een no-op; kandidaten worden niet toegevoegd',()=>fixture(async f=>{
 f.artifact.changes=[];await atomicJson(f.file,f.artifact);await f.approve();
 const r=await applyProposal({file:f.file,sql:()=>assert.fail()});assert.equal(r.status,'no_changes');assert.equal(r.catalog_changed,false);
}));
test('SQL-inhoud kan niet ontsnappen via veldwaarde, citaat of naam',()=>fixture(async f=>{
 const text="Onderhoud'; drop table kk_discoveries; --";f.bundle.pages[0].text=text;f.artifact.changes[0].evidence_quote=text;f.artifact.changes[0].after=text;
 await atomicJson(f.artifact.bundle_file,f.bundle);await atomicJson(f.file,f.artifact);await f.approve();
 await applyProposal({file:f.file,sql:f.sql,fetcher:async()=>new Response(text,{headers:{'content-type':'text/html'}})});
 assert.equal((await f.sql(`select visit_notes from kk_discoveries where id='${id1}'`))[0].visit_notes,text);assert.equal((await f.sql('select * from kk_discoveries')).length,2);
}));
test('publicatie vereist echte workflow, juiste productieconfig, publieke API en alle vijf downloads',()=>fixture(async f=>{
 await f.approve();await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});const releaseDirectory=path.join(f.dir,'release');const manifest=await stagePublication({file:f.file,sql:f.sql,directory:releaseDirectory});assert.equal(Object.keys(manifest.files).length,5);
 const deployment={run_id:'123',source_commit:'a'.repeat(40),integration_commit:'b'.repeat(40)};
 const verifyDeployment=async()=>({...deployment,verified:true});
 const fetcher=async url=>{
  if(url===PRODUCTION+'/api/config')return Response.json({APP_ENV:'production',PUBLIC_SUPABASE_URL:SUPABASE,PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
  if(url===PRODUCTION+'/version.json')return Response.json({repository:'harmenploeg/kunstkiezer',commit:deployment.source_commit});
  if(url.startsWith(SUPABASE+'/rest/v1/'))return Response.json([{id:id1,visit_notes:'Onderhoud op woensdag.'}]);
  return new Response(await readFile(path.join(releaseDirectory,new URL(url).pathname.slice(1))));
 };
 await assert.rejects(verifyPublication({file:f.file,sql:f.sql,releaseDirectory,fetcher}),/controlled_deployment_required/);
 await assert.rejects(verifyPublication({file:f.file,sql:f.sql,releaseDirectory,fetcher:async u=>u.endsWith('evenementen.json')?new Response('old export'):fetcher(u),deployment,verifyDeployment}),/production_download_mismatch/);
 assert.notEqual((await f.sql('select status from kk_update_runs'))[0].status,'completed');
 const r=await verifyPublication({file:f.file,sql:f.sql,releaseDirectory,fetcher,deployment,verifyDeployment});assert.equal(r.status,'verified');assert.equal(r.published,true);assert.equal((await f.sql('select status from kk_update_runs'))[0].status,'completed');
}));
test('workflowbewijs wordt opgehaald; een zelf opgegeven succesvlag telt niet',async()=>{
 const input={run_id:'123',source_commit:'a'.repeat(40),integration_commit:'b'.repeat(40),verified:true};
 await assert.rejects(verifyControlledDeployment(input,{run:async()=>({stdout:JSON.stringify({conclusion:'failure',status:'completed',headSha:input.integration_commit,name:'Controleer LOCI-publicatiepakket',url:'https://github.com/harmenploeg/interactief/actions/runs/123'})})}),/not_verified/);
});

test('ontbrekend auditbewijs blokkeert hernieuwde verificatie zonder herschrijven',()=>fixture(async f=>{
 await f.approve();await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});await f.sql('delete from kk_update_changes');
 await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:()=>assert.fail()}),/audit_verification_failed/);
}));
test('ongeldige datums en verboden velden worden vóór enige SQL geweigerd',()=>fixture(async f=>{
 const dateChange={...changes()[0],field:'ends_on',before:null,after:'2026-02-30'};f.artifact.changes=[dateChange];
 assert.throws(()=>inspectProposal(f.artifact,f.bundle),/invalid_calendar_date/);
 f.artifact.changes=[{...changes()[0],field:'publication_status',before:'published',after:'archived'}];assert.throws(()=>inspectProposal(f.artifact,f.bundle));
}));
test('gewijzigde bronversie blokkeert ook als de bron ingeschakeld blijft',()=>fixture(async f=>{
 await f.approve();await f.sql("update kk_update_sources set updated_at=now()");await assert.rejects(applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence}),/source_changed/);
}));
test('mislukte productiecontrole bewaart een hervatbare blokkade, geen successtatus',()=>fixture(async f=>{
 await f.approve();await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});
 await assert.rejects(verifyPublication({file:f.file,sql:f.sql,releaseDirectory:f.dir}),/publication_manifest_required/);
 const receipt=JSON.parse(await readFile(f.file+'.receipt.json','utf8'));assert.equal(receipt.status,'verification_blocked');assert.equal(receipt.published,false);
 const release=await stagePublication({file:f.file,sql:f.sql,directory:path.join(f.dir,'release')});assert.equal(release.status,'awaiting_controlled_deployment');
}));
test('workflowcontrole bindt gecontroleerde commit, productiecheck en exacte exportbestanden',async()=>{
 const {createHash}=await import('node:crypto');const bytes=Buffer.from('[]\n'),sha=createHash('sha256').update(bytes).digest('hex');
 const input={run_id:'123',source_commit:'a'.repeat(40),integration_commit:'b'.repeat(40),files:Object.fromEntries(['art-inventory.json',...CATEGORIES.map(c=>c+'.json')].map(n=>[n,{sha256:sha}]))};
 const run=async(_cmd,args)=>{
  if(args[0]==='run')return {stdout:JSON.stringify({name:'Controleer LOCI-publicatiepakket',conclusion:'success',status:'completed',headSha:input.integration_commit,url:'https://github.com/harmenploeg/interactief/actions/runs/123'})};
  if(args[1].includes('check-runs'))return {stdout:JSON.stringify({check_runs:[{name:'Loci gecontroleerde productie',status:'completed',conclusion:'success',head_sha:input.integration_commit}]})};
  const data=args[1].includes('version.json')?Buffer.from(JSON.stringify({repository:'harmenploeg/kunstkiezer',commit:input.source_commit})):bytes;
  return {stdout:JSON.stringify({encoding:'base64',content:data.toString('base64')})};
 };
 assert.equal((await verifyControlledDeployment(input,{run})).verified,true);
 await assert.rejects(verifyControlledDeployment({...input,files:{...input.files,'art-inventory.json':{sha256:'wrong'}}},{run}),/controlled_release_file_mismatch/);
 await assert.rejects(verifyControlledDeployment(input,{run:async(c,a)=>a[1]?.includes('check-runs')?{stdout:'{"check_runs":[]}'}:run(c,a)}),/production_check_missing/);
});

test('vervalste tabelnamen worden geweigerd ook als het bronpakket is aangepast',()=>fixture(async f=>{
 const name='kk_discoveries; drop table kk_museums; --';f.artifact.changes[0].table=name;f.bundle.records[0].record_table=name;
 assert.throws(()=>inspectProposal(f.artifact,f.bundle),/invalid_record_change/);
}));
test('publicatie houdt conceptrecords privé en vereist daarvoor geen statische release',()=>fixture(async f=>{
 await f.sql(`update kk_discoveries set publication_status='draft' where id='${id1}'`);
 const current=(await f.sql(`select updated_at from kk_discoveries where id='${id1}'`))[0].updated_at.toISOString();
 f.bundle.records[0].updated_at=current;f.artifact.changes[0].expected_updated_at=current;await atomicJson(f.artifact.bundle_file,f.bundle);await atomicJson(f.file,f.artifact);await f.approve();
 await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});
 const fetcher=async url=>url.endsWith('/api/config')?Response.json({APP_ENV:'production',PUBLIC_SUPABASE_URL:SUPABASE,PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}):Response.json([]);
 const result=await verifyPublication({file:f.file,sql:f.sql,fetcher});assert.equal(result.status,'verified');assert.equal(result.published,false);
}));

test('publicatiepakket wordt alleen na volledige hashcontrole in een schone broncheckout geplaatst',()=>fixture(async f=>{
 const {installRelease}=await import('../scripts/proposal-processing.mjs');const {mkdir}=await import('node:fs/promises');
 await f.approve();await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});const directory=path.join(f.dir,'release'),checkout=path.join(f.dir,'clean');
 await stagePublication({file:f.file,sql:f.sql,directory});await mkdir(path.join(checkout,'data/museums'),{recursive:true});await mkdir(path.join(checkout,'data/discovery'),{recursive:true});
 const run=async(_cmd,args)=>({stdout:args.includes('remote')?'git@github.com:harmenploeg/kunstkiezer.git\n':''});
 const out=await installRelease(directory,checkout,{run});assert.equal(out.installed.length,5);
 assert.equal(await readFile(path.join(checkout,'data/discovery/openbare-kunst.json'),'utf8'),await readFile(path.join(directory,'openbare-kunst.json'),'utf8'));
}));
test('vuile checkout of gewijzigd releasebestand blokkeert kopiëren',()=>fixture(async f=>{
 const {installRelease}=await import('../scripts/proposal-processing.mjs');await f.approve();await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});const directory=path.join(f.dir,'release');await stagePublication({file:f.file,sql:f.sql,directory});
 const run=async(_cmd,args)=>({stdout:args.includes('remote')?'https://github.com/harmenploeg/kunstkiezer.git\n':' M data/discovery/evenementen.json\n'});
 await assert.rejects(installRelease(directory,path.join(f.dir,'uncreated-checkout'),{run}),/source_checkout_must_be_clean/);
 await writeFile(path.join(directory,'evenementen.json'),'[]');await assert.rejects(installRelease(directory,path.join(f.dir,'uncreated-checkout'),{run:async(_cmd,args)=>({stdout:args.includes('remote')?'https://github.com/harmenploeg/kunstkiezer.git\n':''})}),/staged_release_changed/);
}));
test('primaire recordwebsite mag bewijs leveren, andere host wordt geweigerd',()=>{
 const bundle=makeBundle(),artifact=makeArtifact();bundle.source.url='https://newsletter.test/feed';bundle.records[0].website_url='https://example.test/';
 assert.equal(inspectProposal(artifact,bundle).changes,1);
 bundle.records[0].website_url='https://unrelated.test/';assert.throws(()=>inspectProposal(artifact,bundle),/evidence_outside_source/);
});
test('gerichte export behoudt versiebeheerredactie en past uitsluitend goedgekeurd veld toe',()=>fixture(async f=>{
 await f.approve();await applyProposal({file:f.file,sql:f.sql,fetcher:fetchEvidence});
 const {mkdir}=await import('node:fs/promises');const baseline=path.join(f.dir,'baseline');
 await mkdir(path.join(baseline,'data/museums'),{recursive:true});await mkdir(path.join(baseline,'data/discovery'),{recursive:true});
 await atomicJson(path.join(baseline,'data/museums/art-inventory.json'),[]);
 for(const category of CATEGORIES)await atomicJson(path.join(baseline,'data/discovery',category+'.json'),category==='openbare-kunst'?[{...baseRecord(),category,publication_status:'published',review_notes:'Bewaar deze redactie'}]:[]);
 const out=path.join(f.dir,'release');await stagePublication({file:f.file,sql:f.sql,directory:out,baselineDirectory:baseline});
 const rows=JSON.parse(await readFile(path.join(out,'openbare-kunst.json'),'utf8'));assert.equal(rows.length,1);assert.equal(rows[0].review_notes,'Bewaar deze redactie');assert.equal(rows[0].visit_notes,'Onderhoud op woensdag.');assert.equal(rows[0].summary,'Een fontein.');
 const records=JSON.parse(await readFile(path.join(baseline,'data/discovery/openbare-kunst.json'),'utf8'));records[0].visit_notes='Nieuwe lokale redactie';await atomicJson(path.join(baseline,'data/discovery/openbare-kunst.json'),records);
 await assert.rejects(stagePublication({file:f.file,sql:f.sql,directory:out,baselineDirectory:baseline}),/baseline_value_conflict/);
}));
