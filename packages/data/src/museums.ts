export const provinces = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland'] as const;
export interface MuseumPhoto { url: string; caption: string; credit: string; source_url: string; license: string }
export const wordCount = (text:string) => text.trim() ? text.trim().split(/\s+/u).length : 0;
export interface Museum {
 id: string; inventory_key: string | null; name: string; city: string; province: string;
 street_address: string; postal_code: string; country: string; website_url: string;
 latitude: number | null; longitude: number | null; summary: string;
 operating_status: 'unknown' | 'open' | 'temporarily_closed' | 'closed';
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
export const blankMuseum: MuseumInput = { name:'',city:'',province:'',street_address:'',postal_code:'',country:'NL',website_url:'',latitude:null,longitude:null,summary:'',operating_status:'unknown',publication_status:'draft',is_art_museum:true,photos:[],tags:[] };
export function safeWebUrl(value: string): string | null {
 try { const u=new URL(value); return ['https:','http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function validateMuseum(m: MuseumInput): string[] {
 const errors: string[]=[];
 if (!m.name.trim() || m.name.length>250) errors.push('Vul een museumnaam in van maximaal 250 tekens.');
 if (m.province && !provinces.some(p=>p===m.province)) errors.push('Kies een Nederlandse provincie.');
 if (m.website_url && !safeWebUrl(m.website_url)) errors.push('Gebruik een geldige website met http of https.');
 if ((m.latitude===null)!==(m.longitude===null)) errors.push('Vul beide coördinaten in, of laat beide leeg.');
 if (m.latitude!==null && (!Number.isFinite(m.latitude)||Math.abs(m.latitude)>90)) errors.push('Breedtegraad is ongeldig.');
 if (m.longitude!==null && (!Number.isFinite(m.longitude)||Math.abs(m.longitude)>180)) errors.push('Lengtegraad is ongeldig.');
 if (wordCount(m.summary)>80) errors.push('De collectietekst mag maximaal 80 woorden bevatten.');
 if ((m.photos??[]).length>20 || (m.photos??[]).some(p=>!safeWebUrl(p.url)||(p.source_url&&!safeWebUrl(p.source_url)))) errors.push('Gebruik maximaal 20 foto’s met geldige http- of https-links.');
 if (m.publication_status==='published' && (m.is_art_museum===false||m.operating_status!=='open'||!m.city.trim()||(!m.street_address.trim()&&m.latitude===null))) errors.push('Publiceren vereist een kunstmuseum, status open, plaats en adres of coördinaten.');
 return errors;
}
