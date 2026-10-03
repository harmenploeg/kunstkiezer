export const PROFILE_KEY='kunstkiezer.profile.v1';
export interface TasteProfile {version:1;completed:boolean;tags:string[];}
export const emptyProfile=():TasteProfile=>({version:1,completed:false,tags:[]});
export const normalizeTag=(tag:string)=>tag.trim().toLocaleLowerCase('nl-NL');
export function uniqueTags(tags:string[]):string[]{return [...new Set(tags.map(normalizeTag).filter(Boolean))];}
export function parseProfile(raw:string|null):TasteProfile {
 try {const p:unknown=JSON.parse(raw??'null');if(!p||typeof p!=='object')return emptyProfile();
 const v=p as Record<string,unknown>;if(v.version!==1||typeof v.completed!=='boolean'||!Array.isArray(v.tags))return emptyProfile();
 return {version:1,completed:v.completed,tags:uniqueTags(v.tags.filter((t):t is string=>typeof t==='string'&&t.length<=120).slice(0,500))};
 }catch{return emptyProfile();}
}
export function matchingTags(tags:string[],preferences:string[]):string[]{const wanted=new Set(uniqueTags(preferences));return uniqueTags(tags).filter(t=>wanted.has(t));}
/** Stable ties preserve the catalogue's normal order; ranking happens before pagination. */
export function rankByTaste<T extends {tags:string[]}>(rows:T[],preferences:string[]):T[]{
 if(!preferences.length)return [...rows];
 return rows.map((row,index)=>({row,index,score:matchingTags(row.tags,preferences).length})).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.row);
}
export const preferenceQuestions=[
 {title:'Welke kunst trekt je aandacht?',description:'Kies gerust meerdere vormen.',options:[
  {label:'Schilderkunst',tags:['schilderkunst']},{label:'Fotografie',tags:['fotografie','documentaire fotografie']},
  {label:'Beelden en installaties',tags:['beeldhouwkunst','installaties','beeldenensemble']},
  {label:'Design en mode',tags:['design','mode','toegepaste kunst']},{label:'Keramiek en glas',tags:['keramiek','glaskunst']},
  {label:'Tekeningen en grafiek',tags:['tekenkunst','tekeningen','grafiek','prentkunst']},
  {label:'Digitale kunst en video',tags:['digitale kunst','videokunst','mediakunst']}]},
 {title:'Welke stijlen en periodes spreken je aan?',description:'Van oude meesters tot nieuwe experimenten.',options:[
  {label:'Oude meesters',tags:['oude meesters','oude kunst']},{label:'Moderne kunst',tags:['moderne kunst','naoorlogse kunst']},
  {label:'Hedendaags en experimenteel',tags:['hedendaagse kunst','experiment']},
  {label:'Abstract',tags:['abstract']},{label:'Figuratief en realistisch',tags:['figuratief','figuratieve kunst','realisme']},
  {label:'De Stijl en modernisme',tags:['de stijl','modernisme']}]},
 {title:'Waar kijk je graag naar tijdens een uitstapje?',description:'Deze voorkeuren tellen ook mee binnen de vijf verzamelingen.',options:[
  {label:'Kunst buiten en in het landschap',tags:['kunst in de openbare ruimte','land art','landschap']},
  {label:'Beeldentuinen en routes',tags:['beeldentuin','museumtuin','beeldenroute']},
  {label:'Historische gebouwen',tags:['historische architectuur','rijksmonument']},
  {label:'Moderne architectuur',tags:['hedendaagse architectuur','naoorlogse architectuur']},
  {label:'Industrieel erfgoed',tags:['industrieel erfgoed']},{label:'Straatkunst',tags:['street art','graffiti']},
  {label:'Identiteit en samenleving',tags:['identiteit','maatschappij','migratie']},
  {label:'Natuur en ecologie',tags:['mens en natuur','ecologie']}]}
] as const;
