import {coordinateErrors,type LocatedItem} from '../../domain/src/ranking.ts';
import {safeWebUrl, type MuseumPhoto} from './museums.ts';
export const discoveryCategories=['openbare-kunst','beeldenparken','architectuur','evenementen'] as const;
export type DiscoveryCategory=typeof discoveryCategories[number];
export interface DiscoverySource {provider:string;url:string;retrieved_at:string;}
export interface DiscoveryInput extends LocatedItem {
 category:DiscoveryCategory;name:string;city:string;province:string;street_address:string;website_url:string;
 summary:string;creator:string;year:string;tags:string[];photos:MuseumPhoto[];sources:DiscoverySource[];
 selection_reason:string;visit_notes:string;museum_id:string|null;starts_on:string|null;ends_on:string|null;
 operating_status:'open'|'temporarily_closed'|'closed'|'unknown';publication_status:'draft'|'published'|'archived';
}
export interface DiscoveryItem extends DiscoveryInput {id:string;inventory_key:string|null;updated_at:string;}
export function blankDiscovery(category:DiscoveryCategory):DiscoveryInput{return {latitude:null,longitude:null,coordinate_precision:'unknown',coordinate_source:'',category,name:'',city:'',province:'',street_address:'',website_url:'',summary:'',creator:'',year:'',tags:[],photos:[],sources:[],selection_reason:'',visit_notes:'',museum_id:null,starts_on:null,ends_on:null,operating_status:'open',publication_status:'draft'};}
export function amsterdamDay(now=new Date()):string{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
/** One calendar month, clamped to the last day of the destination month. */
export function monthAhead(day:string):string{const [y,m,d]=day.split('-').map(Number) as [number,number,number];const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(d,last))).toISOString().slice(0,10);}
export function inAgenda(item:Pick<DiscoveryInput,'starts_on'|'ends_on'>,day=amsterdamDay()):boolean{return !!item.starts_on&&!!item.ends_on&&item.ends_on>=day&&item.starts_on<=monthAhead(day);}
export function validateDiscovery(r:DiscoveryInput):Record<string,string>{
 const e:Record<string,string>=coordinateErrors(r);if(!r.name.trim())e.name='Vul een naam in.';
 if(r.summary.trim().split(/\s+/).filter(Boolean).length>80)e.summary='Gebruik maximaal 80 woorden.';
 if(r.website_url&&!safeWebUrl(r.website_url))e.website_url='Vul een veilige http(s)-link in.';
 if(r.starts_on&&r.ends_on&&r.ends_on<r.starts_on)e.ends_on='De einddatum mag niet vóór de begindatum liggen.';
 if(r.category==='evenementen'&&r.publication_status==='published'){if(!r.starts_on)e.starts_on='Vul de bevestigde begindatum in.';if(!r.ends_on)e.ends_on='Vul de bevestigde einddatum in.';}
 if(r.publication_status==='published'){
  if(!r.summary.trim())e.summary='Vul een korte beschrijving in.';
  if(!r.selection_reason.trim())e.selection_reason='Licht toe waarom deze vermelding is geselecteerd.';
  if(!r.tags.length)e.tags='Voeg ten minste één inhoudelijke tag toe.';
  if(!r.sources.length)e.sources='Voeg ten minste één bron toe.';
 }
 r.sources.forEach((s,i)=>{if(!safeWebUrl(s.url))e[`source-${i}`]='Vul een geldige bronlink in.';});
 r.photos.forEach((p,i)=>{if(!safeWebUrl(p.url)||!safeWebUrl(p.source_url)||!p.credit.trim()||!p.license.trim())e[`photo-${i}`]='Vul een geldige foto- en bronlink, maker en licentie in.';});return e;
}
