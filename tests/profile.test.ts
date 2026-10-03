import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseProfile,rankByTaste,matchingTags,preferenceQuestions} from '../packages/domain/src/profile.ts';
import {catalogueTags} from '../packages/domain/src/catalogue-tags.ts';
import {personalizedPage} from '../packages/data/src/personalized.ts';
test('Profiel normaliseert tags, behoudt bewust lege voorkeuren en herstelt ongeldige opslag',()=>{
 assert.equal(parseProfile('{invalid').completed,false);assert.equal(parseProfile('{"version":2,"completed":true,"tags":[]}').completed,false);
 assert.deepEqual(parseProfile(JSON.stringify({version:1,completed:true,tags:[' Fotografie ','fotografie',12,'De Stijl']})),{version:1,completed:true,tags:['fotografie','de stijl']});
 assert.equal(parseProfile('{"version":1,"completed":true,"tags":[]}').completed,true);
});
test('Elke onboardingkeuze verwijst naar bestaande tags en voorkeuren verbergen geen resultaten',()=>{
 for(const q of preferenceQuestions)for(const o of q.options)for(const t of o.tags)assert.ok(catalogueTags.includes(t),t);
 const rows=[{id:1,tags:['schilderkunst']},{id:2,tags:['Fotografie','fotografie']},{id:3,tags:['fotografie','de stijl']},{id:4,tags:['fotografie']}];
 assert.deepEqual(rankByTaste(rows,['fotografie','De Stijl']).map(r=>r.id),[3,2,4,1]);assert.deepEqual(rankByTaste(rows,[]),rows);
 assert.deepEqual(matchingTags(['Fotografie','fotografie'],['FOTOGRAFIE']),['fotografie']);assert.equal(rows[0]!.id,1);
});
test('Beste match uit een latere databasepagina komt vóór paginering naar voren',async()=>{
 const rows=Array.from({length:1002},(_,i)=>({id:i,tags:i===1001?['fotografie']:['schilderkunst']}));const ranges:number[]=[];
 const fetch=async(from:number,to:number)=>{ranges.push(from);return {data:rows.slice(from,to+1),error:null};};
 const first=await personalizedPage(fetch,['fotografie'],0,30);assert.equal(first.total,1002);assert.equal(first.rows[0]!.id,1001);assert.deepEqual(ranges,[0,500,1000]);
 const second=await personalizedPage(fetch,['fotografie'],1,30);assert.equal(second.rows[0]!.id,29);assert.ok(!second.rows.some(r=>first.rows.some(x=>x.id===r.id)));
 await assert.rejects(personalizedPage(async()=>({data:null,error:'connection failed'}),['fotografie'],0,30));
});
