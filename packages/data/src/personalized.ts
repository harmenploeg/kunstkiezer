import {rankRecommendations,defaultRanking,type Coordinates,type LocatedItem,type RankingSettings} from '../../domain/src/ranking.ts';
/** Fetch every matching page before ranking, so a match cannot get stuck on a later page. */
export async function personalizedPage<T extends LocatedItem & {tags:string[]}>(fetchBatch:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>,preferences:string[],page:number,pageSize:number,origin:Coordinates|null=null,settings:RankingSettings=defaultRanking){
 const rows:T[]=[];const batchSize=500;
 for(let from=0;;from+=batchSize){const result=await fetchBatch(from,from+batchSize-1);if(result.error)throw Error('De gegevens konden niet worden geladen. Probeer opnieuw.');const batch=result.data??[];rows.push(...batch);if(batch.length<batchSize)break;}
 return {rows:rankRecommendations(rows,preferences,origin,settings).slice(page*pageSize,(page+1)*pageSize),total:rows.length};
}
