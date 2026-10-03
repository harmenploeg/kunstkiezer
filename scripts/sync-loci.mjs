import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const destination=process.argv[2];
if(!destination)throw Error('Gebruik: node scripts/sync-loci.mjs /pad/naar/interactief');
const root=path.resolve(destination),manifestPath=path.join(root,'release-assets.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!fs.existsSync('apps/web/dist/index.html'))throw Error('Voer eerst npm run build uit.');
for(const file of manifest.publicFiles.filter(f=>f.startsWith('kunstkiezer/'))){if(file.includes('..'))throw Error('Ongeldig manifestpad');fs.rmSync(path.join(root,file),{force:true});}
fs.cpSync('apps/web/dist',path.join(root,'kunstkiezer'),{recursive:true});
fs.mkdirSync(path.join(root,'functions/kunstkiezer/api'),{recursive:true});
let route=fs.readFileSync('functions/kunstkiezer/[[path]].js','utf8');
route=route.replace("'/inventory.json'","'/version.json','/inventory.json'");
fs.writeFileSync(path.join(root,'functions/kunstkiezer/[[path]].js'),route);
// Only a public browser key belongs here. RLS and editor authorization remain in Supabase.
fs.writeFileSync(path.join(root,'functions/kunstkiezer/api/config.js'),`export function onRequestGet(){return Response.json({APP_ENV:'production',PUBLIC_SUPABASE_URL:'https://qrlfywcqkkzmerglmsbj.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_agkPufxM70sOqgCPv_wEmg_1R99OdEU'},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}\n`);
fs.writeFileSync(path.join(root,'kunstkiezer/version.json'),JSON.stringify({repository:'harmenploeg/kunstkiezer',commit:sourceCommit},null,2)+'\n');
const walk=(dir)=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
manifest.publicFiles=[...manifest.publicFiles.filter(f=>!f.startsWith('kunstkiezer/')&&!f.startsWith('functions/kunstkiezer/')),...walk('kunstkiezer').sort(),...walk('functions/kunstkiezer').sort()];
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(root,'KUNSTKIEZER-INTEGRATIE.md'),`# Kunstkiezer op het productiedomein\n\nBron: harmenploeg/kunstkiezer, revisie ${sourceCommit}.\n\nDe productie op https://www.loci-amsterdam.nl/kunstkiezer/ komt uit deze Loci-repository. De afzonderlijke kunstkiezer.pages.dev-site is uitsluitend een preview; die bijwerken publiceert niets op Loci.\n\nVoor iedere volgende uitgave: bouw en test de bronrepository, voer daar \`node scripts/sync-loci.mjs /pad/naar/interactief\` uit, controleer en commit de gewijzigde bestanden hier. De bestaande quality.yml- en deploy-checked.yml-keten test en publiceert het volledige gecontroleerde pakket. De bronrevisie staat publiek in kunstkiezer/version.json en wordt na deployment gecontroleerd.\n\nDe Kunstkiezer-map, Functions en het releasemanifest worden samen bijgewerkt. Alleen de publieke Supabase-browserconfiguratie wordt meegeleverd; redactierechten blijven beschermd door Supabase. De bestaande Loci-middleware, Cloudflare Access, onderhoudsstand en serviceworker-uitsluiting blijven van toepassing.\n`);
console.log(`Kunstkiezer ${sourceCommit} gesynchroniseerd naar ${root}; controleer en publiceer via de Loci-workflow.`);
