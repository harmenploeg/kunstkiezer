import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {atomicJson,json} from '../scripts/weekly-updater.mjs';
import {loadReview} from '../scripts/proposal-processing.mjs';
import {AUTO_POLICY,automaticEligibility,automaticPublicationTick,publicationInProgress} from '../scripts/automatic-publication.mjs';
import {createControlledPublisher} from '../scripts/controlled-publisher.mjs';
const stamp='2026-10-30T09:00:00Z',now=Date.parse(stamp),id='00000000-0000-4000-a000-000000000001',head='a'.repeat(40),merged='b'.repeat(40);
async function fixture(fn){
 const dir=await mkdtemp(path.join(tmpdir(),'kk-auto-'));
 try{
  const root=path.join(dir,'batches','batch1');await mkdir(root,{recursive:true});const file=path.join(root,'museum-proposal.json'),bundleFile=path.join(root,'museum-input.json');
  const bundle={source:{id:'museum',name:'Museum',url:'https://example.test/',updated_at:stamp},records:[{record_table:'kk_museums',id,name:'Museum',website_url:'https://example.test/',operating_status:'open',summary:'Een museum.',updated_at:stamp}],pages:[{url:'https://example.test/bezoek',text:'Het museum is tijdelijk gesloten wegens onderhoud.',fetched_at:stamp}]};
  const artifact={status:'needs_review',source_id:'museum',summary:'Tijdelijke sluiting.',changes:[{record_id:id,table:'kk_museums',field:'operating_status',before:'open',after:'temporarily_closed',expected_updated_at:stamp,evidence_url:bundle.pages[0].url,evidence_quote:bundle.pages[0].text}],candidates:[],catalog_changed:false,published:false,bundle_file:bundleFile};
  const write=async()=>{await atomicJson(bundleFile,bundle);await atomicJson(file,artifact);};await write();
  await atomicJson(path.join(dir,'activation.json'),{enabled:true,automatic_publication:{enabled:true,policy:AUTO_POLICY,authorized_at:stamp}});
  await fn({dir,file,bundle,artifact,write,review:()=>loadReview(file)});
 }finally{await rm(dir,{recursive:true,force:true});}
}
test('alleen verse expliciete feiten op de primaire website mogen automatisch',()=>fixture(async f=>{
 assert.equal(automaticEligibility(await f.review(),now).eligible,true);
 f.bundle.records[0].website_url='https://other.test/';await f.write();assert.equal(automaticEligibility(await f.review(),now).reason,'primary_evidence_required');
 f.bundle.records[0].website_url='https://example.test/';f.bundle.pages[0].fetched_at='2026-10-01T00:00:00Z';await f.write();assert.equal(automaticEligibility(await f.review(),now).reason,'fresh_evidence_required');
 f.bundle.pages[0].fetched_at=stamp;f.artifact.changes[0]={...f.artifact.changes[0],field:'summary',before:'Een museum.',after:'Een verbeterde museumtekst.'};await f.write();assert.equal(automaticEligibility(await f.review(),now).reason,'editorial_field_needs_review');
}));
test('ontkenning en toekomstige sluiting worden geen automatische statuswijziging',()=>fixture(async f=>{
 for(const quote of ['Het museum is niet tijdelijk gesloten.','Het museum is vanaf 17 november 2026 tijdelijk gesloten.']){f.bundle.pages[0].text=quote;f.artifact.changes[0].evidence_quote=quote;await f.write();assert.equal(automaticEligibility(await f.review(),now).reason,'ambiguous_status_evidence');}
}));
test('datums moeten letterlijk in het bewijs staan; vrije interpretaties en verwijderingen blijven redactie',()=>fixture(async f=>{
 f.bundle.records[0]={...f.bundle.records[0],record_table:'kk_discoveries',starts_on:'2026-10-01'};f.artifact.changes[0]={...f.artifact.changes[0],table:'kk_discoveries',field:'starts_on',before:'2026-10-01',after:'2026-11-17',evidence_quote:'De tentoonstelling start op 17 november 2026.'};f.bundle.pages[0].text=f.artifact.changes[0].evidence_quote;await f.write();assert.equal(automaticEligibility(await f.review(),now).eligible,true);
 f.artifact.changes[0].after='2026-11-18';await f.write();assert.equal(automaticEligibility(await f.review(),now).eligible,false);
 f.artifact.changes[0].after=null;await f.write();assert.equal(automaticEligibility(await f.review(),now).eligible,false);
}));
test('lege resultaten en kandidaten starten geen databasewriter of publicatie',()=>fixture(async f=>{
 f.artifact.changes=[];await f.write();const opts={dir:f.dir,sql:()=>assert.fail(),now,driver:{advance:()=>assert.fail()}};
 assert.equal((await automaticPublicationTick(opts)).status,'no_automatic_corrections');
 f.artifact.candidates=[{name:'Nieuwe locatie',evidence_url:f.bundle.pages[0].url,evidence_quote:f.bundle.pages[0].text}];await f.write();assert.equal((await automaticPublicationTick(opts)).manual_review,1);assert.equal(await publicationInProgress(f.dir),false);
}));
test('gebruiker moet automatische verwerking expliciet hebben aangezet',()=>fixture(async f=>{
 await atomicJson(path.join(f.dir,'activation.json'),{enabled:true});assert.equal((await automaticPublicationTick({dir:f.dir,sql:()=>assert.fail(),now})).status,'automatic_publication_disabled');
}));
test('actieve verzamelronde loopt eerst af; daarna wordt één publicatie hervat',()=>fixture(async f=>{
 let advance=0;const opts={dir:f.dir,now,driver:{advance:async()=>{advance++;return {phase:'source_checks',status:'pending',database_applied:true};}}};
 assert.equal((await automaticPublicationTick({...opts,sql:async()=>[{id:'queued'}]})).status,'publication_waiting_for_update');assert.equal(advance,0);
 assert.equal((await automaticPublicationTick({...opts,sql:async()=>[]})).status,'publication_in_progress');assert.equal(advance,1);assert.equal(await publicationInProgress(f.dir),true);
 await automaticPublicationTick({...opts,sql:()=>assert.fail('Geen nieuwe selectie tijdens publicatie')});assert.equal(advance,2);
}));
test('tussenstand overleeft netwerkfout; maximaal drie herhalingen, geen vals publicatiesucces',()=>fixture(async f=>{
 let calls=0;const driver={advance:async(job,save)=>{calls++;await save({...job,database_applied:true});throw Error('secret network contents');}};
 for(let i=0;i<3;i++){const result=await automaticPublicationTick({dir:f.dir,sql:async()=>[],driver,now:now+i*1800001});assert.equal(result.status,i===2?'publication_blocked':'publication_retry_wait');assert.ok(!JSON.stringify(result).includes('secret'));}
 const state=await json(path.join(f.dir,'automatic-publication.json'));assert.equal(state.job.database_applied,true);assert.equal(state.job.attempts,3);assert.equal(state.job.status,'blocked');
 await automaticPublicationTick({dir:f.dir,sql:()=>assert.fail(),driver,now:now+4*1800001});assert.equal(calls,3);
}));
test('gewijzigd voorstel tijdens uitrol blokkeert hervatten vóór enige externe opdracht',()=>fixture(async f=>{
 const review=await f.review(),job={file:f.file,digest:review.digest,phase:'source_checks',sourceHead:head};f.artifact.summary='Gewijzigd';await f.write();
 const driver=createControlledPublisher({dir:f.dir,sql:()=>assert.fail(),execute:()=>assert.fail()});await assert.rejects(driver.advance(job,()=>{}),/proposal_changed/);
}));
test('geen merge vóór geslaagde exacte CI; gewijzigde PR-head wordt geblokkeerd',()=>fixture(async f=>{
 const review=await f.review(),job={file:f.file,digest:review.digest,phase:'integration_checks',integrationHead:head,integrationPr:12};let successful=false,mergeCalls=0;
 const execute=async(cmd,args)=>{assert.equal(cmd,'gh');if(args[0]==='api')return {stdout:JSON.stringify({workflow_runs:[{id:1,head_sha:head,name:'Controleer LOCI-publicatiepakket',event:'pull_request',status:successful?'completed':'in_progress',conclusion:successful?'success':null}]})};if(args[1]==='view')return {stdout:JSON.stringify({state:'OPEN',headRefOid:'c'.repeat(40)})};mergeCalls++;throw Error('Onverwachte merge');};
 const driver=createControlledPublisher({dir:f.dir,sql:()=>assert.fail(),execute});assert.deepEqual(await driver.advance(job,()=>{}),{});successful=true;await assert.rejects(driver.advance(job,()=>{}),/publication_pr_changed/);assert.equal(mergeCalls,0);
}));
test('herstel na verloren mergeantwoord gebruikt bestaande mergecommit zonder opnieuw mergen',()=>fixture(async f=>{
 const review=await f.review(),job={file:f.file,digest:review.digest,phase:'integration_checks',integrationHead:head,integrationPr:12};let merges=0;
 const execute=async(_,args)=>{if(args[0]==='api')return {stdout:JSON.stringify({workflow_runs:[{id:1,head_sha:head,name:'Controleer LOCI-publicatiepakket',event:'pull_request',status:'completed',conclusion:'success'}]})};if(args[1]==='view')return {stdout:JSON.stringify({state:'MERGED',headRefOid:head,mergeCommit:{oid:merged}})};merges++;throw Error('Tweede merge');};
 const out=await createControlledPublisher({dir:f.dir,sql:()=>assert.fail(),execute}).advance(job,()=>{});assert.equal(out.integrationCommit,merged);assert.equal(out.phase,'deployment');assert.equal(merges,0);
}));
test('pas geverifieerde uitrol markeert voorstel verwerkt en voorkomt een tweede publicatie',()=>fixture(async f=>{
 let calls=0;const driver={advance:async()=>{calls++;return {status:'verified',phase:'verified',published:true};}};
 const out=await automaticPublicationTick({dir:f.dir,sql:async()=>[],driver,now});assert.equal(out.status,'automatically_published');assert.equal(await publicationInProgress(f.dir),false);
 assert.equal((await automaticPublicationTick({dir:f.dir,sql:()=>assert.fail(),driver,now})).status,'no_automatic_corrections');assert.equal(calls,1);
}));
test('volledige publicatieketen gebruikt echte transacties en lokale Git; één audit en vijf geverifieerde downloads',()=>fixture(async f=>{
 const {PGlite}=await import('@electric-sql/pglite'),{execFile}=await import('node:child_process'),{promisify}=await import('node:util');const exec=promisify(execFile),db=new PGlite();
 try{
 await db.exec(`create table kk_update_sources(id text primary key,enabled boolean,updated_at timestamptz);insert into kk_update_sources values('museum',true,'${stamp}');
 create table kk_update_runs(id uuid primary key,reason text,status text,started_at timestamptz,finished_at timestamptz,summary text);
 create table kk_museums(id uuid primary key,name text,website_url text,summary text,operating_status text,publication_status text,is_art_museum boolean,updated_at timestamptz);
 create table kk_discoveries(id uuid primary key,name text,category text,publication_status text);
 create table kk_update_changes(id uuid primary key,run_id uuid,change text,record_table text,record_id uuid,record_name text,fields text[],source_id text,source_url text,note text);
 insert into kk_museums values('${id}','Museum','https://example.test/','Een museum.','open','published',true,'${stamp}');`);
 f.bundle.pages[0].fetched_at=new Date().toISOString();await f.write();
 const sql=async q=>(await db.exec(q)).at(-1)?.rows||[],review=await f.review(),{CATEGORIES,PRODUCTION,SUPABASE}=await import('../scripts/proposal-processing.mjs');
 const baseRow={...f.bundle.records[0],publication_status:'published',is_art_museum:true};delete baseRow.record_table;
 const files=['art-inventory.json',...CATEGORIES.map(c=>c+'.json')],prs=new Map(),clones=new Map(),commands=[];let nextPr=1;
 async function git(args,cwd){return exec('git',args,{cwd});}
 async function commit(cwd,message){await git(['add','-A'],cwd);await git(['-c','user.name=Test','-c','user.email=test@example.test','commit','-m',message],cwd);return (await git(['rev-parse','HEAD'],cwd)).stdout.trim();}
 const execute=async(cmd,args,options={})=>{
  commands.push({cmd,args});const cwd=options.cwd;
  if(cmd==='git'&&args[0]==='clone'){
   const folder=args.at(-1),repo=args.at(-2).includes('interactief')?'harmenploeg/interactief':'harmenploeg/kunstkiezer';await mkdir(folder,{recursive:true});await git(['init','-b','main'],folder);await git(['remote','add','origin',args.at(-2)],folder);await git(['config','user.name','Test'],folder);await git(['config','user.email','test@example.test'],folder);
   if(repo.endsWith('kunstkiezer')){await mkdir(path.join(folder,'data/museums'),{recursive:true});await mkdir(path.join(folder,'data/discovery'),{recursive:true});await atomicJson(path.join(folder,'data/museums/art-inventory.json'),[baseRow]);for(const c of CATEGORIES)await atomicJson(path.join(folder,'data/discovery',c+'.json'),[]);}else await atomicJson(path.join(folder,'release-assets.json'),{publicFiles:[]});
   const base=await commit(folder,'Baseline');await git(['update-ref','refs/remotes/origin/main',base],folder);clones.set(repo,folder);return {stdout:''};
  }
  if(cmd==='git'&&['fetch','push'].includes(args[0]))return {stdout:''};
  if(cmd==='git')return exec(cmd,args,options);
  if(cmd==='npm')return {stdout:'checks passed'};
  if(cmd===process.execPath&&args[0]==='scripts/sync-loci.mjs'){
   const target=path.join(args[1],'kunstkiezer');await mkdir(target,{recursive:true});for(const name of files){const source=name==='art-inventory.json'?'data/museums/'+name:'data/discovery/'+name;await atomicJson(path.join(target,name),JSON.parse(await readFile(path.join(cwd,source),'utf8')));}await atomicJson(path.join(target,'version.json'),{repository:'harmenploeg/kunstkiezer',commit:(await git(['rev-parse','HEAD'],cwd)).stdout.trim()});await mkdir(path.join(args[1],'kunstkiezer-functies'),{recursive:true});await atomicJson(path.join(args[1],'KUNSTKIEZER-INTEGRATIE.md'),{});return {stdout:''};
  }
  if(cmd===process.execPath)return {stdout:'tests passed'};
  assert.equal(cmd,'gh');const repo=args[args.indexOf('--repo')+1];
  if(args[0]==='pr'){
   if(args[1]==='list'){const pr=prs.get(repo);return {stdout:JSON.stringify(pr?[{number:pr.number,state:pr.state,headRefOid:pr.head}]:[])};}
   if(args[1]==='create'){prs.set(repo,{number:nextPr++,state:'OPEN',head:(await git(['rev-parse','HEAD'],clones.get(repo))).stdout.trim()});return {stdout:''};}
   const pr=prs.get(repo);
   if(args[1]==='view')return {stdout:JSON.stringify({state:pr.state,headRefOid:pr.head,mergeCommit:pr.state==='MERGED'?{oid:pr.head}:null})};
   assert.equal(args[1],'merge');assert.ok(args.includes('--match-head-commit'));assert.ok(!args.includes('--admin'));pr.state='MERGED';return {stdout:''};
  }
  const endpoint=args[1];if(endpoint.includes('/actions/runs?')){const commit=endpoint.match(/head_sha=([a-f0-9]{40})/)[1];return {stdout:JSON.stringify({workflow_runs:[{id:99,head_sha:commit,name:endpoint.includes('interactief')?'Controleer LOCI-publicatiepakket':'Controle',event:'push',status:'completed',conclusion:'success'}]})};}
  if(args[0]==='run')return {stdout:JSON.stringify({conclusion:'success',status:'completed',headSha:prs.get('harmenploeg/interactief').head,name:'Controleer LOCI-publicatiepakket',url:'https://github.com/harmenploeg/interactief/actions/runs/99'})};
  if(endpoint.includes('/check-runs'))return {stdout:JSON.stringify({check_runs:[{name:'Loci gecontroleerde productie',head_sha:prs.get('harmenploeg/interactief').head,status:'completed',conclusion:'success'}]})};
  const name=endpoint.split('/contents/kunstkiezer/')[1].split('?')[0],content=await readFile(path.join(clones.get('harmenploeg/interactief'),'kunstkiezer',name));return {stdout:JSON.stringify({encoding:'base64',content:content.toString('base64')})};
 };
 const fetcher=async url=>{
  if(url.startsWith('https://example.test/'))return new Response('<main>'+f.bundle.pages[0].text+'</main>',{headers:{'content-type':'text/html'}});
  if(url===PRODUCTION+'/api/config')return Response.json({APP_ENV:'production',PUBLIC_SUPABASE_URL:SUPABASE,PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
  if(url.startsWith(SUPABASE))return Response.json([]);
  return new Response(await readFile(path.join(clones.get('harmenploeg/interactief'),'kunstkiezer',url.slice(PRODUCTION.length+1))));
 };
 const driver=createControlledPublisher({dir:f.dir,sql,execute,fetcher});
 for(let step=0;step<7;step++){const out=await automaticPublicationTick({dir:f.dir,sql,driver,now:Date.now()});if(out.status==='automatically_published')break;assert.equal(out.status,'publication_in_progress',JSON.stringify(out));}
 const state=await json(path.join(f.dir,'automatic-publication.json'));assert.equal(state.job.status,'verified');assert.equal((await sql('select * from kk_update_changes')).length,1);assert.equal((await sql(`select operating_status from kk_museums where id='${id}'`))[0].operating_status,'temporarily_closed');assert.equal((await sql('select status from kk_update_runs'))[0].status,'completed');
 await automaticPublicationTick({dir:f.dir,sql,driver,now:Date.now()});assert.equal((await sql('select * from kk_update_changes')).length,1);assert.equal(commands.filter(c=>c.cmd==='gh'&&c.args[1]==='merge').length,2);
 }finally{await db.close();}
}));

test('een nieuwe verzamelqueue vóór databasecommit mag aflopen zonder deadlock',()=>fixture(async f=>{
 const review=await f.review();await atomicJson(path.join(f.dir,'automatic-publication.json'),{version:1,seen:{},job:{file:f.file,digest:review.digest,phase:'prepare_source',status:'pending',attempts:0,database_applied:false}});
 const result=await automaticPublicationTick({dir:f.dir,now,sql:async()=>[{id:'queued'}],driver:{advance:()=>assert.fail()}});assert.equal(result.status,'publication_waiting_for_update');assert.equal(await publicationInProgress(f.dir),false);
}));
test('redactieconflict blokkeert direct en wordt niet drie keer blind herhaald',()=>fixture(async f=>{
 const result=await automaticPublicationTick({dir:f.dir,now,sql:async()=>[],driver:{advance:async()=>{throw Error('record_version_conflict');}}});assert.equal(result.status,'publication_blocked');assert.equal(result.reason,'record_version_conflict');
}));
