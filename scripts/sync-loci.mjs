// Zet een Kunstkiezer-build klaar in harmenploeg/interactief. Sinds systeemaudit
// stap 1.3 (oktober 2026) is de Kunstkiezer een eigen Pages-project,
// loci-kunstkiezer, op kunstkiezer.loci-amsterdam.nl (ook bereikbaar als
// loci-kunstkiezer.pages.dev). De Loci-workflow publiceert
// het als derde project naast de app en de leespagina's:
//   kunstkiezer/           de statische build, aan de wortel van het domein
//   kunstkiezer-functies/  de Pages Functions van dat project
// Beide staan in release-assets.json onder kunstkiezerFiles, los van de app.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const destination=process.argv[2];
if(!destination)throw Error('Gebruik: node scripts/sync-loci.mjs /pad/naar/interactief');
const root=path.resolve(destination),manifestPath=path.join(root,'release-assets.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!fs.existsSync('apps/web/dist/index.html'))throw Error('Voer eerst npm run build uit.');
const oud=[...(manifest.kunstkiezerFiles||[]),...manifest.publicFiles.filter(f=>f.startsWith('kunstkiezer/'))];
for(const file of oud){if(file.includes('..'))throw Error('Ongeldig manifestpad');fs.rmSync(path.join(root,file),{force:true});}
fs.cpSync('apps/web/dist',path.join(root,'kunstkiezer'),{recursive:true});
const functies=path.join(root,'kunstkiezer-functies');
fs.mkdirSync(path.join(functies,'api'),{recursive:true});
fs.copyFileSync('functions/[[path]].js',path.join(functies,'[[path]].js'));
fs.copyFileSync('functions/api/basemap-config.js',path.join(functies,'api/basemap-config.js'));
// Only a public browser key belongs here. RLS and editor authorization remain in Supabase.
fs.writeFileSync(path.join(functies,'api/config.js'),`export function onRequestGet(){return Response.json({APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://qrlfywcqkkzmerglmsbj.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_agkPufxM70sOqgCPv_wEmg_1R99OdEU'},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}\n`);
fs.writeFileSync(path.join(root,'kunstkiezer/version.json'),JSON.stringify({repository:'harmenploeg/kunstkiezer',commit:sourceCommit},null,2)+'\n');
// Inventory only files from this build; unrelated local files in the destination stay private.
const walk=(dir,relative='')=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),`${relative}${e.name}/`):[`${relative}${e.name}`]);
const builtFiles=walk('apps/web/dist').map(f=>`kunstkiezer/${f}`);
manifest.publicFiles=manifest.publicFiles.filter(f=>!f.startsWith('kunstkiezer/')&&!f.startsWith('functions/kunstkiezer/api/'));
manifest.kunstkiezerFiles=[...new Set([...builtFiles,'kunstkiezer/version.json'])].sort().concat(['kunstkiezer-functies/[[path]].js','kunstkiezer-functies/api/basemap-config.js','kunstkiezer-functies/api/config.js']);
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'KUNSTKIEZER-INTEGRATIE.md'),`# Kunstkiezer op een eigen subdomein\n\nBron: harmenploeg/kunstkiezer, revisie ${sourceCommit}.\n\nDe Kunstkiezer staat op https://kunstkiezer.loci-amsterdam.nl/, als eigen Cloudflare Pages-project \`loci-kunstkiezer\` (ook bereikbaar als https://loci-kunstkiezer.pages.dev/). Hij komt uit deze Loci-repository: \`kunstkiezer/\` is de statische build, \`kunstkiezer-functies/\` zijn de Pages Functions van dat project. Beide staan in \`release-assets.json\` onder \`kunstkiezerFiles\` en gaan niet mee in de app. De afzonderlijke kunstkiezer.pages.dev-site is uitsluitend een preview.\n\nVoor iedere volgende uitgave: bouw en test de bronrepository, voer daar \`node scripts/sync-loci.mjs /pad/naar/interactief\` uit, controleer en commit de gewijzigde bestanden hier. De quality.yml- en deploy-checked.yml-keten test het pakket en publiceert de Kunstkiezer vóór de app. De bronrevisie staat publiek in /version.json en wordt na de uitrol gecontroleerd.\n\nOp het appdomein verwijst \`www.loci-amsterdam.nl/kunstkiezer/…\` met een 301 door naar hetzelfde pad op het eigen domein (\`functions/kunstkiezer/[[path]].js\`). Daar draait geen Kunstkiezer-code meer, dus ook geen script met de rechten van een aangemelde Loci-gebruiker. Alleen de publieke Supabase-browserconfiguratie wordt meegeleverd; redactierechten blijven beschermd door Supabase. De kaartsleutel staat als geheim \`LOCI_CARTO_BASEMAP_KEY\` op het Pages-project \`loci-kunstkiezer\`.\n`);
console.log(`Kunstkiezer ${sourceCommit} gesynchroniseerd naar ${root}; controleer en publiceer via de Loci-workflow.`);
