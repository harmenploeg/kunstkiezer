import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, getMuseumExtras, listMuseums, saveMuseum } from '../../../../../packages/data/src/client.ts';
import { blankMuseum, provinces, type Museum, type MuseumInput, type Editorial, type MuseumSource, type InventoryMuseum } from '../../../../../packages/data/src/museums.ts';
import { MuseumForm } from './MuseumForm.tsx';
const emptyEditorial: Editorial={review_notes:'',suggested_tags:[]};
export function MuseumAdmin(){
 const [client,setClient]=useState<SupabaseClient|null>(null),[mode,setMode]=useState<'loading'|'preview'|'login'|'editor'|'denied'>('loading');
 const [inventory,setInventory]=useState<InventoryMuseum[]>([]),[rows,setRows]=useState<Museum[]>([]),[total,setTotal]=useState(0),[page,setPage]=useState(0);
 const [search,setSearch]=useState(''),[province,setProvince]=useState(''),[message,setMessage]=useState('');
 const [sendingLink,setSendingLink]=useState(false);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[selected,setSelected]=useState<MuseumInput|null>(null),[existing,setExisting]=useState<Museum|null>(null),[editorial,setEditorial]=useState<Editorial>(emptyEditorial),[sources,setSources]=useState<MuseumSource[]>([]),[formKey,setFormKey]=useState(0);
 async function inspect(c:SupabaseClient){const {data}=await c.auth.getSession();if(!data.session){setMode('login');return;}const role=await c.rpc('kk_is_editor');setMode(role.data===true?'editor':'denied');}
 useEffect(()=>{let active=true;let unsubscribe: (()=>void)|undefined;
  getClient().then(async c=>{if(!active)return;setClient(c);await inspect(c);const {data}=c.auth.onAuthStateChange(()=>{setTimeout(()=>{if(active)void inspect(c);},0);});unsubscribe=()=>data.subscription.unsubscribe();}).catch(async()=>{
   if(!active)return;setMode('preview');try{const r=await fetch('/kunstkiezer/art-inventory.json');if(!r.ok)throw Error();const data=await r.json() as InventoryMuseum[];if(active)setInventory(data);}catch{if(active)setMessage('De inventaris kon niet worden geladen.');}
  });return()=>{active=false;unsubscribe?.();};
 },[]);
 useEffect(()=>{if(mode!=='editor'||!client)return;let active=true;const timer=setTimeout(()=>{listMuseums(client,search,province,true,page).then(r=>{if(active){setRows(r.rows);setTotal(r.total);}}).catch(e=>{if(active)setMessage(e.message);});},250);return()=>{active=false;clearTimeout(timer);};},[client,mode,search,province,page]);
 async function login(e:FormEvent){e.preventDefault();if(!client)return;setMessage('');const {error}=await client.auth.signInWithPassword({email,password});setPassword('');if(error)setMessage('Aanmelden is niet gelukt. Controleer je gegevens.');else await inspect(client);}
 async function sendLoginLink(){if(!client||!email.trim()){setMessage('Vul eerst je e-mailadres in.');return;}setSendingLink(true);const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:window.location.origin+'/kunstkiezer/beheer/musea'}});setSendingLink(false);setMessage(error?'De aanmeldlink kon niet worden verstuurd. Controleer je account of probeer later opnieuw.':'Aanmeldlink aangevraagd. Open de e-mail op dit apparaat om verder te gaan.');}
 async function choose(m:Museum|InventoryMuseum){setMessage('');setSelected(null);setExisting(mode==='editor'?m as Museum:null);
  if(mode==='editor'&&client){try{const extra=await getMuseumExtras(client,m.id);setSources(extra.sources);setEditorial(extra.editorial);}catch(e){setMessage(e instanceof Error?e.message:'Laden mislukt.');return;}}
  else{const draft=m as InventoryMuseum;setSources(draft.sources);setEditorial({review_notes:draft.review_notes,suggested_tags:draft.suggested_tags});}
  setSelected(m);setFormKey(k=>k+1);
 }
 async function save(m:MuseumInput,notes:string){if(!client||mode!=='editor')throw Error('Meld je aan als redacteur.');const saved=await saveMuseum(client,m,existing,notes);setExisting(saved);
  const result=await listMuseums(client,search,province,true,page);setRows(result.rows);setTotal(result.total);
 }
 const filtered=inventory.filter(m=>(!province||m.province===province)&&`${m.name} ${m.city}`.toLowerCase().includes(search.toLowerCase()));
 const visible=mode==='preview'?filtered.slice(page*50,page*50+50):rows;
 const count=mode==='preview'?filtered.length:total;
 return <><header className="page-heading"><p className="eyebrow">Redactie</p><h1>Musea beheren<span className="accent">.</span></h1><p>Bewerk kunstmusea, collectieteksten, foto’s en tags.</p></header>
  {mode==='loading'&&<p role="status">Databaseverbinding controleren…</p>}
  {mode==='preview'&&<div className="notice"><strong>Museuminventaris — nog niet verbonden met Supabase</strong><p>Een eerste selectie kunstmusea met collectieteksten, foto’s en tags. De openbare museumcatalogus gebruikt Supabase.</p><a href="/kunstkiezer/art-inventory.json" download>Download kunstmuseumselectie</a></div>}
  {mode==='login'&&<form onSubmit={e=>void login(e)} className="login-form"><h2>Aanmelden als redacteur</h2><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></label><label>Wachtwoord<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></label><button className="primary-button">Aanmelden met wachtwoord</button><button type="button" disabled={sendingLink} onClick={()=>void sendLoginLink()}>{sendingLink?'Versturen…':'Stuur mij een aanmeldlink'}</button><p>Gebruik het e-mailadres waarvoor je redactierechten hebt gekregen. Met een aanmeldlink heb je geen wachtwoord nodig.</p></form>}
  {mode==='denied'&&<p className="notice">Je bent aangemeld, maar hebt geen redactierechten. De projecteigenaar kan deze toekennen.</p>}
  {(mode==='editor'||mode==='denied')&&<button onClick={()=>{void client?.auth.signOut();setSelected(null);}}>Afmelden</button>}
  {message&&<p role="status" className="notice">{message}</p>}
  {(mode==='editor'||mode==='preview')&&<><div className="filters"><label>Zoek museum{mode==='preview'?' of plaats':''}<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} /></label><label>Provincie<select value={province} onChange={e=>{setProvince(e.target.value);setPage(0);}}><option value="">Alle provincies</option>{provinces.map(p=><option key={p}>{p}</option>)}</select></label>{mode==='editor'&&<button onClick={()=>{setSelected(blankMuseum);setExisting(null);setSources([]);setEditorial(emptyEditorial);setFormKey(k=>k+1);}}>Museum toevoegen</button>}</div>
  <p role="status">{count} kunstmusea · pagina {page+1} van {Math.max(1,Math.ceil(count/50))}</p>
  <div className="admin-layout"><section aria-label="Museumlijst" className="museum-list">{visible.map(m=><button key={m.id} className="museum-row" onClick={()=>void choose(m)}><strong>{m.name}</strong><span>{[m.city,m.province].filter(Boolean).join(' · ')||'Plaats nog controleren'}</span><small>{m.publication_status==='published'?'Gepubliceerd':'Concept'}</small></button>)}<div className="pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Vorige</button><button disabled={(page+1)*50>=count} onClick={()=>setPage(p=>p+1)}>Volgende</button></div></section>
  {selected?<MuseumForm key={formKey} museum={selected} existing={existing} sources={sources} editorial={editorial} canSave={mode==='editor'} onSave={save} />:<div className="empty-state"><h2>Kies een museum</h2><p>Open een vermelding om de gegevens, bron en tagvoorstellen te bekijken.</p></div>}</div></>}
 </>;
}
