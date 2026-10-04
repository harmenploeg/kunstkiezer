import {type LocatedItem} from '../../domain/src/ranking.ts';
export const provinces = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland'] as const;
export interface MuseumPhoto { url: string; caption: string; credit: string; source_url: string; license: string }
export const wordCount = (text:string) => text.trim() ? text.trim().split(/\s+/u).length : 0;
export interface Museum extends LocatedItem {
 id: string; inventory_key: string | null; name: string; city: string; province: string;
 street_address: string; postal_code: string; country: string; website_url: string;
 latitude: number | null; longitude: number | null; summary: string;
 operating_status: 'unknown' | 'open' | 'temporarily_closed' | 'closed' | 'disappeared';
 publication_status: 'draft' | 'review' | 'published' | 'archived';
 is_art_museum: boolean; photos: MuseumPhoto[];
 verification_status?: 'unreviewed' | 'verified' | 'needs_update';
 tags: string[]; updated_at: string;
}
export type MuseumInput = Omit<Museum,'id'|'inventory_key'|'updated_at'>;
export interface MuseumSource { provider: string; url: string; retrieved_at: string; evidence_fields: string[] }
export interface TagProposal { label: string; dimension: string; confidence: string; evidence: string }
export interface Editorial { review_notes: string; suggested_tags: TagProposal[] }
export interface InventoryMuseum extends MuseumInput { id: string; inventory_key: string; sources: MuseumSource[]; review_notes: string; suggested_tags: TagProposal[] }
export const blankMuseum: MuseumInput = { name:'',city:'',province:'',street_address:'',postal_code:'',country:'NL',website_url:'',latitude:null,longitude:null,summary:'',operating_status:'open',publication_status:'draft',is_art_museum:true,photos:[],tags:[] };
export function safeWebUrl(value: string): string | null {
 try { const u=new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function museumFieldErrors(m: MuseumInput): Record<string,string> {
 const errors: Record<string,string>={};
 if (!m.name.trim() || m.name.length>250) errors.name='Vul een museumnaam in van maximaal 250 tekens.';
 if (m.province && !provinces.some(p=>p===m.province)) errors.province='Kies een Nederlandse provincie.';
 if (m.website_url && !safeWebUrl(m.website_url)) errors.website_url='Gebruik een geldige website met http of https.';
 if ((m.latitude===null)!==(m.longitude===null)) errors[m.latitude===null?'latitude':'longitude']='Vul ook deze coördinaat in, of laat beide coördinaten leeg.';
 if (m.latitude!==null && (!Number.isFinite(m.latitude)||Math.abs(m.latitude)>90)) errors.latitude='Vul een breedtegraad tussen -90 en 90 in.';
 if (m.longitude!==null && (!Number.isFinite(m.longitude)||Math.abs(m.longitude)>180)) errors.longitude='Vul een lengtegraad tussen -180 en 180 in.';
 if (wordCount(m.summary)>80) errors.summary='De collectietekst mag maximaal 80 woorden bevatten.';
 if (m.summary.length>5000) errors.summary='Kort de collectietekst in tot maximaal 5000 tekens en 80 woorden.';
 if ((m.photos??[]).length>20) errors.photos='Verwijder foto’s tot er maximaal 20 over zijn.';
 (m.photos??[]).forEach((p,i)=>{
  if(!safeWebUrl(p.url)) errors[`photos.${i}.url`]='Vul een geldige afbeeldingslink met http of https in.';
  if(p.source_url&&!safeWebUrl(p.source_url)) errors[`photos.${i}.source_url`]='Vul een geldige bronlink met http of https in.';
 });
 if(m.publication_status==='published'){
  if(m.is_art_museum===false) errors.publication_status='Dit museum valt buiten de kunstmuseumselectie. Kies Concept om de gegevens op te slaan.';
 }
 return errors;
}
export function validateMuseum(m: MuseumInput): string[] { return Object.values(museumFieldErrors(m)); }
