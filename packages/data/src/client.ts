import {personalizedPage} from './personalized.ts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readPublicConfiguration } from '../../config/src/index.ts';
import type { Museum, MuseumInput, MuseumSource, Editorial } from './museums.ts';
let clientPromise: Promise<SupabaseClient> | undefined;
export function getClient(): Promise<SupabaseClient> {
 return clientPromise ??= (async()=>{
  const response=await fetch('/kunstkiezer/api/config', {cache:'no-store'});
  if(!response.ok) throw new Error('De museumdatabase is nog niet aangesloten.');
  const values=await response.json() as Record<string,string>;
  const config=readPublicConfiguration(values);
  return createClient(config.supabaseUrl,config.supabasePublishableKey);
 })().catch(error=>{clientPromise=undefined;throw error;});
}
export async function listMuseums(client: SupabaseClient, search: string, province: string, editor=false, page=0, preferences:string[]=[]): Promise<{ rows: Museum[]; total: number }> {
 let query=client.from('kk_museums').select('*',{count:'exact'}).eq('is_art_museum',true).order('name').order('id');
 if(!editor) query=query.eq('publication_status','published');
 if(province) query=query.eq('province',province);
 // Escape wildcards and PostgREST filter delimiters; never interpolate raw OR syntax.
 const needle=search.trim().replace(/[\\%_,().]/g,' ').slice(0,150);
 if(needle) query=query.ilike('name',`%${needle}%`);
 if(!editor&&preferences.length)return personalizedPage<Museum>((from,to)=>query.range(from,to),preferences,page,50);
 const {data,error,count}=await query.range(page*50,page*50+49);
 if(error) throw new Error('Museumgegevens konden niet worden geladen.');
 return {rows:(data??[]) as Museum[],total:count??0};
}
export async function getMuseumExtras(client: SupabaseClient,id: string): Promise<{sources: MuseumSource[];editorial: Editorial}> {
 const [sources,editorial]=await Promise.all([
  client.from('kk_museum_sources').select('provider,url,retrieved_at,evidence_fields').eq('museum_id',id),
  client.from('kk_museum_editorial').select('review_notes,suggested_tags').eq('museum_id',id).maybeSingle()
 ]);
 if(sources.error||editorial.error) throw new Error('Bronnen en redactionele gegevens konden niet worden geladen.');
 return {sources:(sources.data??[]) as MuseumSource[],editorial:(editorial.data??{review_notes:'',suggested_tags:[]}) as Editorial};
}
export async function saveMuseum(client: SupabaseClient,input: MuseumInput, existing: Museum | null, notes: string): Promise<Museum> {
 const {data,error}=await client.rpc('kk_save_museum',{
  payload:input,museum_id:existing?.id??null,expected_updated_at:existing?.updated_at??null,editorial_notes:notes
 }).single();
 if(error?.code==='40001') throw new Error('Dit museum is ondertussen gewijzigd. Laad het opnieuw voordat je opslaat.');
 if(error||!data) throw new Error('Opslaan is niet gelukt. Controleer je bewerkrechten en de publicatievoorwaarden.');
 return data as Museum;
}
