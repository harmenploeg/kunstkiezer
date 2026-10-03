import {copyFileSync,mkdirSync} from 'node:fs';
mkdirSync('apps/web/dist',{recursive:true});
for(const [source,target] of [['inventory.json','inventory.json'],['art-inventory.json','art-inventory.json'],['inventory.csv','inventory.csv'],['report.json','inventory-report.json']]){
 copyFileSync(`data/museums/${source}`,`apps/web/dist/${target}`);
}

for(const category of ['openbare-kunst','beeldenparken','architectuur','evenementen']) copyFileSync(`data/discovery/${category}.json`,`apps/web/dist/${category}.json`);
