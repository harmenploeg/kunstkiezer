import path from 'node:path';
import os from 'node:os';
import {writeFile} from 'node:fs/promises';
import {loadReview,approveProposal,applyProposal,stagePublication,verifyPublication,installRelease} from './proposal-processing.mjs';
import {managementToken,PROJECT} from './updater-readiness.mjs';
import {database} from './weekly-updater.mjs';
const [command,file,...args]=process.argv.slice(2),option=key=>{const index=args.indexOf(key);return index<0?null:args[index+1];};
async function main(){
 if(!file||!['review','approve','apply','stage','verify','install-release'].includes(command))throw new Error('Gebruik: process-proposal.mjs review|approve|apply|stage|install-release|verify voorstel.json');
 const review=await loadReview(file);
 if(command==='review'){
  const lines=['# Voorstel ter goedkeuring','',`Bron: ${review.bundle.source.name}`,`Vingerafdruk: ${review.digest}`,'',review.artifact.summary,''];
  for(const c of review.artifact.changes)lines.push(`## ${c.table} / ${c.record_id} / ${c.field}`,'','Oude en voorgestelde waarde:','```json',JSON.stringify({before:c.before,after:c.after,expected_updated_at:c.expected_updated_at},null,2),'```','',`Bewijs: ${c.evidence_url}`,`Citaat: ${JSON.stringify(c.evidence_quote)}`,'');
  if(!review.changes)lines.push('Geen veldwijzigingen voorgesteld.');
  lines.push('',`${review.candidates} nieuwe kandidaten; deze worden niet automatisch toegevoegd.`,'','Goedkeuring geldt uitsluitend voor deze exacte inhoud en het bijbehorende bronpakket.');
  const report=file+'.review.md';await writeFile(report,lines.join('\n')+'\n',{mode:0o600});console.log(JSON.stringify({report,digest:review.digest,changes:review.changes,candidates:review.candidates}));return;
 }
 if(command==='approve'){console.log(JSON.stringify(await approveProposal(file,option('--digest'),os.userInfo().username)));return;}
 const sql=database(await managementToken(),PROJECT);
 if(command==='apply'){console.log(JSON.stringify(await applyProposal({file,sql}),null,2));return;}
 const directory=option('--release-dir')||path.join(path.dirname(path.resolve(file)),'release-'+review.digest.slice(0,12));
 if(command==='install-release'){const checkout=option('--checkout');if(!checkout)throw new Error('--checkout is vereist');console.log(JSON.stringify(await installRelease(directory,checkout)));return;}
 if(command==='stage'){console.log(JSON.stringify(await stagePublication({file,sql,directory}),null,2));return;}
 const deployment={run_id:option('--workflow-run'),source_commit:option('--source-commit'),integration_commit:option('--integration-commit')};
 console.log(JSON.stringify(await verifyPublication({file,sql,releaseDirectory:directory,deployment}),null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
