import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {REVIEW_LIMITS,reviewPrompt,prepareBundle,validateProposal,reviewerArgs,inferProposal,createProposalReviewer} from '../scripts/proposal-reviewer.mjs';
const record={record_table:'kk_discoveries',id:'record1',name:'Fontein',summary:'Een fontein.',visit_notes:'',starts_on:null,ends_on:null,operating_status:'open',updated_at:'2026-10-29T12:00:00Z'};
const bundle={records:[record],pages:[{url:'https://example.test/faq',text:'De fontein is tijdelijk gesloten wegens onderhoud.'}]};
const change={record_id:'record1',table:'kk_discoveries',field:'operating_status',before:'open',after:'temporarily_closed',expected_updated_at:record.updated_at,evidence_url:'https://example.test/faq',evidence_quote:'tijdelijk gesloten wegens onderhoud'};
const proposal={summary:'Controleer tijdelijke sluiting.',changes:[change],candidates:[]};
async function fixture(fn){const dir=await mkdtemp(path.join(tmpdir(),'kk-review-test-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('volledige invoer heeft een harde UTF-8-bytelimiet; geen stilzwijgend lange context',()=>{
 assert.ok(Buffer.byteLength(reviewPrompt(bundle))<REVIEW_LIMITS.inputBytes);
 assert.throws(()=>reviewPrompt({text:'🌷'.repeat(4000)}),/input_limit/);
});
test('voorstel vereist gelezen bewijs, bestaande recordversie en onveranderde uitgangswaarde',()=>{
 assert.equal(validateProposal(proposal,bundle).published,false);
 for(const patch of [{expected_updated_at:'old'},{before:'closed'},{record_id:'foreign'},{field:'publication_status'},{evidence_url:'https://other.test'},{evidence_quote:'verzonnen citaat'}]){
 assert.throws(()=>validateProposal({...proposal,changes:[{...change,...patch}]},bundle));}
 assert.throws(()=>validateProposal({...proposal,changes:[change,change]},bundle),/duplicate_change/);
});
test('gewone code verzamelt een klein databasepakket; nergens SQL voor catalogusmutaties',async()=>{
 const queries=[];const sql=async q=>{queries.push(q);return q.includes('kk_update_sources')?[{id:'source1',name:'Test',url:'https://example.test/',notes:'',enabled:true,updated_at:'now'}]:[record];};
 let fetched=0;const fetcher=async u=>{fetched++;return new Response('<p>De fontein is tijdelijk gesloten wegens onderhoud.</p><a href="/faq">FAQ</a>',{headers:{'content-type':'text/html'}});};
 const b=await prepareBundle(sql,{source_id:'source1',window_from:'2026-10-01',window_to:'2026-10-29'},fetcher);
 assert.ok(queries.every(q=>q.startsWith('select ')));assert.equal(b.records.length,1);assert.ok(fetched<=3);assert.ok(Buffer.byteLength(reviewPrompt(b))<=12000);assert.equal(b.coverage,'partial');
});
test('uitgeschakelde bron stopt vóór website- of AI-aanroep',async()=>{
 await assert.rejects(prepareBundle(async()=>[{enabled:false}],{source_id:'a'},()=>assert.fail()),/source_disabled/);
});
test('CLI gebruikt abonnement, lege context en uitgeschakelde gereedschappen',()=>{
 const args=reviewerArgs('/tmp/empty','/tmp/schema');
 for(const flag of ['--ignore-user-config','--ephemeral','read-only','project_doc_max_bytes=0','web_search="disabled"','mcp_servers={}'])assert.ok(args.includes(flag));
 for(const f of ['plugins','apps','shell_tool','multi_agent','computer_use'])assert.ok(args.some((x,i)=>x==='--disable'&&args[i+1]===f));
 assert.ok(!args.includes('resume'));assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
});
test('adapter schrijft alleen een lokaal voorstel en partial checkpoint',()=>fixture(async dir=>{
 const sql=async q=>q.includes('kk_update_sources')?[{id:'source1',name:'Test',url:'https://example.test/',enabled:true}]:[record];
 const fetcher=async()=>new Response('De fontein is tijdelijk gesloten wegens onderhoud.',{headers:{'content-type':'text/html'}});
 const review=createProposalReviewer({sql,fetcher,infer:async()=>({ok:true,value:{summary:'Geen concrete wijziging bewezen.',changes:[],candidates:[]},tokens:1000})});
 const item={source_id:'source1',result_file:path.join(dir,'checkpoint.json')};let charged;
 const out=await review('Bronnenpartij:\n'+JSON.stringify([item]),{maxBatchTokens:30000},dir,async n=>charged=n);
 assert.equal(out.ok,true);assert.equal(charged,1000);assert.equal(out.proposed_sources[0],'source1');
 const checkpoint=JSON.parse(await readFile(item.result_file,'utf8'));assert.equal(checkpoint.catalog_changed,false);assert.equal(checkpoint.status,'partial');
 const artifact=JSON.parse(await readFile(out.proposals[0],'utf8'));assert.equal(artifact.status,'needs_review');assert.equal(artifact.published,false);
}));
test('proces onderschept toolpoging en geeft geen credentials door',()=>fixture(async dir=>{
 const bin=path.join(dir,'fake-codex'),capture=path.join(dir,'env.json');
 await writeFile(bin,`#!${process.execPath}\nimport fs from 'node:fs';fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({key:!!process.env.OPENAI_API_KEY,token:!!process.env.SUPABASE_ACCESS_TOKEN,cwd:process.argv[process.argv.indexOf('--cd')+1]}));console.log(JSON.stringify({type:'item.started',item:{type:'mcp_tool_call'}}));setInterval(()=>{},1000);`);await chmod(bin,0o700);
 const old=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY='test-never-send';
 try{const out=await inferProposal('test',{executable:bin,seconds:2});assert.equal(out.reason,'unexpected_tool');const env=JSON.parse(await readFile(capture,'utf8'));assert.equal(env.key,false);assert.equal(env.token,false);assert.ok(!env.cwd.includes('/work/kunstkiezer'));}
 finally{if(old===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=old;}
}));
test('onleesbare pagina start geen AI en krijgt geen fictieve tokenkosten',()=>fixture(async dir=>{
 const sql=async()=>[{id:'source1',url:'https://example.test/',enabled:true}];let charged;
 const reviewer=createProposalReviewer({sql,fetcher:async()=>new Response('',{status:403}),infer:()=>assert.fail('Geen AI bij ontbrekende brontekst')});
 const out=await reviewer('Bronnenpartij:\n'+JSON.stringify([{source_id:'source1',result_file:path.join(dir,'result.json')}]),{maxBatchTokens:120000},dir,async n=>charged=n);
 assert.equal(charged,0);assert.equal(out.ai_calls,0);assert.equal(out.usage_estimated,false);assert.equal(out.reason,'access_blocked');
}));
test('ontbrekende AI-gebruiksmeting behoudt volledige reservering ook naast gemeten resultaat',()=>fixture(async dir=>{
 const sql=async q=>q.includes('kk_update_sources')?[{id:'source1',url:'https://example.test/',enabled:true}]:[];let charged,calls=0;
 const reviewer=createProposalReviewer({sql,fetcher:async()=>new Response('Informatie over het museum op de bronpagina.',{headers:{'content-type':'text/html'}}),infer:async()=>++calls===1?{ok:true,tokens:1000,value:{summary:'Geen wijziging.',changes:[],candidates:[]}}:{ok:false,tokens:0,reason:'review_failed'}});
 const items=[1,2].map(i=>({source_id:'source'+i,result_file:path.join(dir,i+'.json')}));const out=await reviewer('Bronnenpartij:\n'+JSON.stringify(items),{maxBatchTokens:120000},dir,async n=>charged=n);
 assert.equal(charged,120000);assert.equal(out.ai_calls,2);assert.equal(out.usage_estimated,true);
}));
test('bronnenverzameling probeert hoogstens twee vervolgpagina’s en bewaart ophaalbeperkingen',async()=>{
 const sql=async q=>q.includes('kk_update_sources')?[{id:'source1',url:'https://example.test/',enabled:true}]:[];let calls=0;
 const b=await prepareBundle(sql,{source_id:'source1'},async()=>{calls++;return calls===1?new Response('<main>Er zijn nieuwe tentoonstellingen en actuele bezoekregels.</main>'+Array.from({length:8},(_,i)=>`<a href="/agenda/${i}">Agenda</a>`).join(''),{headers:{'content-type':'text/html'}}):new Response(null,{status:403});});
 assert.equal(calls,3);assert.equal(b.pages.length,1);assert.equal(b.collection_errors.length,2);assert.equal(b.collection_errors[0].reason,'access_blocked');
});
test('Codex-fouten worden uit JSON-events geclassificeerd; geen onnodige volgende AI-start',()=>fixture(async dir=>{
 const bin=path.join(dir,'fake-codex');await writeFile(bin,`#!${process.execPath}\nprocess.stdout.write(JSON.stringify({type:'turn.failed',error:{message:'Usage limit reached; secret must not be logged'}}));process.exitCode=1;`);await chmod(bin,0o700);
 const failure=await inferProposal('test',{executable:bin,seconds:2});assert.equal(failure.reason,'rate_limited');assert.equal(failure.exit_code,1);assert.equal(failure.usage_measured,false);assert.ok(!JSON.stringify(failure).includes('secret'));
 const sql=async q=>q.includes('kk_update_sources')?[{id:'source1',url:'https://example.test/',enabled:true}]:[];let calls=0;
 const reviewer=createProposalReviewer({sql,fetcher:async()=>new Response('Actuele bezoekinformatie en tentoonstellingen in het museum.',{headers:{'content-type':'text/html'}}),infer:async()=>{calls++;return failure;}});
 const items=[1,2,3,4].map(i=>({source_id:'source'+i,result_file:path.join(dir,i+'.json')}));const out=await reviewer('Bronnenpartij:\n'+JSON.stringify(items),{maxBatchTokens:120000},dir,async()=>{});
 assert.equal(calls,1);assert.equal(out.circuit_error,'rate_limited');assert.equal(out.ai_calls,1);const deferred=JSON.parse(await readFile(items[1].result_file));assert.equal(deferred.retryable,false);assert.equal(deferred.error_code,'deferred_rate_limited');
}));
test('volledig laatste JSON-event zonder newline wordt verwerkt vóór procesafsluiting',()=>fixture(async dir=>{
 const bin=path.join(dir,'fake-codex');await writeFile(bin,`#!${process.execPath}\nprocess.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({summary:'Geen wijziging.',changes:[],candidates:[]})}})+'\\n'+JSON.stringify({type:'turn.completed',usage:{input_tokens:123,output_tokens:4}}));`);await chmod(bin,0o700);
 const output=await inferProposal('test',{executable:bin,seconds:2});assert.equal(output.ok,true);assert.equal(output.tokens,127);assert.equal(output.usage_measured,true);
}));
test('algemeen nieuws zonder kunstinhoud of gekoppelde catalogusrecords start geen AI',()=>fixture(async dir=>{
 const sql=async q=>q.includes('kk_update_sources')?[{id:'krant1',url:'https://example.test/',enabled:true}]:[];
 const reviewer=createProposalReviewer({sql,fetcher:async()=>new Response('<main>De gasprijs stijgt en de productie in de industrie loopt terug.</main>',{headers:{'content-type':'text/html'}}),infer:()=>assert.fail('Geen AI voor niet-relevante nieuwsinhoud')});let charged;
 const result=await reviewer('Bronnenpartij:\n'+JSON.stringify([{source_id:'krant1',result_file:path.join(dir,'result.json')}]),{maxBatchTokens:120000},dir,async n=>charged=n);
 assert.equal(result.reason,'no_art_content');assert.equal(result.ai_calls,0);assert.equal(charged,0);
}));
test('gesplitste UTF-8 in CLI-output blijft intact voor letterlijke bewijsvergelijking',()=>fixture(async dir=>{
 const bin=path.join(dir,'fake-codex');await writeFile(bin,`#!${process.execPath}\nconst text=JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({summary:'Museumbezoek kost € 12.',changes:[],candidates:[]})}});const bytes=Buffer.from(text);const i=bytes.indexOf(Buffer.from('€'))+1;process.stdout.write(bytes.subarray(0,i));setTimeout(()=>process.stdout.write(bytes.subarray(i)),20);`);await chmod(bin,0o700);
 const result=await inferProposal('test',{executable:bin,seconds:2});assert.equal(result.ok,true);assert.equal(result.value.summary,'Museumbezoek kost € 12.');
}));
test('overzicht leidt binnen drie pagina’s naar detail en koppelt genoemde records op andere host',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
 try{
 await db.exec(`create table kk_update_sources(id text,name text,url text,notes text,enabled boolean,updated_at text);
 insert into kk_update_sources values('s','Kunstbron','https://example.test/','',true,'now');
 create table kk_museums(id text,name text,website_url text,summary text,operating_status text,updated_at text);
 insert into kk_museums values('m','Het Museum Krona','https://museum.test/','Bestaande redactie','open','version1');
 insert into kk_museums values('wrong','Museum','https://another.test/','Niet uniek','open','version2');
 create table kk_discoveries(id text,name text,website_url text,summary text,visit_notes text,starts_on date,ends_on date,operating_status text,updated_at text,sources jsonb);`);
 const seen=[];const sql=async q=>(await db.query(q)).rows;
 const b=await prepareBundle(sql,{source_id:'s'},async u=>{seen.push(u);const body=u.endsWith('/tentoonstellingen/detail')?'<main>Museum Krona is tijdelijk gesloten wegens onderhoud. Heropening volgt later.</main>':u.endsWith('/tentoonstellingen')?'<main>Bekijk de actuele tentoonstellingen en bezoekinformatie.</main><a href="/tentoonstellingen/detail">Tentoonstelling detail</a>':'<main>Welkom bij deze kunstbron met actuele tentoonstellingen.</main><a href="/faq">FAQ</a><a href="/tentoonstellingen">Tentoonstellingen</a>';return new Response(body,{headers:{'content-type':'text/html'}});});
 assert.deepEqual(seen,['https://example.test/','https://example.test/tentoonstellingen','https://example.test/tentoonstellingen/detail']);
 assert.deepEqual(b.records.map(r=>r.id),['m']);assert.equal(b.records[0].updated_at,'version1');assert.ok(Buffer.byteLength(reviewPrompt(b))<=REVIEW_LIMITS.inputBytes);
 }finally{await db.close();}
});
