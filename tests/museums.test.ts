import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankMuseum,validateMuseum,safeWebUrl,type InventoryMuseum} from '../packages/data/src/museums.ts';
import {onRequestGet} from '../functions/kunstkiezer/api/config.ts';
test('Publiceren vereist gecontroleerde bezoekinformatie en veilige links',()=>{
 assert.ok(validateMuseum({...blankMuseum,name:'Museum',publication_status:'published'}).length>0);
 assert.equal(validateMuseum({...blankMuseum,name:'Museum',city:'Utrecht',street_address:'Teststraat 1',publication_status:'published',verification_status:'verified',operating_status:'open'}).length,0);
 assert.ok(validateMuseum({...blankMuseum,name:'Museum',latitude:52,longitude:null}).length>0);
 assert.equal(safeWebUrl('javascript:alert(1)'),null);
 assert.equal(safeWebUrl('https://user:password@example.test'),null);
});
test('Config geeft uitsluitend publieke sleutel door en weigert serverkeys',async()=>{
 assert.equal(onRequestGet({env:{}}).status,503);
 assert.equal(onRequestGet({env:{PUBLIC_SUPABASE_URL:'https://example.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_bad'}}).status,503);
 const response=onRequestGet({env:{PUBLIC_SUPABASE_URL:'https://example.supabase.co',PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'}});
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.equal(Object.keys(await response.json()).length,3);
});
test('Inventaris bevat echte bronnen, unieke sleutels en begint volledig als concept',()=>{
 const rows=JSON.parse(readFileSync('data/museums/inventory.json','utf8')) as InventoryMuseum[];
 assert.ok(rows.length>1000);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 assert.ok(rows.filter(r=>r.sources.some(s=>s.provider==='Museum.nl')).length>500);
 assert.ok(rows.some(r=>r.name==='Rijksmuseum Amsterdam'&&r.street_address==='Museumstraat 1'));
 for(const row of rows){assert.equal(row.publication_status,'draft');assert.ok(row.sources.length);assert.deepEqual(validateMuseum(row),[]);}
});
