import {execFile as callback} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {database,json,settings,DEFAULTS} from './weekly-updater.mjs';
const exec=promisify(callback);
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const PROJECT='qrlfywcqkkzmerglmsbj';
export const KEYCHAIN_SERVICE='nl.loci.kunstkiezer.supabase-management';
export async function managementToken(env=process.env,run=exec){
 if(env.SUPABASE_ACCESS_TOKEN)return env.SUPABASE_ACCESS_TOKEN;
 try{return (await run('/usr/bin/security',['find-generic-password','-s',KEYCHAIN_SERVICE,'-a','kunstkiezer-updater','-w'],{timeout:10000,maxBuffer:16384})).stdout.trim();}
 catch{return null;}
}
export async function oldAutomationActive(home=os.homedir()){
 try{return /^status\s*=\s*"ACTIVE"/m.test(await readFile(path.join(home,'.codex/automations/kunstkiezer-wekelijks-actualiseren/automation.toml'),'utf8'));}
 catch(e){if(e.code==='ENOENT')return false;throw e;}
}
export function connectionSummary(servers){
 return servers.filter(s=>s.enabled!==false).map(s=>({name:s.name,supabase:/supabase/i.test(s.name+' '+(s.transport?.url||s.url||'')),browser:/cua|computer.use|browser/i.test(s.name)}));
}
export async function readiness({env=process.env,run=exec,sql=null,token=null,home=os.homedir()}={}){
 const codex=env.KUNSTKIEZER_CODEX_BIN||'/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
 const checks={project:!env.KUNSTKIEZER_PROJECT_REF||env.KUNSTKIEZER_PROJECT_REF===PROJECT,node:Number(process.versions.node.split('.')[0])>=24,config:false,codexLogin:false,
   cliSupabaseConfigured:false,cliBrowserConfigured:false,managementAccess:false,oldAutomationStopped:false};
 try{settings(await json(path.join(ROOT,'data/curation/updater-config.json'),{}));checks.config=true;}catch{}
 try{const r=await run(codex,['login','status'],{timeout:10000});checks.codexLogin=/Logged in/.test(r.stdout+' '+r.stderr);}catch{}
 try{const r=await run(codex,['mcp','list','--json'],{timeout:10000,maxBuffer:1024*1024});
   const servers=connectionSummary(JSON.parse(r.stdout));checks.cliSupabaseConfigured=servers.some(s=>s.supabase);checks.cliBrowserConfigured=servers.some(s=>s.browser);
 }catch{}
 try{checks.oldAutomationStopped=!await oldAutomationActive(home);}catch{}
 token??=await managementToken(env,run);
 let schedule=null;
 try{if(checks.project&&(token||sql)){const query=sql||database(token,env.KUNSTKIEZER_PROJECT_REF||PROJECT);
   schedule=await query('select enabled,weekday,local_time,next_due from public.kk_update_schedule');checks.managementAccess=true;}}
 catch{/* No raw database or credential errors in the report. */}
 const blockers=Object.entries(checks).filter(([key,ok])=>!ok&&!['cliSupabaseConfigured','cliBrowserConfigured'].includes(key)).map(([key])=>key);
 return {readyForLiveTrial:blockers.length===0,checks,blockers,schedule,model:DEFAULTS.model,
   note:'MCP-configuratie bewijst nog geen werkende OAuth- of browsersessie. Een beperkte liveproef blijft nodig.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(await readiness(),null,2));
}
