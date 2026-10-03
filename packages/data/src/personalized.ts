import {rankByTaste} from '../../domain/src/profile.ts';
/** Fetch every matching page before ranking, so a match cannot get stuck on a later page. */
export async function personalizedPage<T extends {tags:string[]}>(fetchBatch:(from:number,to:number)=>PromiseLike<{data:T[]|null;error:unknown}>,preferences:string[],page:number,pageSize:number){
 const rows:T[]=[];const batchSize=500;
 for(let from=0;;from+=batchSize){const result=await fetchBatch(from,from+batchSize-1);if(result.error)throw Error('De gegevens konden niet worden geladen. Probeer opnieuw.');const batch=result.data??[];rows.push(...batch);if(batch.length<batchSize)break;}
 return {rows:rankByTaste(rows,preferences).slice(page*pageSize,(page+1)*pageSize),total:rows.length};
}
