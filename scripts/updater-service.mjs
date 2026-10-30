import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFile} from 'node:fs/promises';
import {database,json,settings,tick,atomicJson} from './weekly-updater.mjs';
import {automaticPublicationTick,publicationInProgress} from './automatic-publication.mjs';
import {ROOT,PROJECT,managementToken,oldAutomationActive,readiness} from './updater-readiness.mjs';
const dir=process.env.KUNSTKIEZER_UPDATER_STATE||path.join(ROOT,'.local-updater');
const exec=promisify(execFile);
async function record(result){
 await atomicJson(path.join(dir,'last-status.json'),{...result,checked_at:new Date().toISOString()});
 const actionable=['proposal_ready','failed','not_ready','service_error','publication_blocked','automatically_published','automatically_processed'].includes(result.status);
 if(!actionable)return;
 const state=await json(path.join(dir,'weekly-state.json'),{sources:{}});
 const proposals=Object.entries(state.sources).filter(([,s])=>s.proposal_file);
 const failures=Object.entries(state.sources).filter(([,s])=>s.error_code).map(([id,s])=>`- ${id}: ${s.error_code}; ${s.retryable===false?'geen nieuwe poging in deze ronde':'herhaling begrensd'}`);
 await writeFile(path.join(dir,'laatste-voorstellen.md'),['# Kunstkiezer: laatste voorstelronde','',`Status: ${result.status}`,`Tijd: ${new Date().toISOString()}`,'','Dit zijn voorstelbestanden. De actuele automatische verwerking staat in laatste-publicatie.md.','',...proposals.map(([id,s])=>`- ${id}: ${s.proposal_file}`),'','Bronnen met een beperking:',...failures,'','Tokenreserveringen zijn geen bewezen werkelijk gebruik. Zie modelOutcome in het partijrapport voor gemeten tokens, AI-aanroepen en geschatte reserveringen.','',result.blockers?.length?`Controleer verbinding/toegang: ${result.blockers.join(', ')}. Vernieuw zo nodig het Supabase-token in de Sleutelhanger.`:'Bekijk de voorstellen met npm run updater:proposal -- review <bestand>.'].join('\n')+'\n',{mode:0o600});
 const prior=await json(path.join(dir,'notification.json'),{}),key=result.status+':'+(state.cycle||'');
 if(prior.key===key&&Date.now()-Date.parse(prior.at)<86400000)return;
 const message=result.status==='automatically_published'?'Gecontroleerde correcties zijn live gepubliceerd.':result.status==='proposal_ready'?'Nieuwe voorstellen staan klaar voor beoordeling.':'De updater heeft aandacht nodig. Bekijk de lokale statusverslagen.';
 try{await exec('/usr/bin/osascript',['-e','on run argv\ndisplay notification (item 1 of argv) with title "Kunstkiezer"\nend run',message],{timeout:10000});await atomicJson(path.join(dir,'notification.json'),{key,at:new Date().toISOString()});}catch{}
}
try{
 const activation=await json(path.join(dir,'activation.json'),{enabled:false});
 let result;
 if(activation.enabled!==true)result={status:'not_activated'};
 else if(await oldAutomationActive())result={status:'not_ready',blockers:['oldAutomationActive']};
 else{
  const token=await managementToken(),sql=database(token,process.env.KUNSTKIEZER_PROJECT_REF||PROJECT);
  if(activation.automatic_publication?.enabled===true&&await publicationInProgress(dir))result={status:'publication_in_progress'};
  else{
   const report=await readiness({token});
   if(!report.readyForLiveTrial)result={status:'not_ready',blockers:report.blockers};
   else{const config=settings(await json(path.join(ROOT,'data/curation/updater-config.json'),{}));result=await tick({sql,config,dir});}
  }
  if(activation.automatic_publication?.enabled===true){
   const publication=await automaticPublicationTick({dir,sql});await atomicJson(path.join(dir,'last-publication-status.json'),{...publication,checked_at:new Date().toISOString()});
   const state=await json(path.join(dir,'automatic-publication.json'),{});
   await writeFile(path.join(dir,'laatste-publicatie.md'),['# Automatische Kunstkiezer-verwerking','',`Status: ${publication.status}`,`Stap: ${publication.phase||'geen actieve publicatie'}`,'',`Voorstel: ${state.job?.file||'geen feitelijke correcties beschikbaar'}`,`Blokkade: ${publication.reason||'geen'}`,'','Alleen ondersteunde feitelijke correcties uit primaire bronnen gaan automatisch door. Nieuwe kandidaten, vrije tekst en conflicten blijven ter beoordeling. Succes wordt pas na gecontroleerde uitrol en liveverificatie bevestigd.'].join('\n')+'\n',{mode:0o600});
   result.publication=publication;
   if(['publication_blocked','automatically_published','automatically_processed','publication_in_progress'].includes(publication.status))result.status=publication.status;
  }
 }
 await record(result);console.log(JSON.stringify(result));
 if(result.status==='not_ready')process.exitCode=1;
}catch{await record({status:'service_error',blockers:['connection_or_runner_failure']});console.error('Voorstelrunner gestopt; controleer de lokale status en Supabase-toegang.');process.exitCode=1;}
