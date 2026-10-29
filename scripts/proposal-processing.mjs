import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {validateProposal,fetchPage} from './proposal-reviewer.mjs';
import {atomicJson,json} from './weekly-updater.mjs';

export const PRODUCTION='https://loci-kunstkiezer.pages.dev';
export const SUPABASE='https://qrlfywcqkkzmerglmsbj.supabase.co';
export const CATEGORIES=['openbare-kunst','beeldenparken','architectuur','evenementen'];
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const hash=s=>createHash('sha256').update(s).digest('hex');
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const uuid=s=>{const h=hash(s);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
const same=(a,b)=>stable(a)===stable(b);
const validUuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(s);
function time(value){if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new Error('invalid_timestamp');return value;}
function projection(artifact){return {summary:artifact.summary,changes:artifact.changes,candidates:artifact.candidates};}
export function inspectProposal(artifact,bundle){
 if(artifact.status!=='needs_review'||artifact.source_id!==bundle.source?.id||artifact.published!==false||artifact.catalog_changed!==false)throw new Error('not_a_reviewable_proposal');
 validateProposal(projection(artifact),bundle);
 time(bundle.source.updated_at);
 for(const change of artifact.changes){
  if(!validUuid(change.record_id))throw new Error('invalid_record_id');time(change.expected_updated_at);
  if(!['starts_on','ends_on'].includes(change.field)&&typeof change.after!=='string')throw new Error('null_text_field');
  if(['starts_on','ends_on'].includes(change.field)&&change.after!==null){const d=new Date(change.after);if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==change.after)throw new Error('invalid_calendar_date');}
  const url=new URL(change.evidence_url);
  const record=bundle.records.find(r=>r.id===change.record_id&&r.record_table===change.table);
  const origins=[bundle.source.url,record.website_url].filter(Boolean).map(v=>new URL(v));
  if(!origins.some(source=>source.protocol==='https:'&&!source.username&&!source.password&&url.port===source.port&&url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.replace(/^www\./,'')===source.hostname.replace(/^www\./,'')))throw new Error('evidence_outside_source');
 }
 const digest=hash(stable({proposal:projection(artifact),source_id:artifact.source_id,bundle}));
 return {digest,runId:uuid('kunstkiezer-proposal:'+digest),changes:artifact.changes.length,candidates:artifact.candidates.length};
}
export async function loadReview(file){
 const artifact=JSON.parse(await readFile(file,'utf8'));
 if(typeof artifact.bundle_file!=='string'||path.dirname(path.resolve(artifact.bundle_file))!==path.dirname(path.resolve(file)))throw new Error('bundle_must_be_next_to_proposal');
 const bundle=JSON.parse(await readFile(artifact.bundle_file,'utf8'));
 return {artifact,bundle,...inspectProposal(artifact,bundle)};
}
export async function approveProposal(file,expectedDigest,reviewer){
 const review=await loadReview(file);
 if(review.digest!==expectedDigest||!reviewer?.trim()||reviewer.length>120)throw new Error('approval_does_not_match_review');
 const approval={digest:review.digest,reviewer:reviewer.trim(),approved_at:new Date().toISOString()};
 await atomicJson(file+'.approval.json',approval);return approval;
}
function groups(artifact,bundle){
 const all=new Map();
 for(const change of artifact.changes){const key=change.table+':'+change.record_id;
  if(!all.has(key))all.set(key,{table:change.table,id:change.record_id,expected:change.expected_updated_at,name:bundle.records.find(r=>r.id===change.record_id&&r.record_table===change.table).name,website:bundle.records.find(r=>r.id===change.record_id&&r.record_table===change.table).website_url,changes:[]});
  const group=all.get(key);if(group.expected!==change.expected_updated_at)throw new Error('inconsistent_record_version');group.changes.push(change);
 }
 return [...all.values()].sort((a,b)=>(a.table+a.id).localeCompare(b.table+b.id));
}
export function applicationSql(artifact,bundle,approval){
 const review=inspectProposal(artifact,bundle);
 if(approval?.digest!==review.digest||!approval.reviewer?.trim()||approval.reviewer.length>120)throw new Error('approval_required');time(approval.approved_at);
 if(!artifact.changes.length)throw new Error('no_changes');
 const literal=v=>v===null?'NULL':q(v);
 let body=`declare row_data jsonb; affected integer; begin
 perform pg_advisory_xact_lock(7483922);
 if exists(select 1 from public.kk_update_runs where id=${q(review.runId)}::uuid) then
  if not exists(select 1 from public.kk_update_runs where id=${q(review.runId)}::uuid and summary like ${q('proposal:'+review.digest+'%')}) then raise exception 'proposal_run_identity_mismatch'; end if;
  return;
 end if;
 if exists(select 1 from public.kk_update_runs where status in ('queued','running')) then raise exception 'another_update_is_active'; end if;
 perform 1 from public.kk_update_sources where id=${q(artifact.source_id)} and enabled and updated_at=${q(bundle.source.updated_at)}::timestamptz for share;
 if not found then raise exception 'source_changed_or_disabled'; end if;
 insert into public.kk_update_runs(id,reason,status,started_at,summary) values(${q(review.runId)}::uuid,'manual','running',now(),${q('proposal:'+review.digest+' database_applied; publication_pending')});
 `;
 for(const group of groups(artifact,bundle)){
  body+=`select to_jsonb(r) into row_data from public.${group.table} r where id=${q(group.id)}::uuid for update;
   if row_data is null or (row_data->>'updated_at')::timestamptz<>${q(group.expected)}::timestamptz then raise exception 'record_version_conflict'; end if;
   `;
  if(group.website)body+=`if (row_data->>'website_url') is distinct from ${q(group.website)} then raise exception 'record_website_conflict'; end if;\n`;
  for(const c of group.changes)body+=`if (row_data->${q(c.field)}) is distinct from ${q(JSON.stringify(c.before))}::jsonb then raise exception 'original_value_conflict'; end if;\n`;
  body+=`update public.${group.table} set ${group.changes.map(c=>c.field+'='+literal(c.after)).join(',')} where id=${q(group.id)}::uuid and updated_at=${q(group.expected)}::timestamptz;
   get diagnostics affected = row_count;
   if affected<>1 then raise exception 'record_version_conflict'; end if;
  `;
  for(const c of group.changes)body+=`insert into public.kk_update_changes(id,run_id,change,record_table,record_id,record_name,fields,source_id,source_url,note)
   values(${q(uuid(review.digest+':'+c.table+':'+c.record_id+':'+c.field))}::uuid,${q(review.runId)}::uuid,'updated',${q(c.table)},${q(c.record_id)}::uuid,${q(String(group.name).slice(0,200))},array[${q(c.field)}],${q(artifact.source_id)},${q(c.evidence_url)},${q(('Goedgekeurd door '+approval.reviewer+'; voorstel '+review.digest+'; bewijs: '+c.evidence_quote).slice(0,500))});\n`;
 }
 body+=`update public.kk_update_runs set status='failed',finished_at=now() where id=${q(review.runId)}::uuid; end;`;let delimiter='$kk_'+hash(body).slice(0,24)+'$';while(body.includes(delimiter))delimiter=delimiter.slice(0,-1)+'x$';
 // All identifiers come from validated allowlists; source data are escaped SQL literals.
 return `DO ${delimiter}${body}${delimiter};`;
}
async function rowsAfter(sql,artifact,bundle){
 const out=[];
 for(const group of groups(artifact,bundle)){
  const rows=await sql(`select * from public.${group.table} where id=${q(group.id)}::uuid`);
  if(rows.length!==1||group.changes.some(c=>!same(rows[0][c.field],c.after)))throw new Error('database_verification_failed');
  out.push({table:group.table,row:rows[0],fields:group.changes.map(c=>c.field)});
 }
 return out;
}
async function verifyAudit(sql,review){
 const rows=await sql(`select record_table,record_id,fields,source_id,source_url from public.kk_update_changes where run_id=${q(review.runId)}::uuid`);
 if(rows.length!==review.artifact.changes.length||review.artifact.changes.some(c=>!rows.some(r=>r.record_table===c.table&&r.record_id===c.record_id&&same(r.fields,[c.field])&&r.source_id===review.artifact.source_id&&r.source_url===c.evidence_url)))throw new Error('audit_verification_failed');
}
async function currentEvidence(artifact,fetcher){
 const pages=new Map();
 for(const change of artifact.changes){if(!pages.has(change.evidence_url))pages.set(change.evidence_url,await fetchPage(change.evidence_url,fetcher));
  if(!pages.get(change.evidence_url)?.text.includes(change.evidence_quote))throw new Error('evidence_changed_or_unavailable');
 }
}
export async function applyProposal({file,sql,fetcher=fetch,store=atomicJson}={}){
 const review=await loadReview(file),approval=await json(file+'.approval.json',null);
 if(approval?.digest!==review.digest)throw new Error('approval_required');
 const receiptFile=file+'.receipt.json';
 if(!review.changes){const receipt={digest:review.digest,status:'no_changes',catalog_changed:false,published:false,candidates_pending:review.candidates};await store(receiptFile,receipt);return receipt;}
 // Same content always has the same database identity, including after an ambiguous network response.
 const previous=await sql(`select id,status,summary from public.kk_update_runs where id=${q(review.runId)}::uuid`);
 if(!previous.length){
  await currentEvidence(review.artifact,fetcher);
  await store(receiptFile,{digest:review.digest,run_id:review.runId,status:'applying',published:false});
  try{await sql(applicationSql(review.artifact,review.bundle,approval));}
  catch(error){
   const exists=await sql(`select id,status,summary from public.kk_update_runs where id=${q(review.runId)}::uuid`);
   if(!exists.length){await store(receiptFile,{digest:review.digest,run_id:review.runId,status:'not_applied',published:false});throw error;}
   // Recover the commit result from database state. Never retry writes blindly.
  }
 }
 const identity=(await sql(`select id,status,summary from public.kk_update_runs where id=${q(review.runId)}::uuid`))[0];
 if(!identity?.summary?.startsWith('proposal:'+review.digest))throw new Error('proposal_run_identity_mismatch');
 await verifyAudit(sql,review);
 const verified=await rowsAfter(sql,review.artifact,review.bundle);
 const oldReceipt=await json(receiptFile,null);if(oldReceipt?.digest===review.digest&&oldReceipt.status==='verified')return oldReceipt;
 const receipt={digest:review.digest,run_id:review.runId,status:'database_verified',catalog_changed:true,published:false,
  verified_at:new Date().toISOString(),records:verified};
 await store(receiptFile,receipt);return receipt;
}
export async function stagePublication({file,sql,directory}={}){
 const review=await loadReview(file),receipt=await json(file+'.receipt.json',null);
 if(receipt?.digest!==review.digest||!['database_verified','verification_blocked','publication_pending','verified'].includes(receipt.status))throw new Error('database_verification_required');
 await rowsAfter(sql,review.artifact,review.bundle);
 const files={};
 const snapshot=(await sql(`select jsonb_build_object(
  'art-inventory.json',(select coalesce(jsonb_agg(to_jsonb(m) order by m.name,m.id),'[]'::jsonb) from public.kk_museums m where publication_status='published' and is_art_museum),
  ${CATEGORIES.map(c=>q(c+'.json')+`,(select coalesce(jsonb_agg(to_jsonb(d) order by d.name,d.id),'[]'::jsonb) from public.kk_discoveries d where publication_status='published' and category=${q(c)})`).join(',')}
 ) as snapshot`))[0]?.snapshot;
 if(!snapshot)throw new Error('publication_snapshot_failed');
 for(const item of receipt.records||[]){if(item.row.publication_status!=='published')continue;
  const name=item.table==='kk_museums'?'art-inventory.json':item.row.category+'.json',row=snapshot[name]?.find(r=>r.id===item.row.id);
  if(!row||item.fields.some(field=>!same(row[field],item.row[field])))throw new Error('publication_snapshot_conflict');
 }
 await mkdir(directory,{recursive:true});
 for(const [name,rows] of Object.entries(snapshot)){
  if(!['art-inventory.json',...CATEGORIES.map(c=>c+'.json')].includes(name)||!Array.isArray(rows)||rows.some(r=>r.publication_status!=='published'))throw new Error('invalid_publication_snapshot');
  await atomicJson(path.join(directory,name),rows);files[name]={sha256:hash(await readFile(path.join(directory,name))),records:rows.length};
 }
 if(Object.keys(files).length!==5)throw new Error('incomplete_publication_snapshot');
 const manifest={digest:review.digest,run_id:review.runId,status:'awaiting_controlled_deployment',production:PRODUCTION,files,created_at:new Date().toISOString()};
 await atomicJson(path.join(directory,'manifest.json'),manifest);return manifest;
}
async function verifyPublicationInternal({file,sql,releaseDirectory,fetcher=fetch,deployment=null,verifyDeployment=verifyControlledDeployment}={}){
 const review=await loadReview(file),receipt=await json(file+'.receipt.json',null);
 if(receipt?.digest!==review.digest||!receipt.catalog_changed)throw new Error('database_verification_required');
 await verifyAudit(sql,review);
 const records=await rowsAfter(sql,review.artifact,review.bundle);
 const publicRecords=records.filter(r=>r.row.publication_status==='published');
 let manifest=null;
 if(publicRecords.length){
  manifest=await json(path.join(releaseDirectory||'','manifest.json'),null);
  if(manifest?.digest!==review.digest||manifest.run_id!==review.runId)throw new Error('publication_manifest_required');
  deployment=await verifyDeployment({...deployment,files:manifest.files});
 }
 const configResponse=await fetcher(PRODUCTION+'/api/config',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!configResponse.ok)throw new Error('production_config_unavailable');const config=await configResponse.json();
 if(config.APP_ENV!=='production'||config.PUBLIC_SUPABASE_URL!==SUPABASE||!/^sb_publishable_/.test(config.PUBLIC_SUPABASE_PUBLISHABLE_KEY||''))throw new Error('production_project_mismatch');
 for(const item of records){
  const select=['id',...item.fields].join(',');
  const r=await fetcher(`${SUPABASE}/rest/v1/${item.table}?id=eq.${encodeURIComponent(item.row.id)}&select=${select}`,{cache:'no-store',headers:{apikey:config.PUBLIC_SUPABASE_PUBLISHABLE_KEY},redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error('public_api_unavailable');const rows=await r.json();
  if(item.row.publication_status==='published'){
   if(rows.length!==1||item.fields.some(f=>!same(rows[0][f],item.row[f])))throw new Error('public_api_mismatch');
  }else if(rows.length!==0)throw new Error('private_record_exposed');
 }
 if(publicRecords.length){
  const versionResponse=await fetcher(PRODUCTION+'/version.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!versionResponse.ok)throw new Error('production_revision_mismatch');const version=await versionResponse.json();if(version.commit!==deployment.source_commit||version.repository!=='harmenploeg/kunstkiezer')throw new Error('production_revision_mismatch');
  for(const name of ['art-inventory.json',...CATEGORIES.map(c=>c+'.json')]){
   const expected=manifest.files[name]?.sha256;if(!expected||hash(await readFile(path.join(releaseDirectory,name)))!==expected)throw new Error('staged_release_changed');
   const response=await fetcher(PRODUCTION+'/'+name,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok||hash(Buffer.from(await response.arrayBuffer()))!==expected)throw new Error('production_download_mismatch');
  }
 }
 // Refuse success if an editor changed the requested values while the external checks ran.
 await rowsAfter(sql,review.artifact,review.bundle);
 await sql(`update public.kk_update_runs set status='completed',finished_at=now(),summary=${q('proposal:'+review.digest+' verified; database, public API'+(publicRecords.length?', controlled production and five downloads':' (private record remains private)'))} where id=${q(review.runId)}::uuid and summary like ${q('proposal:'+review.digest+'%')}`);
 const result={...receipt,status:'verified',published:publicRecords.length>0,verified_at:new Date().toISOString(),deployment};
 await atomicJson(file+'.receipt.json',result);return result;
}

export async function verifyControlledDeployment(input,{run=promisify(execFile)}={}){
 if(!/^\d+$/.test(String(input?.run_id))||!/^([a-f0-9]{40})$/.test(input?.source_commit||'')||!/^([a-f0-9]{40})$/.test(input?.integration_commit||''))throw new Error('controlled_deployment_required');
 const {stdout}=await run('gh',['run','view',String(input.run_id),'--repo','harmenploeg/interactief','--json','conclusion,headSha,url,status,name'],{timeout:30000,maxBuffer:16384});
 const actual=JSON.parse(stdout);
 if(actual.conclusion!=='success'||actual.status!=='completed'||actual.headSha!==input.integration_commit||actual.name!=='Controleer LOCI-publicatiepakket'||actual.url!=='https://github.com/harmenploeg/interactief/actions/runs/'+input.run_id)throw new Error('controlled_deployment_not_verified');
 const checkResult=await run('gh',['api',`repos/harmenploeg/interactief/commits/${input.integration_commit}/check-runs?check_name=Loci%20gecontroleerde%20productie`],{timeout:30000,maxBuffer:1048576});
 if(!JSON.parse(checkResult.stdout).check_runs?.some(c=>c.name==='Loci gecontroleerde productie'&&c.status==='completed'&&c.conclusion==='success'&&c.head_sha===input.integration_commit))throw new Error('production_check_missing');
 const get=async name=>{
  const {stdout}=await run('gh',['api',`repos/harmenploeg/interactief/contents/kunstkiezer/${name}?ref=${input.integration_commit}`],{timeout:30000,maxBuffer:8388608});
  const content=JSON.parse(stdout);if(content.encoding!=='base64'||typeof content.content!=='string')throw new Error('controlled_release_file_missing');return Buffer.from(content.content,'base64');
 };
 const version=JSON.parse((await get('version.json')).toString('utf8'));
 if(version.repository!=='harmenploeg/kunstkiezer'||version.commit!==input.source_commit)throw new Error('controlled_source_revision_mismatch');
 for(const name of ['art-inventory.json',...CATEGORIES.map(c=>c+'.json')])if(!input.files?.[name]?.sha256||hash(await get(name))!==input.files[name].sha256)throw new Error('controlled_release_file_mismatch');
 return {...input,repository:'harmenploeg/interactief',url:actual.url,verified:true};
}

export async function verifyPublication(options){
 try{return await verifyPublicationInternal(options);}
 catch(error){
  const file=options.file+'.receipt.json',receipt=await json(file,null);
  if(receipt?.catalog_changed)await atomicJson(file,{...receipt,status:'verification_blocked',published:false,last_error:error.message});
  throw error;
 }
}
export async function installRelease(directory,checkout,{run=promisify(execFile)}={}){
 const manifest=await json(path.join(directory,'manifest.json'),null);
 if(manifest?.status!=='awaiting_controlled_deployment'||!manifest.digest)throw new Error('publication_manifest_required');
 const remote=(await run('git',['-C',checkout,'remote','get-url','origin'],{timeout:10000})).stdout.trim();
 if(!/(github\.com[/:])harmenploeg\/kunstkiezer(?:\.git)?$/.test(remote))throw new Error('wrong_source_repository');
 if((await run('git',['-C',checkout,'status','--porcelain'],{timeout:10000})).stdout.trim())throw new Error('source_checkout_must_be_clean');
 const names=['art-inventory.json',...CATEGORIES.map(c=>c+'.json')];
 // Validate the entire package before copying any file.
 for(const name of names)if(!manifest.files[name]?.sha256||hash(await readFile(path.join(directory,name)))!==manifest.files[name].sha256)throw new Error('staged_release_changed');
 const installed=[];
 for(const name of names){const target=path.join(checkout,name==='art-inventory.json'?'data/museums':'data/discovery',name);await copyFile(path.join(directory,name),target);installed.push(target);}
 return {status:'ready_for_build_and_review',digest:manifest.digest,installed};
}
