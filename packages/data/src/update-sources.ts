import type {SupabaseClient} from '@supabase/supabase-js';
export type UpdateSourceInput={name:string;url:string;notes:string;enabled:boolean};
export type UpdateSource=UpdateSourceInput & {id:string;updated_at:string};
export function validSource(value:UpdateSourceInput):boolean{
 if(!value.name.trim()||value.name.trim().length>150||value.notes.length>8000||value.url.length>2000)return false;
 if(!value.url.trim())return Boolean(value.notes.trim());
 try{const u=new URL(value.url);return ['https:','http:'].includes(u.protocol)&&Boolean(u.hostname)&&!u.username&&!u.password;}catch{return false;}
}
function sourceError(code?:string):Error{return Error(code==='40001'?'Deze bron is ondertussen gewijzigd of verwijderd. Herlaad de bronnenlijst voordat je verdergaat.':'De wijziging kon niet worden opgeslagen. Controleer je verbinding en redactierechten.');}
export async function listUpdateSources(c:SupabaseClient):Promise<UpdateSource[]>{const {data,error}=await c.from('kk_update_sources').select('id,name,url,notes,enabled,updated_at').order('name');if(error)throw Error('De bronnen konden niet worden geladen. Probeer opnieuw.');return data as UpdateSource[];}
export async function saveUpdateSource(c:SupabaseClient,value:UpdateSourceInput,existing:UpdateSource|null):Promise<UpdateSource>{
 if(!validSource(value))throw Error('Vul een naam en een geldig webadres of zoekinstructie in.');
 const {data,error}=await c.rpc('kk_save_update_source',{payload:{name:value.name.trim(),url:value.url.trim(),notes:value.notes.trim(),enabled:value.enabled},source_id:existing?.id??null,expected_updated_at:existing?.updated_at??null}).single();
 if(error||!data)throw sourceError(error?.code);return data as UpdateSource;
}
export async function deleteUpdateSource(c:SupabaseClient,source:UpdateSource):Promise<void>{const {error}=await c.rpc('kk_delete_update_source',{source_id:source.id,expected_updated_at:source.updated_at});if(error)throw sourceError(error.code);}
