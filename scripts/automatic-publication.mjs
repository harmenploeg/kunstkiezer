import path from 'node:path';
import {readdir,open,unlink,readFile} from 'node:fs/promises';
import {atomicJson,json} from './weekly-updater.mjs';
import {loadReview} from './proposal-processing.mjs';

export const AUTO_POLICY='primary-facts-v1';
const host=url=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return null;}};
function dates(text){
 const found=new Set(text.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[]);
 const months={januari:1,january:1,februari:2,february:2,maart:3,march:3,april:4,mei:5,may:5,juni:6,june:6,juli:7,july:7,augustus:8,august:8,september:9,oktober:10,october:10,november:11,december:12};
 for(const m of text.toLowerCase().matchAll(/\b(\d{1,2})[\s/-]+([a-z]+|\d{1,2})[\s/-]+(\d{4})\b/g)){const month=months[m[2]]||Number(m[2]);if(month>=1&&month<=12)found.add(`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}`);}
 return found;
}
export function automaticEligibility(review,now=Date.now()){
 const {artifact,bundle}=review;
 if(!artifact.changes.length)return {eligible:false,reason:artifact.candidates.length?'candidates_need_review':'no_changes'};
 for(const c of artifact.changes){
  const record=bundle.records.find(r=>r.id===c.record_id&&r.record_table===c.table),page=bundle.pages.find(p=>p.url===c.evidence_url);
  if(!record?.website_url||host(c.evidence_url)!==host(record.website_url))return {eligible:false,reason:'primary_evidence_required'};
  const age=now-Date.parse(page?.fetched_at);if(!Number.isFinite(age)||age< -300000||age>48*3600000)return {eligible:false,reason:'fresh_evidence_required'};
  const quote=c.evidence_quote;
  if(c.field==='operating_status'&&(/\b(?:niet|not|no longer|zal|will|was)\b/i.test(quote)||/vanaf|starting|from/i.test(quote)&&[...dates(quote)].some(d=>d>new Date(now).toISOString().slice(0,10))))return {eligible:false,reason:'ambiguous_status_evidence'};
  if(c.field==='operating_status'){
   const patterns={temporarily_closed:/tijdelijk gesloten|temporarily closed|gesloten.*(?:verbouw|onderhoud)|closed.*(?:renovat|maintenance)/i,closed:/definitief gesloten|permanent(?:ly)? closed|houdt op te bestaan/i,open:/is (?:weer open|heropend)|has reopened|is open again/i};
   if(!patterns[c.after]?.test(quote))return {eligible:false,reason:'explicit_status_evidence_required'};
  }else if(['starts_on','ends_on'].includes(c.field)){
   if(c.after===null||!dates(quote).has(c.after))return {eligible:false,reason:'explicit_date_evidence_required'};
  }else if(c.field==='visit_notes'){
   if(!c.after?.trim()||!quote.includes(c.after.trim()))return {eligible:false,reason:'literal_visit_information_required'};
  }else return {eligible:false,reason:'editorial_field_needs_review'};
 }
 return {eligible:true,reason:'primary_facts_verified'};
}
async function proposals(dir){
 const result=[];for(const folder of await readdir(path.join(dir,'batches'),{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
  if(!folder.isDirectory())continue;const root=path.join(dir,'batches',folder.name);
  for(const f of await readdir(root,{withFileTypes:true}))if(f.isFile()&&f.name.endsWith('-proposal.json'))result.push(path.join(root,f.name));
 }
 return result.sort();
}
export async function publicationInProgress(dir){const s=await json(path.join(dir,'automatic-publication.json'),{});return Boolean(s.job&&!['verified','waiting_for_update'].includes(s.job.status));}
export async function automaticPublicationTick({dir,sql,now=Date.now(),driver=null}={}){
 const activation=await json(path.join(dir,'activation.json'),{});
 if(activation.enabled!==true||activation.automatic_publication?.enabled!==true)return {status:'automatic_publication_disabled'};
 if(activation.automatic_publication.policy!==AUTO_POLICY||!Number.isFinite(Date.parse(activation.automatic_publication.authorized_at)))throw new Error('automatic_publication_authorization_required');
 let lock;const lockFile=path.join(dir,'runner.lock');
 try{lock=await open(lockFile,'wx',0o600);await lock.writeFile(String(process.pid));}catch(e){if(e.code!=='EEXIST')throw e;const pid=Number(await readFile(lockFile,'utf8'));if(!Number.isSafeInteger(pid)||pid<1)throw new Error('invalid_runner_lock');try{process.kill(pid,0);return {status:'publication_busy'};}catch(error){if(error.code!=='ESRCH')throw error;}await unlink(lockFile);return {status:'publication_stale_lock_removed'};}
 try{
  const file=path.join(dir,'automatic-publication.json');let state=await json(file,{version:1,seen:{},job:null});
  if(state.version!==1)throw new Error('unknown_publication_state');
  const save=async()=>atomicJson(file,state);
  if(state.job?.status==='verified')state.job=null;
  if(!state.job){
   for(const proposal of await proposals(dir)){
    let review;try{review=await loadReview(proposal);}catch{state.seen[proposal]={status:'needs_review',reason:'invalid_proposal',at:new Date(now).toISOString()};continue;}
    if(state.seen[proposal]?.digest===review.digest)continue;
    const receipt=await json(proposal+'.receipt.json',null);
    if(receipt?.digest===review.digest&&receipt.status==='verified'){state.seen[proposal]={digest:review.digest,status:'verified'};continue;}
    const policy=automaticEligibility(review,now);
    if(!policy.eligible){state.seen[proposal]={digest:review.digest,status:policy.reason==='no_changes'?'no_changes':'needs_review',reason:policy.reason,at:new Date(now).toISOString()};continue;}
    // Existing collection queue drains first; the writer never overlaps another update.
    if((await sql("select id from public.kk_update_runs where status in ('queued','running')")).length){await save();return {status:'publication_waiting_for_update'};}
    state.job={digest:review.digest,file:proposal,phase:'prepare_source',status:'pending',authorized_by:'Automatisch namens beheerder; '+AUTO_POLICY,authorized_at:activation.automatic_publication.authorized_at,created_at:new Date(now).toISOString(),attempts:0};break;
   }
   await save();
  }
  if(!state.job)return {status:'no_automatic_corrections',manual_review:Object.values(state.seen).filter(s=>s.status==='needs_review').length};
  const job=state.job;
  if(job.status==='blocked')return {status:'publication_blocked',phase:job.phase,reason:job.last_error};
  if(job.retry_at&&Date.parse(job.retry_at)>now)return {status:'publication_retry_wait',phase:job.phase};
  if(!job.database_applied&&(await sql("select id from public.kk_update_runs where status in ('queued','running')")).length){job.status='waiting_for_update';await save();return {status:'publication_waiting_for_update'};}
  job.status='pending';
  if(!driver){const {createControlledPublisher}=await import('./controlled-publisher.mjs');driver=createControlledPublisher({dir,sql});}
  try{
   const progress=await driver.advance(job,async updated=>{state.job=updated;await save();});
   state.job={...state.job,...progress,attempts:0,retry_at:null,last_error:null};
   if(state.job.status==='verified')state.seen[job.file]={digest:job.digest,status:'verified',at:new Date(now).toISOString()};
   await save();return {status:state.job.status==='verified'?(state.job.published===false?'automatically_processed':'automatically_published'):'publication_in_progress',phase:state.job.phase,proposal:job.file};
  }catch(error){
   const permanentCodes=new Set(['record_version_conflict','record_website_conflict','original_value_conflict','source_changed_or_disabled','proposal_run_identity_mismatch','evidence_changed_or_unavailable','database_verification_failed','audit_verification_failed','baseline_value_conflict','proposal_changed']);
   const code=error.safeCode||(permanentCodes.has(error.message)?error.message:'controlled_publication_step_failed'),current=state.job;current.attempts++;
   current.last_error=code;current.status=error.permanent||permanentCodes.has(code)||current.attempts>=3?'blocked':'pending';current.retry_at=new Date(now+1800000).toISOString();await save();
   return {status:current.status==='blocked'?'publication_blocked':'publication_retry_wait',phase:current.phase,reason:code};
  }
 }finally{await lock.close();await unlink(lockFile);}
}
