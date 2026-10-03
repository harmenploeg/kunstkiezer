import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoveryCategories,amsterdamDay,monthAhead,inAgenda,validateDiscovery,blankDiscovery,type DiscoveryItem} from '../packages/data/src/discovery.ts';
import {isPagePath,categories} from '../packages/domain/src/navigation.ts';
test('Agenda gebruikt Amsterdam, één kalendermaand en inclusieve begin- en einddatums',()=>{
 assert.equal(amsterdamDay(new Date('2026-10-03T22:30:00Z')),'2026-10-04');
 assert.equal(monthAhead('2026-01-31'),'2026-02-28');assert.equal(monthAhead('2028-01-31'),'2028-02-29');assert.equal(monthAhead('2026-12-31'),'2027-01-31');
 for(const [start,end,expected] of [['2026-01-01','2026-10-03',true],['2026-11-03','2026-12-01',true],['2026-11-04','2026-12-01',false],['2026-01-01','2026-10-02',false]] as const)assert.equal(inAgenda({starts_on:start,ends_on:end},'2026-10-03'),expected);
 assert.equal(inAgenda({starts_on:null,ends_on:'2026-12-01'},'2026-10-03'),false);
});
test('Vier collectiebestanden hebben unieke IDs, bronverantwoording, tags en geldige publicatiegegevens',()=>{
 const ids=new Set<string>();const museums=new Set(JSON.parse(readFileSync('data/museums/art-inventory.json','utf8')).map((m:{id:string})=>m.id));
 for(const c of discoveryCategories){const rows:DiscoveryItem[]=JSON.parse(readFileSync(`data/discovery/${c}.json`,'utf8'));assert.ok(rows.length>=15,c);
  for(const r of rows){assert.equal(r.category,c);assert.ok(!ids.has(r.id),r.name);ids.add(r.id);assert.ok(r.inventory_key);assert.ok(r.sources.length,r.name);assert.ok(r.tags.length>=2,r.name);assert.ok(r.selection_reason.trim(),r.name);assert.deepEqual(validateDiscovery(r),{},r.name);if(r.museum_id)assert.ok(museums.has(r.museum_id),r.name);}
 }
 const publicArt:DiscoveryItem[]=JSON.parse(readFileSync('data/discovery/openbare-kunst.json','utf8'));assert.equal(publicArt.filter(r=>r.inventory_key?.startsWith('sleutelwerk:')).length,100);assert.ok(publicArt.length<=1000);
});
test('Vijfde keuze en afzonderlijke beheerroutes zijn echte paginaroutes',()=>{
 assert.equal(categories.length,5);assert.equal(isPagePath('/beheer'),true);
 for(const c of categories){assert.equal(isPagePath(`/agenda/${c.id}`),true);assert.equal(isPagePath(`/beheer/${c.id}`),true);}
 assert.equal(isPagePath('/beheer/onbekend'),false);
});
test('Publicatievalidatie wijst elk ontbrekend veld aan en status is standaard open',()=>{
 const r=blankDiscovery('evenementen');assert.equal(r.operating_status,'open');r.publication_status='published';
 const errors=validateDiscovery(r);for(const k of ['name','summary','tags','sources','selection_reason','starts_on','ends_on'])assert.ok(errors[k],k);
 r.starts_on='2026-10-10';r.ends_on='2026-10-09';assert.ok(validateDiscovery(r).ends_on);
});
