import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEFAULTS,settings,selectSources,due,atomicJson,harvest,acceptResult,tick,runModel,capacity} from '../scripts/weekly-updater.mjs';
const source=(id,extra={})=>({id,name:id,url:'https://example.test/'+id,enabled:true,...extra});
const fresh=()=>({sources:{},usage:{},history:{}});
test('model, context en budgetconfiguratie weigeren ongeldige waarden',()=>{
 assert.throws(()=>settings({maxSources:0}));assert.throws(()=>settings({model:'gpt-6-astra'}));
 assert.throws(()=>settings({maxDailyTokens:10}));assert.equal(settings().model,'gpt-6.1-sol');
});
test('kleine partij respecteert uitschakelingen, Instagramlimiet en eerlijke herhaalgrens',()=>{
 const sources=[source('a',{name:'Instagram a'}),source('b',{name:'Instagram b'}),source('c'),source('d',{enabled:false})];
 assert.deepEqual(selectSources(sources,fresh()).map(s=>s.id),['a','c']);
 const state=fresh();state.sources.a={attempts:2};
 // Changed source metadata invalidates old attempt limits.
 assert.deepEqual(selectSources(sources,state).map(s=>s.id),['a','c']);
});
test('dagbudget reserveert ruimte voor hele volgende partij en cooldown',()=>{
 const state=fresh();state.nextAttemptAt='2099-01-01T00:00:00Z';assert.equal(due(state,DEFAULTS),false);
 state.nextAttemptAt=null;state.usage['2026-10-29']={batches:3,tokens:0};
 assert.equal(due(state,DEFAULTS,Date.parse('2026-10-29T12:00:00Z')),false);
});
test('mechanische oogst gebruikt validators; 304 is geen inhoudelijk gelezen bron',async()=>{
 let headers;
 const result=await harvest(source('a'),{etag:'abc',text:'oude tekst'},async(_,opts)=>{
 headers=opts.headers;return new Response(null,{status:304});});
 assert.equal(headers['If-None-Match'],'abc');assert.equal(result.status,'unchanged');assert.equal(result.text,'oude tekst');
 assert.equal((await harvest(source('ig',{name:'Instagram'}),{},()=>assert.fail())).status,'browser_required');
 const large=await harvest(source('a'),{},async()=>new Response('x'.repeat(30),{headers:{'content-type':'text/html'}}),10);
 assert.equal(large.status,'too_large');
});
test('bewijs en publicatie moeten kloppen voordat checkpoint geaccepteerd wordt',()=>{
 const s=source('a'),r={source_id:'a',status:'read',summary:'controle',urls:['https://example.test/a'],window_complete:true,catalog_changed:false,publication_verified:false};
 assert.equal(acceptResult(s,r).status,'read');
 assert.throws(()=>acceptResult(s,{...r,window_complete:false}));
 assert.throws(()=>acceptResult(s,{...r,catalog_changed:true,publication_verified:false}));
});
async function fixture(fn){const dir=await mkdtemp(path.join(tmpdir(),'kk-updater-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('lege wachtrij start geen AI en haalt geen websites op',()=>fixture(async dir=>{
 let calls=0;const sql=async q=>{calls++;return q.includes('kk_update_sources')?[source('a')]:[];};
 assert.equal((await tick({dir,sql,model:()=>assert.fail(),fetcher:()=>assert.fail()})).status,'empty');assert.equal(calls,2);
}));
test('broncheckpoint overleeft partijgrens; vervolg is atomair en budget persistent',()=>fixture(async dir=>{
 const sources=[source('a'),source('b')],queries=[];let run=0;
 const sql=async q=>{queries.push(q);if(q.includes('kk_update_sources'))return sources;if(q.includes('claim_update'))return [{id:`00000000-0000-4000-8000-00000000000${++run}`}];return [];};
 const config=settings({maxSources:1});let modelCalls=0;
 const model=async(prompt,c,d,charge)=>{modelCalls++;
 const batch=JSON.parse(prompt.split('Bronnenpartij:\n')[1]);assert.equal(batch.length,1);
 await atomicJson(batch[0].result_file,{source_id:batch[0].source_id,status:'read',summary:'gecontroleerd',urls:['https://example.test/proof'],window_complete:true,catalog_changed:false,publication_verified:false});
 await charge(1000);return {ok:true};};
 const fetcher=async()=>new Response('<p>programma</p>',{headers:{'content-type':'text/html'}});
 let out=await tick({dir,sql,config,model,fetcher,now:Date.parse('2026-10-29T10:00:00Z')});assert.equal(out.status,'continued');
 out=await tick({dir,sql,config,model,fetcher,now:Date.parse('2026-10-29T11:00:00Z')});assert.equal(out.status,'completed');
 const state=JSON.parse(await readFile(path.join(dir,'weekly-state.json'),'utf8'));
 assert.equal(state.sources.a.status,'read');assert.equal(state.sources.b.status,'read');assert.equal(state.usage['2026-10-29'].tokens,2000);
 assert.equal(modelCalls,2);assert.ok(queries.some(q=>q.includes('with finished as')&&q.includes("insert into public.kk_update_runs")));
}));
test('mislukt model wordt maximaal eenmaal herhaald; geen oneindige vervolgcyclus',()=>fixture(async dir=>{
 let modelCalls=0;const sql=async q=>q.includes('kk_update_sources')?[source('a')]:q.includes('claim_update')?[{id:'00000000-0000-4000-8000-000000000001'}]:[];
 const model=async()=>{modelCalls++;return {ok:false,reason:'token_budget'};};
 const fetcher=async()=>new Response('',{status:403});
 const opts={dir,sql,model,fetcher};
 assert.equal((await tick({...opts,now:Date.parse('2026-10-29T10:00:00Z')})).status,'continued');
 assert.equal((await tick({...opts,now:Date.parse('2026-10-29T11:00:00Z')})).status,'failed');assert.equal(modelCalls,2);
 const state=JSON.parse(await readFile(path.join(dir,'weekly-state.json'),'utf8'));assert.equal(state.history.a?.last_successful_content_check,undefined);assert.ok(state.history.a?.last_attempted_at);
}));
test('daglimiet blokkeert vóór een databaseclaim; geen ongewenste AI-start',()=>fixture(async dir=>{
 await atomicJson(path.join(dir,'usage.json'),{'2026-10-29':{tokens:360000,batches:3}});
 assert.equal((await tick({dir,now:Date.parse('2026-10-29T10:00:00Z'),sql:()=>assert.fail()})).status,'budget_or_cooldown');
}));
test('weekronde leest geen dossiers; expliciete dossierpartij verschuift weekplanning niet',()=>fixture(async dir=>{
 const queries=[];const sql=async q=>{queries.push(q);return q.includes('returning *')?[{id:'00000000-0000-4000-8000-000000000001'}]:[];};
 const model=async(prompt,c,d,charge)=>{assert.ok(prompt.startsWith('Dit is UITSLUITEND'));const batch=JSON.parse(prompt.split('Bronnenpartij:\n')[1]);
 await atomicJson(batch[0].result_file,{source_id:'dossier1',status:'read',summary:'controle',urls:['https://example.test/a'],window_complete:true,catalog_changed:false,publication_verified:false});await charge(100);return {ok:true};};
 await tick({dir,sql,lane:'backlog',backlog:[{id:'dossier1',name:'Museum',status:'pending'}],model});
 assert.ok(queries.every(q=>!q.includes('claim_update')&&!q.includes('kk_update_schedule')));
 assert.equal((await tick({dir,sql,lane:'backlog',backlog:[{id:'dossier1',status:'pending'}],now:Date.now()+3600000,model:()=>assert.fail()})).status,'backlog_already_processed');
}));

test('capaciteit maakt zichtbaar dat volledige brondekking langer dan een week duurt',()=>{
 const sources=Array.from({length:227},(_,i)=>source(String(i),{name:'Instagram '+i}));
 assert.equal(capacity(sources).minimumDays,76);
});
test('crashherstel importeert afgerond broncheckpoint zonder opnieuw AI te starten',()=>fixture(async dir=>{
 const s=source('a'),file=path.join(dir,'saved.json');
 await atomicJson(file,{source_id:'a',status:'read',summary:'klaar',urls:['https://example.test/proof'],window_complete:true,catalog_changed:false,publication_verified:false});
 await atomicJson(path.join(dir,'weekly-state.json'),{version:1,cycle:'cycle',run:'00000000-0000-4000-8000-000000000001',sources:{a:{attempts:1}},usage:{},history:{},inflight:{items:[{source_id:'a',result_file:file}]}});
 const sql=async q=>q.includes('kk_update_sources')?[s]:q.includes("and status='running'")&&q.startsWith('select')?[{id:'00000000-0000-4000-8000-000000000001'}]:[];
 assert.equal((await tick({dir,sql,model:()=>assert.fail(),fetcher:()=>assert.fail()})).status,'completed');
 const state=JSON.parse(await readFile(path.join(dir,'weekly-state.json'),'utf8'));assert.equal(state.sources.a.status,'read');assert.equal(state.sources.a.attempts,1);
}));
test('procesbewaker beëindigt een nagebootst AI-proces bij toolgrens; geen echte AI',()=>fixture(async dir=>{
 const executable=path.join(dir,'fake-codex'),evidence=path.join(dir,'arguments.json');
 await writeFile(executable,`#!${process.execPath}\nimport fs from 'node:fs';fs.writeFileSync(${JSON.stringify(evidence)},JSON.stringify({args:process.argv.slice(2),hasManagementToken:!!process.env.SUPABASE_ACCESS_TOKEN}));console.log(JSON.stringify({type:'item.completed',item:{type:'command_execution'}}));setInterval(()=>{},1000);`);await chmod(executable,0o700);
 const oldBin=process.env.KUNSTKIEZER_CODEX_BIN,oldToken=process.env.SUPABASE_ACCESS_TOKEN;
 process.env.KUNSTKIEZER_CODEX_BIN=executable;process.env.SUPABASE_ACCESS_TOKEN='not-a-real-secret';
 try{let charged;const result=await runModel('test',settings({maxToolCalls:1}),dir,async n=>{charged=n;});
 assert.equal(result.ok,false);assert.equal(result.reason,'tool_budget');assert.equal(charged,DEFAULTS.maxBatchTokens);
 const saved=JSON.parse(await readFile(evidence,'utf8'));assert.equal(saved.hasManagementToken,false);assert.ok(saved.args.includes('gpt-6.1-sol'));assert.ok(saved.args.includes('workspace-write'));
 }finally{if(oldBin===undefined)delete process.env.KUNSTKIEZER_CODEX_BIN;else process.env.KUNSTKIEZER_CODEX_BIN=oldBin;if(oldToken===undefined)delete process.env.SUPABASE_ACCESS_TOKEN;else process.env.SUPABASE_ACCESS_TOKEN=oldToken;}
}));

test('echte PostgreSQL-transacties voltooien partijen met precies één vervolg',()=>fixture(async dir=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec(`create schema kunstkiezer_private;
 create table public.kk_update_runs(id uuid primary key default gen_random_uuid(),reason text,status text default 'queued',started_at timestamptz,finished_at timestamptz,summary text default '');
 create unique index one_active on public.kk_update_runs((true)) where status in ('queued','running');
 create table public.kk_update_sources(id text,name text,url text,notes text,enabled boolean,updated_at timestamptz);
 insert into public.kk_update_sources values ('a','a','https://example.test/a','',true,now()),('b','b','https://example.test/b','',true,now());
 insert into public.kk_update_runs(reason) values('scheduled');
 create function kunstkiezer_private.claim_update() returns setof public.kk_update_runs language sql as $$update public.kk_update_runs set status='running',started_at=now() where id=(select id from public.kk_update_runs where status='queued' limit 1) returning *$$;`);
 const sql=async q=>(await db.exec(q)).at(-1)?.rows||[];
 const model=async(prompt,c,d,charge)=>{const batch=JSON.parse(prompt.split('Bronnenpartij:\n')[1]);
 await atomicJson(batch[0].result_file,{source_id:batch[0].source_id,status:'read',summary:'klaar',urls:['https://example.test/proof'],window_complete:true,catalog_changed:false,publication_verified:false});await charge(100);return {ok:true};};
 const opts={dir,sql,model,config:settings({maxSources:1}),fetcher:async()=>new Response('',{status:403})};
 assert.equal((await tick({...opts,now:Date.parse('2026-10-29T10:00:00Z')})).status,'continued');
 assert.equal((await db.query("select * from public.kk_update_runs where status='queued'")).rows.length,1);
 assert.equal((await tick({...opts,now:Date.parse('2026-10-29T11:00:00Z')})).status,'completed');
 assert.equal((await db.query("select * from public.kk_update_runs where status='completed'")).rows.length,2);
 assert.equal((await db.query("select * from public.kk_update_runs where status in ('queued','running')")).rows.length,0);
 }finally{await db.close();}
}));

test('liveproef behandelt één bron en maakt bij een onvolledige bron geen vervolg',()=>fixture(async dir=>{
 const queries=[];const sql=async q=>{queries.push(q);return q.includes('kk_update_sources')?[source('a')]:q.includes('returning *')?[{id:'00000000-0000-4000-8000-000000000001'}]:[];};
 const out=await tick({dir,sql,lane:'trial',trialSourceId:'a',config:settings({maxSources:1,maxMinutes:5}),model:async()=>({ok:false,reason:'time_budget'}),fetcher:async()=>new Response('',{status:403})});
 assert.equal(out.status,'failed');assert.equal(out.processed,1);assert.ok(!queries.some(q=>q.includes("from finished where not exists")));assert.ok(queries.some(q=>q.includes("where enabled and id='a'")));assert.ok(!queries.some(q=>q.includes('claim_update')));
}));
test('weeksteekproef is begrensd, sluit onleesbare bronnen uit en roteert oudste eerst',async()=>{
 const {weeklyTargets}=await import('../scripts/weekly-updater.mjs');
 const sources=Array.from({length:12},(_,i)=>({id:String(i).padStart(2,'0'),enabled:true,url:'https://example.test/'+i}));
 sources.push({id:'ig',enabled:true,url:'https://www.instagram.com/test/'},{id:'rss',enabled:true,url:'https://example.test/feed/'},{id:'mail',enabled:true,url:'https://us1.campaign-archive.com/feed?x=1'});
 const first=weeklyTargets(sources,{history:{}},DEFAULTS);assert.equal(first.length,8);assert.deepEqual(first,sources.slice(0,8).map(s=>s.id));
 const history=Object.fromEntries(first.map(id=>[id,{last_proposed_at:'2026-10-29T12:00:00Z'}]));
 assert.deepEqual(weeklyTargets(sources,{history},DEFAULTS).slice(0,4),['08','09','10','11']);
});
test('kunstbronnen krijgen voorrang en vastgelopen bronnen wachten tot cooldown of bronwijziging',async()=>{
 const {weeklyTargets}=await import('../scripts/weekly-updater.mjs');const sources=[source('krant-ad'),source('commons',{url:'https://commons.wikimedia.org/'}),source('museum')];
 assert.equal(weeklyTargets(sources,fresh(),settings({weeklySourceLimit:1}))[0],'museum');
 await fixture(async dir=>{
  const sql=async q=>q.includes('kk_update_sources')?[source('museum')]:q.includes('claim_update')?[{id:'00000000-0000-4000-8000-000000000001'}]:[];let fetches=0;
  const out=await tick({dir,sql,fetcher:async()=>{fetches++;return new Response(null,{status:403});},now:Date.parse('2026-10-30T10:00:00Z')});
  assert.equal(out.status,'failed');assert.equal(fetches,1,'standaard voorstelroute doet geen dubbele harvest');
  const state=JSON.parse(await readFile(path.join(dir,'weekly-state.json')));assert.equal(state.sources.museum.retryable,false);assert.equal(selectSources([source('museum')],state).length,0);assert.equal(state.usage['2026-10-30'].tokens,0);assert.equal(state.usage['2026-10-30'].batches,0);
  assert.deepEqual(weeklyTargets([source('museum')],state,DEFAULTS,Date.parse('2026-11-02T10:00:00Z')),[]);
  assert.deepEqual(weeklyTargets([source('museum',{updated_at:'changed'})],state,DEFAULTS,Date.parse('2026-11-02T10:00:00Z')),['museum']);
  assert.deepEqual(weeklyTargets([source('museum')],state,DEFAULTS,Date.parse('2026-11-07T10:00:00Z')),['museum']);
 });
});
