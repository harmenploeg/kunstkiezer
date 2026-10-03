export const provinces = ['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland'] as const;
export interface Museum {
 id: string; inventory_key: string | null; name: string; city: string; province: string;
 street_address: string; postal_code: string; country: string; website_url: string;
 latitude: number | null; longitude: number | null; summary: string;
 operating_status: 'unknown' | 'open' | 'temporarily_closed' | 'closed';
 publication_status: 'draft' | 'review' | 'published' | 'archived';
 verification_status: 'unreviewed' | 'verified' | 'needs_update';
 tags: string[]; updated_at: string;
}
export type MuseumInput = Omit<Museum,'id'|'inventory_key'|'updated_at'>;
export interface MuseumSource { provider: string; url: string; retrieved_at: string; evidence_fields: string[] }
export interface TagProposal { label: string; dimension: string; confidence: string; evidence: string }
export interface Editorial { review_notes: string; suggested_tags: TagProposal[] }
export interface InventoryMuseum extends MuseumInput { id: string; inventory_key: string; sources: MuseumSource[]; review_notes: string; suggested_tags: TagProposal[] }
export const blankMuseum: MuseumInput = { name:'',city:'',province:'',street_address:'',postal_code:'',country:'NL',website_url:'',latitude:null,longitude:null,summary:'',operating_status:'unknown',publication_status:'draft',verification_status:'unreviewed',tags:[] };
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
 if (m.summary.length>5000) errors.push('De beschrijving mag maximaal 5000 tekens bevatten.');
 if (m.publication_status==='published' && (m.verification_status!=='verified'||m.operating_status!=='open'||!m.city.trim()||(!m.street_address.trim()&&m.latitude===null))) errors.push('Publiceren vereist gecontroleerde gegevens, status open, plaats en adres of coördinaten.');
 return errors;
}
