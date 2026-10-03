import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distanceKm,validCoordinates,defaultRanking,recommendationScore,rankRecommendations,coordinateErrors} from '../packages/domain/src/ranking.ts';
import {personalizedPage} from '../packages/data/src/personalized.ts';
const origin={latitude:52,longitude:5},tags=['a','b','c','d','e','f'];
const near={name:'Dichtbij',latitude:52.089932,longitude:5,tags:['a']},far={name:'Ver weg',latitude:54.2483,longitude:5,tags};
test('Afstand is hemelsbreed; ontbrekende of ongeldige punten tellen niet als nul kilometer',()=>{
 assert.equal(distanceKm(origin,origin),0);assert.ok(Math.abs(distanceKm(origin,near)-10)<.001);
 assert.equal(validCoordinates({latitude:null,longitude:null}),false);assert.equal(validCoordinates({latitude:NaN,longitude:5}),false);
 assert.equal(validCoordinates({latitude:91,longitude:5}),false);assert.ok(coordinateErrors({latitude:52,longitude:null}).longitude);
 assert.equal(recommendationScore(0,6,null,defaultRanking),0);
});
test('10 km met één tag wint van 250 km met zes tags; beheerder kan de balans veranderen',()=>{
 assert.deepEqual(rankRecommendations([far,near],tags,origin).map(x=>x.name),['Dichtbij','Ver weg']);
 assert.deepEqual(rankRecommendations([far,near],tags,origin,{...defaultRanking,distance_weight:10,tag_weight:90}).map(x=>x.name),['Ver weg','Dichtbij']);
 assert.deepEqual(rankRecommendations([far,near],tags,null).map(x=>x.name),['Ver weg','Dichtbij']);
 assert.deepEqual(rankRecommendations([far,near],[],origin).map(x=>x.name),['Dichtbij','Ver weg']);
 assert.deepEqual(rankRecommendations([near,far],tags,origin,{...defaultRanking,distance_weight:0,tag_weight:100}).map(x=>x.name),['Ver weg','Dichtbij']);
 assert.equal(recommendationScore(1,6,10,defaultRanking),57.5);
});
test('Gecombineerde volgorde sorteert alle resultaten voordat er pagina’s worden gemaakt',async()=>{
 const all=[...Array.from({length:500},(_,i)=>({...far,name:`Ver ${i}`})),near];
 const result=await personalizedPage(async(from,to)=>({data:all.slice(from,to+1),error:null}),tags,0,30,origin);
 assert.equal(result.total,501);assert.equal(result.rows[0]?.name,'Dichtbij');assert.equal(result.rows.length,30);
});
