import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readiness,managementToken,connectionSummary,oldAutomationActive,PROJECT} from '../scripts/updater-readiness.mjs';
const run=async(_bin,args)=>args[0]==='login'?{stdout:'Logged in using ChatGPT',stderr:''}:
 {stdout:JSON.stringify([{name:'kunstkiezer-supabase',enabled:true,transport:{url:'https://mcp.supabase.com/mcp'}},{name:'cua_repl',enabled:true}]),stderr:''};
async function fixture(fn){const home=await mkdtemp(path.join(tmpdir(),'kk-preflight-'));try{await fn(home);}finally{await rm(home,{recursive:true,force:true});}}
test('preflight doet uitsluitend een leesquery en toont geen credential',()=>fixture(async home=>{
 const queries=[];const out=await readiness({home,env:{KUNSTKIEZER_PROJECT_REF:PROJECT},run,token:'secret-test-token',sql:async q=>{queries.push(q);return [{enabled:true}];}});
 assert.equal(out.readyForLiveTrial,true);assert.equal(queries.length,1);assert.ok(queries[0].startsWith('select '));assert.ok(!JSON.stringify(out).includes('secret-test-token'));
}));
test('ontbrekende toegang blokkeert gereedheid zonder ruwe keychainfouten te lekken',()=>fixture(async home=>{
 const out=await readiness({home,env:{},run:async()=>{throw new Error('sensitive-error');}});
 assert.equal(out.readyForLiveTrial,false);assert.equal(out.checks.managementAccess,false);assert.ok(!JSON.stringify(out).includes('sensitive-error'));
}));
test('oude automatisering moet gestopt zijn; andere projectref wordt geweigerd',()=>fixture(async home=>{
 const dir=path.join(home,'.codex/automations/kunstkiezer-wekelijks-actualiseren');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'automation.toml'),'status = "ACTIVE"\n');
 assert.equal(await oldAutomationActive(home),true);
 const out=await readiness({home,env:{KUNSTKIEZER_PROJECT_REF:'otherproject'},run,token:'test',sql:()=>assert.fail()});
 assert.equal(out.checks.project,false);assert.equal(out.checks.oldAutomationStopped,false);assert.equal(out.readyForLiveTrial,false);
}));
test('keychainlezing gebruikt uitsluitend het toegewezen onderdeel en geen shell',async()=>{
 let captured;const token=await managementToken({},async(bin,args)=>{captured={bin,args};return {stdout:'test-token\n'};});
 assert.equal(token,'test-token');assert.equal(captured.bin,'/usr/bin/security');assert.deepEqual(captured.args,['find-generic-password','-s','nl.loci.kunstkiezer.supabase-management','-a','kunstkiezer-updater','-w']);
 const servers=connectionSummary([{name:'supabase',enabled:false},{name:'openai-docs',enabled:true}]);assert.ok(!servers.some(s=>s.supabase));
});
