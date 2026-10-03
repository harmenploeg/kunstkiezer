import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankMuseum,validateMuseum,safeWebUrl,type InventoryMuseum} from '../packages/data/src/museums.ts';
import {onRequestGet} from '../functions/kunstkiezer/api/config.ts';
test('Publiceren vereist bezoekinformatie en veilige links',()=>{
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

test('Collectietekst telt woorden en weigert onveilige foto’s',()=>{
 assert.deepEqual(validateMuseum({...blankMuseum,name:'Kunst',summary:Array(80).fill('kunst').join(' ')}),[]);
 assert.ok(validateMuseum({...blankMuseum,name:'Kunst',summary:Array(81).fill('kunst').join(' ')}).length);
 assert.ok(validateMuseum({...blankMuseum,name:'Kunst',photos:[{url:'javascript:alert(1)',caption:'',credit:'',license:'',source_url:''}]}).length);
});

test('Kunstmuseumselectie is gevuld met korte teksten, tags en foto’s met herkomst',()=>{
 const rows=JSON.parse(readFileSync('data/museums/art-inventory.json','utf8')) as InventoryMuseum[];
 assert.equal(rows.length,30);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 for(const row of rows){assert.equal(row.is_art_museum,true);assert.ok(row.summary.trim());assert.ok(row.tags.length);assert.ok(row.photos.length);assert.deepEqual(validateMuseum(row),[]);for(const photo of row.photos){assert.ok(photo.credit);assert.ok(photo.license);assert.ok(safeWebUrl(photo.source_url));}}
});
