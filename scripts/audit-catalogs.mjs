import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {amsterdamDay,monthAhead,inAgenda} from '../packages/data/src/discovery.ts';
const date=process.argv[2]??amsterdamDay(new Date());
if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Gebruik YYYY-MM-DD');
const paths={musea:'data/museums/art-inventory.json',...Object.fromEntries(['openbare-kunst','beeldenparken','architectuur','evenementen'].map(c=>[c,`data/discovery/${c}.json`]))};
const categories={},remaining=[];let total=0;
for(const [category,path] of Object.entries(paths)){
 const rows=JSON.parse(readFileSync(path,'utf8')),published=rows.filter(r=>r.publication_status==='published');total+=rows.length;
 categories[category]={total:rows.length,published:published.length,archived:rows.filter(r=>r.publication_status==='archived').length,draft:rows.filter(r=>r.publication_status==='draft').length,with_photos:published.filter(r=>r.photos?.length).length,precise_locations:published.filter(r=>['exact','address'].includes(r.coordinate_precision)).length,visible_on_research_date:published.filter(r=>r.operating_status==='open'&&(category!=='evenementen'||inAgenda(r,date))).length};
 for(const r of published){
  const issues=[];
  if(!r.photos?.length)issues.push('Foto met bevestigde maker, bron en hergebruikvoorwaarden ontbreekt');
  if(!['exact','address'].includes(r.coordinate_precision))issues.push(`Locatie: ${r.coordinate_precision??'unknown'}; exacte bezoekplek bevestigen of verspreid/historisch karakter toelichten`);
  if(r.operating_status!=='open')issues.push(`Bezoekstatus: ${r.operating_status}; opnieuw bij officiële bron controleren`);
  if(!r.website_url)issues.push('Officiële website ontbreekt');
  if(issues.length)remaining.push({id:r.id,inventory_key:r.inventory_key,category,name:r.name,website_url:r.website_url,issues});
 }
}
mkdirSync('data/curation',{recursive:true});
const report={research_date:date,agenda_window_end:monthAhead(date),scope:'Gecontroleerde catalogusmomentopname; geen claim dat elk Nederlands kunstaanbod of alle foto- en locatievragen zijn afgerond.',categories,total,remaining_records:remaining.length,remaining};
writeFileSync('data/curation/latest-report.json',JSON.stringify(report,null,2)+'\n');
writeFileSync('data/discovery/report.json',JSON.stringify({...report,categories:Object.fromEntries(Object.entries(categories).filter(([c])=>c!=='musea')),total:total-categories.musea.total,remaining:remaining.filter(r=>r.category!=='musea')},null,2)+'\n');
console.log(JSON.stringify({research_date:date,categories,remaining_records:remaining.length},null,2));
