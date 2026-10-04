import {CoordinateFields} from '../ranking/CoordinateFields.tsx';
import { getClient } from '../../../../../packages/data/src/client.ts';
import { useEffect, useState, useRef, type ReactNode, type FormEvent } from 'react';
import { provinces, wordCount, safeWebUrl, museumFieldErrors, type Museum, type MuseumInput, type MuseumSource, type Editorial } from '../../../../../packages/data/src/museums.ts';
interface Props {museum: MuseumInput; existing: Museum|null; sources: MuseumSource[]; editorial: Editorial; canSave: boolean; onSave:(m:MuseumInput,notes:string)=>Promise<void>}
function Field({name,label,errors,children}:{name:string;label:string;errors:Record<string,string>;children:ReactNode}) {
 return <div className={errors[name]?'form-field field-invalid':'form-field'}><label htmlFor={`museum-${name}`}>{label}</label>{children}{errors[name]&&<p className="field-error" id={`error-${name}`}>{errors[name]}</p>}</div>;
}
export function MuseumForm({museum,existing,sources,editorial,canSave,onSave}:Props) {
 const [value,setValue]=useState<MuseumInput>(museum),[notes,setNotes]=useState(editorial.review_notes),[message,setMessage]=useState(''),[saving,setSaving]=useState(false),[tagText,setTagText]=useState(museum.tags.join(', '));
 const formRef=useRef<HTMLFormElement>(null);
 const [attempted,setAttempted]=useState(false),[nativeErrors,setNativeErrors]=useState<Record<string,string>>({});
 const errors=attempted?{...museumFieldErrors(value),...nativeErrors}:{};
 const attrs=(name:string)=>({id:`museum-${name}`,name,'aria-invalid':Boolean(errors[name]),'aria-describedby':errors[name]?`error-${name}`:undefined});
 const [library,setLibrary]=useState<{label:string;dimension:string}[]>([]);
 useEffect(()=>{if(!canSave)return;let active=true;getClient().then(c=>c.from('kk_tags').select('label,dimension').order('dimension').order('label')).then(({data})=>{if(active)setLibrary(data??[]);}).catch(()=>{});return()=>{active=false;};},[canSave]);
 function field<K extends keyof MuseumInput>(name:K,v:MuseumInput[K]){setValue(old=>({...old,[name]:v}));setMessage('');setNativeErrors({});}
 async function submit(e:FormEvent){e.preventDefault();setAttempted(true);
  const browserErrors:Record<string,string>={};
  formRef.current?.querySelectorAll<HTMLInputElement>('input').forEach(input=>{if(input.validity.badInput)browserErrors[input.name]='Vul een geldig getal in.';});
  setNativeErrors(browserErrors);
  if(Object.keys({...museumFieldErrors(value),...browserErrors}).length){setMessage('');requestAnimationFrame(()=>{const target=formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');target?.focus({preventScroll:true});target?.scrollIntoView({behavior:'instant',block:'center'});});return;}
  setSaving(true);setMessage('');try{await onSave(value,notes);setMessage('Opgeslagen in Supabase.');}catch(e){setMessage(e instanceof Error?e.message:'Opslaan mislukt.');}finally{setSaving(false);}
 }
 return <form ref={formRef} noValidate className="museum-form" onSubmit={e=>void submit(e)}>
  <h2>{existing?'Museum bewerken':'Museumgegevens'}</h2>
  {!canSave&&<p className="notice">Inventarisvoorbeeld: je kunt de velden bekijken en uitproberen. Opslaan wordt beschikbaar na aansluiting op Supabase en aanmelden als redacteur.</p>}
  <div className="form-grid">
   <Field name="name" label="Naam" errors={errors}><input {...attrs('name')} required maxLength={250} value={value.name} onChange={e=>field('name',e.target.value)} /></Field>
   <Field name="city" label="Plaats" errors={errors}><input {...attrs('city')} value={value.city} onChange={e=>field('city',e.target.value)} /></Field>
   <Field name="province" label="Provincie" errors={errors}><select {...attrs('province')} value={value.province} onChange={e=>field('province',e.target.value)}><option value="">Nog onbekend</option>{provinces.map(p=><option key={p}>{p}</option>)}</select></Field>
   <Field name="street_address" label="Adres" errors={errors}><input {...attrs('street_address')} value={value.street_address} onChange={e=>field('street_address',e.target.value)} /></Field>
   <Field name="postal_code" label="Postcode" errors={errors}><input {...attrs('postal_code')} value={value.postal_code} onChange={e=>field('postal_code',e.target.value)} /></Field>
   <Field name="website_url" label="Website" errors={errors}><input {...attrs('website_url')} type="url" value={value.website_url} onChange={e=>field('website_url',e.target.value)} placeholder="https://" /></Field>
   <Field name="latitude" label="Breedtegraad" errors={errors}><input {...attrs('latitude')} type="number" step="any" min={-90} max={90} value={value.latitude??''} onChange={e=>field('latitude',e.target.value===''?null:Number(e.target.value))} /></Field>
   <Field name="longitude" label="Lengtegraad" errors={errors}><input {...attrs('longitude')} type="number" step="any" min={-180} max={180} value={value.longitude??''} onChange={e=>field('longitude',e.target.value===''?null:Number(e.target.value))} /></Field>
   <Field name="operating_status" label="Bedrijfsstatus" errors={errors}><select {...attrs('operating_status')} value={value.operating_status} onChange={e=>field('operating_status',e.target.value as MuseumInput['operating_status'])}><option value="unknown">Nog controleren</option><option value="open">Open</option><option value="temporarily_closed">Tijdelijk gesloten</option><option value="closed">Gesloten</option><option value="disappeared">Verdwenen</option></select></Field>
   <Field name="publication_status" label="Publicatie" errors={errors}><select {...attrs('publication_status')} value={value.publication_status} onChange={e=>field('publication_status',e.target.value as MuseumInput['publication_status'])}><option value="draft">Concept</option><option value="review">Ter beoordeling</option><option value="published">Gepubliceerd</option><option value="archived">Archief</option></select></Field>
  </div>
  <CoordinateFields value={value} includeNumbers={false} onChange={change=>{setValue(old=>({...old,...change}));setMessage('');}}/><Field name="summary" label="Collectie" errors={errors}><textarea {...attrs('summary')} rows={4} maxLength={5000} value={value.summary} onChange={e=>field('summary',e.target.value)} /></Field>
  <p className={wordCount(value.summary)>80?'notice':''} aria-live="polite">{wordCount(value.summary)} / 80 woorden</p>
  <fieldset id="museum-photos" tabIndex={-1} aria-invalid={Boolean(errors.photos)} aria-describedby={errors.photos?'error-photos':undefined}><legend>Foto’s</legend>{errors.photos&&<p className="field-error" id="error-photos">{errors.photos}</p>}<p>Voeg één of meer afbeeldingslinks toe. De eerste foto is de omslag.</p>
   {(value.photos??[]).map((photo,index)=><div className="photo-editor" key={index}>
    {safeWebUrl(photo.url)&&<img src={safeWebUrl(photo.url)!} alt={photo.caption||value.name} loading="lazy" />}
    {(['url','caption','credit','source_url','license'] as const).map((key)=><Field key={key} name={`photos.${index}.${key}`} errors={errors} label={({url:'Afbeeldingslink',caption:'Onderschrift',credit:'Fotograaf / maker',source_url:'Bronlink',license:'Licentie'})[key]+` ${index+1}`}><input {...attrs(`photos.${index}.${key}`)} type={key==='url'||key==='source_url'?'url':'text'} required={key==='url'} value={photo[key]} onChange={e=>field('photos',value.photos.map((p,i)=>i===index?{...p,[key]:e.target.value}:p))}/></Field>)}
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
