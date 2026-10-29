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
