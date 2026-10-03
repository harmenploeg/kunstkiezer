import {defaultRanking,type Coordinates,type RankingSettings} from '../../domain/src/ranking.ts';
import {personalizedPage} from './personalized.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
import {amsterdamDay,monthAhead,type DiscoveryCategory,type DiscoveryItem,type DiscoveryInput} from './discovery.ts';
export async function listDiscoveries(c:SupabaseClient,category:DiscoveryCategory,search='',province='',tag='',editor=false,page=0,preferences:string[]=[],origin:Coordinates|null=null,settings:RankingSettings=defaultRanking){
 let q=c.from('kk_discoveries').select('*',{count:'exact'}).eq('category',category).order(category==='evenementen'&&!editor?'starts_on':'name').order('id');
 if(!editor){q=q.eq('publication_status','published');if(category==='evenementen'){const day=amsterdamDay();q=q.gte('ends_on',day).lte('starts_on',monthAhead(day));}}
 const needle=search.trim().replace(/[\\%_,().]/g,' ').slice(0,120);if(needle)q=q.or(`name.ilike.%${needle}%,city.ilike.%${needle}%,creator.ilike.%${needle}%`);
 if(province)q=q.eq('province',province);if(tag.trim())q=q.contains('tags',[tag.trim().toLowerCase()]);
 if(!editor&&(preferences.length||origin))return personalizedPage<DiscoveryItem>((from,to)=>q.range(from,to),preferences,page,30,origin,settings);
 const {data,error,count}=await q.range(page*30,page*30+29);if(error)throw Error('De gegevens konden niet worden geladen. Probeer opnieuw.');return {rows:(data??[]) as DiscoveryItem[],total:count??0};
}
export async function saveDiscovery(c:SupabaseClient,input:DiscoveryInput,existing:DiscoveryItem|null,notes:string){const {data,error}=await c.rpc('kk_save_discovery',{payload:input,discovery_id:existing?.id??null,expected_updated_at:existing?.updated_at??null,editorial_notes:notes}).single();if(error?.code==='40001')throw Error('Deze vermelding is ondertussen gewijzigd. Open haar opnieuw voordat je opslaat.');if(error||!data)throw Error('Opslaan mislukt. Controleer je rechten en de ingevulde velden.');return data as DiscoveryItem;}
