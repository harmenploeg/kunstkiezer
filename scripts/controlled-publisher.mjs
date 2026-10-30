import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,access,readFile,writeFile,realpath,rm} from 'node:fs/promises';
import {loadReview,approveProposal,applyProposal,stagePublication,installRelease,verifyPublication,verifyControlledDeployment,CATEGORIES} from './proposal-processing.mjs';
import {automaticEligibility} from './automatic-publication.mjs';
const SOURCE='harmenploeg/kunstkiezer',INTEGRATION='harmenploeg/interactief';
const exports=['data/museums/art-inventory.json',...CATEGORIES.map(c=>'data/discovery/'+c+'.json')];
const sha=s=>{if(!/^[a-f0-9]{40}$/.test(s||''))throw failure('invalid_commit',true);return s;};
const failure=(code,permanent=false)=>Object.assign(new Error(code),{safeCode:code,permanent});
const exists=async file=>{try{await access(file);return true;}catch{return false;}};
export function createControlledPublisher({dir,sql,fetcher=fetch,execute=promisify(execFile)}={}){
 const env={};for(const key of ['HOME','USER','LOGNAME','PATH','TMPDIR','LANG','LC_ALL','SSL_CERT_FILE','NODE_EXTRA_CA_CERTS','HTTPS_PROXY','HTTP_PROXY','ALL_PROXY','NO_PROXY','SSH_AUTH_SOCK','GH_TOKEN','GITHUB_TOKEN','GH_HOST'])if(process.env[key])env[key]=process.env[key];
 const run=async(cmd,args,cwd,timeout=30000)=>{try{return (await execute(cmd,args,{cwd,env,timeout,maxBuffer:8*1024*1024})).stdout.trim();}catch{throw failure('command_failed_'+path.basename(cmd));}};
 const gh=async args=>JSON.parse(await run('gh',args));
 const verifyDeployment=input=>verifyControlledDeployment(input,{run:(cmd,args,options)=>execute(cmd,args,{...options,env})});
 async function clone(repo,folder){
  if(!await exists(folder))await run('git',['clone','--depth','1','https://github.com/'+repo+'.git',folder],undefined,120000);
  if(await realpath(folder)!==path.join(await realpath(path.dirname(folder)),path.basename(folder)))throw failure('managed_checkout_must_not_be_symlink',true);
  const remote=await run('git',['remote','get-url','origin'],folder);
  if(remote!=='https://github.com/'+repo+'.git')throw failure('wrong_managed_repository',true);
 }
 async function workflow(repo,head,name){
  const all=await gh(['api',`repos/${repo}/actions/runs?head_sha=${sha(head)}&per_page=50`]);
  const runs=all.workflow_runs.filter(r=>r.head_sha===head&&r.name===name&&['push','pull_request'].includes(r.event)).sort((a,b)=>b.id-a.id);
  if(!runs.length||runs[0].status!=='completed')return null;
  if(runs[0].conclusion!=='success')throw failure('required_workflow_failed',true);
  return String(runs[0].id);
 }
 async function ensurePr(repo,branch,title,bodyFile,head){
  const found=await gh(['pr','list','--repo',repo,'--head',branch,'--base','main','--state','all','--json','number,state,headRefOid']);
  if(found.length){if(found.length!==1||found[0].headRefOid!==head||found[0].state==='CLOSED')throw failure('publication_pr_conflict',true);return found[0].number;}
  await run('gh',['pr','create','--repo',repo,'--base','main','--head',branch,'--title',title,'--body-file',bodyFile],undefined);
  const created=await gh(['pr','list','--repo',repo,'--head',branch,'--base','main','--json','number,headRefOid']);
  if(created.length!==1||created[0].headRefOid!==head)throw failure('publication_pr_not_verified',true);return created[0].number;
 }
 async function merge(repo,number,head){
  let pr=await gh(['pr','view',String(number),'--repo',repo,'--json','state,headRefOid,mergeCommit']);
  if(pr.headRefOid!==head)throw failure('publication_pr_changed',true);
  if(pr.state!=='MERGED'){
   if(pr.state!=='OPEN')throw failure('publication_pr_closed',true);
   await run('gh',['pr','merge',String(number),'--repo',repo,'--squash','--match-head-commit',head]);
   pr=await gh(['pr','view',String(number),'--repo',repo,'--json','state,mergeCommit']);
  }
  if(pr.state!=='MERGED')throw failure('publication_merge_not_verified');return sha(pr.mergeCommit?.oid);
 }
 async function publishBranch(repo,folder,branch,head,job,save,prefix){
  await run('git',['push','origin',`${sha(head)}:refs/heads/${branch}`],folder,120000);
  const bodyFile=path.join(path.dirname(folder),prefix+'-pr.md');
  await writeFile(bodyFile,`Geautomatiseerde feitelijke Kunstkiezer-correctie, geautoriseerd door de beheerder op ${job.authorized_at}.\n\nVoorstelvingerafdruk: ${job.digest}. Alleen bestaande velden met vers primair bronbewijs. Catalogusversies, audit en publicatiepakket worden gecontroleerd. Geen nieuwe kandidaten toegevoegd. Publicatie wordt pas bevestigd na de gecontroleerde productieketen en livecontrole van de vijf downloads.\n`);
  job[prefix+'Pr']=await ensurePr(repo,branch,'Verwerk gecontroleerde Kunstkiezer-correctie '+job.digest.slice(0,12),bodyFile,head);await save(job);
 }
 return {async advance(job,save){
  if(!/^[a-f0-9]{64}$/.test(job.digest))throw failure('invalid_proposal_digest',true);
  const review=await loadReview(job.file);if(review.digest!==job.digest)throw failure('proposal_changed',true);
  const root=path.resolve(dir,'publications',job.digest);await mkdir(root,{recursive:true});
  const source=path.join(root,'source'),integration=path.join(root,'integration'),release=path.join(root,'release'),branch='updater/'+job.digest.slice(0,24);
  if(job.phase==='prepare_source'){
   if(!job.sourceHead){
    // Only an isolated checkout owned by this exact publication is reset on recovery.
    if(!job.database_applied&&!automaticEligibility(review).eligible)throw failure('automatic_policy_no_longer_satisfied',true);
    await clone(SOURCE,source);
    if(!job.baseSource){job.baseSource=sha(await run('git',['rev-parse','origin/main'],source));await save(job);}
    await run('git',['fetch','origin',sha(job.baseSource)],source,120000);await run('git',['reset','--hard',job.baseSource],source);await run('git',['checkout','-B',branch,job.baseSource],source);
    // Refuse to mutate the database when the versioned export already conflicts.
    for(const c of review.artifact.changes){let file=exports[0];if(c.table==='kk_discoveries'){const category=(await sql(`select category from public.kk_discoveries where id='${c.record_id}'::uuid`))[0]?.category;if(!CATEGORIES.includes(category))throw failure('unknown_category',true);file='data/discovery/'+category+'.json';}const row=JSON.parse(await readFile(path.join(source,file))).find(r=>r.id===c.record_id);if(!row||row[c.field]!==c.before&&row[c.field]!==c.after)throw failure('baseline_editorial_conflict',true);}
    await approveProposal(job.file,job.digest,job.authorized_by);
    const applied=await applyProposal({file:job.file,sql,fetcher});job.database_applied=applied.catalog_changed===true;await save(job);
    if(!(applied.records||[]).some(r=>r.row.publication_status==='published')){
     await verifyPublication({file:job.file,sql,fetcher,verifyDeployment});return {phase:'verified',status:'verified',published:false};
    }
    await stagePublication({file:job.file,sql,directory:release,baselineDirectory:source});await installRelease(release,source);
    await run('npm',['ci','--ignore-scripts'],source,180000);await run('npm',['run','check'],source,600000);
    if(await run('git',['diff','--name-only','--',...exports],source)){
     await run('git',['add','--',...exports],source);await run('git',['commit','-m','Gecontroleerde Kunstkiezer-correctie '+job.digest],source);job.sourceHead=sha(await run('git',['rev-parse','HEAD'],source));await save(job);
    }else return {phase:'source_merged',sourceCommit:job.baseSource,status:'pending'};
   }
   await publishBranch(SOURCE,source,branch,job.sourceHead,job,save,'source');return {phase:'source_checks',status:'pending'};
  }
  if(job.phase==='source_checks'){
   if(!await workflow(SOURCE,job.sourceHead,'Controle'))return {};
   const commit=await merge(SOURCE,job.sourcePr,job.sourceHead);return {phase:'source_merged',sourceCommit:commit,status:'pending'};
  }
  if(job.phase==='source_merged'){
   if(!await workflow(SOURCE,job.sourceCommit,'Controle'))return {};
   return {phase:'prepare_integration',status:'pending'};
  }
  if(job.phase==='prepare_integration'){
   if(!job.integrationHead){
    await clone(SOURCE,source);await run('git',['fetch','origin',sha(job.sourceCommit)],source,120000);await run('git',['reset','--hard',job.sourceCommit],source);await run('git',['checkout','--detach',job.sourceCommit],source);
    await run('npm',['ci','--ignore-scripts'],source,180000);await run('npm',['run','build'],source,180000);
    await clone(INTEGRATION,integration);
    if(!job.baseIntegration){job.baseIntegration=sha(await run('git',['rev-parse','origin/main'],integration));await save(job);}
    await run('git',['fetch','origin',sha(job.baseIntegration)],integration,120000);await run('git',['reset','--hard',job.baseIntegration],integration);await run('git',['checkout','-B',branch,job.baseIntegration],integration);
    await run(process.execPath,['scripts/sync-loci.mjs',integration],source,30000);
    await run('npm',['ci','--ignore-scripts'],integration,180000);await run('npm',['run','check:release'],integration,600000);await run(process.execPath,['--test','tests/kunstkiezer-pages.test.mjs'],integration,60000);
    await run('git',['add','-A','--','kunstkiezer','kunstkiezer-functies','release-assets.json','KUNSTKIEZER-INTEGRATIE.md'],integration);await run('git',['commit','-m','Publiceer gecontroleerde Kunstkiezer-correctie '+job.digest],integration);job.integrationHead=sha(await run('git',['rev-parse','HEAD'],integration));await save(job);
   }
   await publishBranch(INTEGRATION,integration,branch,job.integrationHead,job,save,'integration');return {phase:'integration_checks',status:'pending'};
  }
  if(job.phase==='integration_checks'){
   if(!await workflow(INTEGRATION,job.integrationHead,'Controleer LOCI-publicatiepakket'))return {};
   const commit=await merge(INTEGRATION,job.integrationPr,job.integrationHead);return {phase:'deployment',integrationCommit:commit,status:'pending'};
  }
  if(job.phase==='deployment'){
   const id=await workflow(INTEGRATION,job.integrationCommit,'Controleer LOCI-publicatiepakket');if(!id)return {};
   const result=await verifyPublication({file:job.file,sql,fetcher,releaseDirectory:release,verifyDeployment,deployment:{run_id:id,source_commit:job.sourceCommit,integration_commit:job.integrationCommit}});
   for(const folder of [source,integration])await rm(path.join(folder,'node_modules'),{recursive:true,force:true}).catch(()=>{});
   return {phase:'verified',status:'verified',published:result.published,deployment_run:id};
  }
  throw failure('unknown_publication_phase',true);
 }};
}
