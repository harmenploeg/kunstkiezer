import { getClient } from '../../../../../packages/data/src/client.ts';
import { useEffect, useState, type FormEvent } from 'react';
import { provinces, wordCount, safeWebUrl, validateMuseum, type Museum, type MuseumInput, type MuseumSource, type Editorial } from '../../../../../packages/data/src/museums.ts';
interface Props {museum: MuseumInput; existing: Museum|null; sources: MuseumSource[]; editorial: Editorial; canSave: boolean; onSave:(m:MuseumInput,notes:string)=>Promise<void>}
export function MuseumForm({museum,existing,sources,editorial,canSave,onSave}:Props) {
 const [value,setValue]=useState<MuseumInput>(museum),[notes,setNotes]=useState(editorial.review_notes),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[tagText,setTagText]=useState(museum.tags.join(', '));
 const [library,setLibrary]=useState<{label:string;dimension:string}[]>([]);
 useEffect(()=>{if(!canSave)return;let active=true;getClient().then(c=>c.from('kk_tags').select('label,dimension').order('dimension').order('label')).then(({data})=>{if(active)setLibrary(data??[]);}).catch(()=>{});return()=>{active=false;};},[canSave]);
 function field<K extends keyof MuseumInput>(name:K,v:MuseumInput[K]){setValue(old=>({...old,[name]:v}));setMessage('');}
 async function submit(e:FormEvent){e.preventDefault();const errors=validateMuseum(value);if(errors.length){setMessage(errors.join(' '));return;}
  setSaving(true);setMessage('');try{await onSave(value,notes);setMessage('Opgeslagen in Supabase.');}catch(e){setMessage(e instanceof Error?e.message:'Opslaan mislukt.');}finally{setSaving(false);}
 }
 return <form className="museum-form" onSubmit={e=>void submit(e)}>
  <h2>{existing?'Museum bewerken':'Museumgegevens'}</h2>
  {!canSave&&<p className="notice">Inventarisvoorbeeld: je kunt de velden bekijken en uitproberen. Opslaan wordt beschikbaar na aansluiting op Supabase en aanmelden als redacteur.</p>}
  <div className="form-grid">
   <label>Naam<input required maxLength={250} value={value.name} onChange={e=>field('name',e.target.value)} /></label>
   <label>Plaats<input value={value.city} onChange={e=>field('city',e.target.value)} /></label>
   <label>Provincie<select value={value.province} onChange={e=>field('province',e.target.value)}><option value="">Nog onbekend</option>{provinces.map(p=><option key={p}>{p}</option>)}</select></label>
   <label>Adres<input value={value.street_address} onChange={e=>field('street_address',e.target.value)} /></label>
   <label>Postcode<input value={value.postal_code} onChange={e=>field('postal_code',e.target.value)} /></label>
   <label>Website<input type="url" value={value.website_url} onChange={e=>field('website_url',e.target.value)} placeholder="https://" /></label>
   <label>Breedtegraad<input type="number" step="any" min={-90} max={90} value={value.latitude??''} onChange={e=>field('latitude',e.target.value===''?null:Number(e.target.value))} /></label>
   <label>Lengtegraad<input type="number" step="any" min={-180} max={180} value={value.longitude??''} onChange={e=>field('longitude',e.target.value===''?null:Number(e.target.value))} /></label>
   <label>Bedrijfsstatus<select value={value.operating_status} onChange={e=>field('operating_status',e.target.value as MuseumInput['operating_status'])}><option value="unknown">Nog controleren</option><option value="open">Open</option><option value="temporarily_closed">Tijdelijk gesloten</option><option value="closed">Gesloten</option></select></label>
   <label>Publicatie<select value={value.publication_status} onChange={e=>field('publication_status',e.target.value as MuseumInput['publication_status'])}><option value="draft">Concept</option><option value="review">Ter beoordeling</option><option value="published">Gepubliceerd</option><option value="archived">Archief</option></select></label>
  </div>
  <label>Collectie<textarea rows={4} maxLength={5000} value={value.summary} onChange={e=>field('summary',e.target.value)} /></label>
  <p className={wordCount(value.summary)>80?'notice':''} aria-live="polite">{wordCount(value.summary)} / 80 woorden</p>
  <fieldset><legend>Foto’s</legend><p>Voeg één of meer afbeeldingslinks toe. De eerste foto is de omslag.</p>
   {(value.photos??[]).map((photo,index)=><div className="photo-editor" key={index}>
    {safeWebUrl(photo.url)&&<img src={safeWebUrl(photo.url)!} alt={photo.caption||value.name} loading="lazy" />}
    {(['url','caption','credit','source_url','license'] as const).map((key)=><label key={key}>{({url:'Afbeeldingslink',caption:'Onderschrift',credit:'Fotograaf / maker',source_url:'Bronlink',license:'Licentie'})[key]} {index+1}<input type={key==='url'||key==='source_url'?'url':'text'} required={key==='url'} value={photo[key]} onChange={e=>field('photos',value.photos.map((p,i)=>i===index?{...p,[key]:e.target.value}:p))}/></label>)}
    <button type="button" onClick={()=>field('photos',value.photos.filter((_,i)=>i!==index))}>Foto {index+1} verwijderen</button>
    {index>0&&<button type="button" onClick={()=>field('photos',[photo,...value.photos.filter((_,i)=>i!==index)])}>Als omslag gebruiken</button>}
   </div>)}
   <button type="button" disabled={(value.photos??[]).length>=20} onClick={()=>field('photos',[...(value.photos??[]),{url:'',caption:'',credit:'',source_url:'',license:''}])}>Foto toevoegen</button>
  </fieldset>
  <label>Tags, gescheiden door komma's<input value={tagText} onChange={e=>{setTagText(e.target.value);field('tags',[...new Set(e.target.value.split(',').map(t=>t.trim()).filter(Boolean))]);}} /></label>
  {library.length>0&&<label>Tag toevoegen uit de bibliotheek<select value="" onChange={e=>{if(e.target.value&&!value.tags.includes(e.target.value)){const next=[...value.tags,e.target.value];field('tags',next);setTagText(next.join(', '));}}}><option value="">Kies een tag…</option>{[...new Set(library.map(t=>t.dimension))].map(d=><optgroup key={d} label={d}>{library.filter(t=>t.dimension===d).map(t=><option key={t.label} disabled={value.tags.includes(t.label)} value={t.label}>{t.label}</option>)}</optgroup>)}</select></label>}
  {editorial.suggested_tags.length>0&&<fieldset><legend>Tagvoorstellen — zelf beoordelen</legend>{editorial.suggested_tags.map(t=><div key={t.label}><button type="button" className="tag-proposal" disabled={value.tags.includes(t.label)} title={t.evidence} onClick={()=>{field('tags',[...value.tags,t.label]);setTagText([...value.tags,t.label].join(', '));}}>+ {t.label} <small>({t.dimension})</small></button><p><small>{t.evidence}</small></p></div>)}</fieldset>}
  <label>Interne redactienotities<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} /></label>
  <section><h3>Bronnen</h3>{sources.length?sources.map((s,i)=><p key={i}>{safeWebUrl(s.url)?<a href={safeWebUrl(s.url)!} target="_blank" rel="noopener noreferrer">{s.provider} ↗</a>:s.provider}<br/><small>Opgehaald {new Date(s.retrieved_at).toLocaleDateString('nl-NL')} · {s.evidence_fields.join(', ')}</small></p>):<p>Nog geen bron gekoppeld. Vul controleerbare gegevens en je eigen notities in.</p>}</section>
  {message&&<p role="status" className="notice">{message}</p>}
  <button className="primary-button" disabled={!canSave||saving} type="submit">{saving?'Opslaan…':'Opslaan in Supabase'}</button>
 </form>;
}
