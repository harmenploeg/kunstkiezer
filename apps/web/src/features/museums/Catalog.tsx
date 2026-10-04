import {CatalogActions} from '../visits/Visits.tsx';
import {LocationControls,DistanceLabel} from '../ranking/LocationControls.tsx';
import {useRecommendations} from '../ranking/RecommendationContext.tsx';
import {useProfile} from '../profile/useProfile.ts';
import {TasteMatches,TasteSorting,VisitStatus} from '../profile/Personalization.tsx';
import { useEffect, useState } from 'react';
import { getClient, listMuseums } from '../../../../../packages/data/src/client.ts';
import { provinces, safeWebUrl, type Museum } from '../../../../../packages/data/src/museums.ts';
export function MuseumCatalog() {
 const profile=useProfile();const [personalized,setPersonalized]=useState(true);const taste=personalized?profile.tags:[];const recommendations=useRecommendations();const origin=personalized&&recommendations.enabled?recommendations.location:null;const tasteKey=JSON.stringify([taste,origin,recommendations.settings]);
 const [search,setSearch]=useState(''),[province,setProvince]=useState(''),[page,setPage]=useState(0);
 const [rows,setRows]=useState<Museum[]>([]),[total,setTotal]=useState(0),[status,setStatus]=useState('Museumgegevens laden…');
 useEffect(()=>{setPage(0);},[tasteKey]);
 useEffect(()=>{let active=true;setStatus('Museumgegevens laden…');
  const timer=setTimeout(()=>{getClient().then(c=>listMuseums(c,search,province,false,page,taste,origin,recommendations.settings)).then(result=>{
   if(active){setRows(result.rows);setTotal(result.total);setStatus('');}
  }).catch(e=>{if(active){setRows([]);setTotal(0);setStatus(e instanceof Error?e.message:'Laden mislukt.');}});},250);
  return()=>{active=false;clearTimeout(timer);};
 },[search,province,page,tasteKey]);
 return <section aria-label="Museumcatalogus">
  <LocationControls/><TasteSorting tags={profile.tags} personalized={personalized} onChange={v=>{setPersonalized(v);setPage(0);}}/><div className="filters"><label>Zoek op museumnaam<input value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} type="search" /></label><label>Provincie<select value={province} onChange={e=>{setProvince(e.target.value);setPage(0);}}><option value="">Heel Nederland</option>{provinces.map(p=><option key={p}>{p}</option>)}</select></label></div>
  {status?<p role="status" className="notice">{status}</p>:<p role="status">{total} kunstmusea</p>}
  {!status && !rows.length && <p>Er zijn nog geen kunstmusea voor deze selectie gepubliceerd.</p>}
  <div className="museum-grid">{rows.map(m=><article key={m.id} className="museum-card"><p className="eyebrow">{[m.city,m.province].filter(Boolean).join(' · ')}</p><h2>{m.name}</h2><DistanceLabel item={m}/><TasteMatches tags={m.tags} preferences={taste}/><VisitStatus status={m.operating_status} missingLocation={!m.street_address&&m.latitude===null}/><div className="museum-photos">{(m.photos??[]).filter(p=>safeWebUrl(p.url)).map((p,i)=><figure key={i}><img src={safeWebUrl(p.url)!} alt={p.caption||m.name} loading="lazy"/><figcaption>{p.caption}{p.credit&&` · ${p.credit}`} {safeWebUrl(p.source_url)&&<a href={safeWebUrl(p.source_url)!} target="_blank" rel="noopener noreferrer">{p.license||'Bron'}</a>}</figcaption></figure>)}</div>{m.summary&&<p>{m.summary}</p>}<p>{[m.street_address,m.postal_code,m.city].filter(Boolean).join(', ')}</p><div className="tag-list">{m.tags.map(t=><span key={t}>{t}</span>)}</div>{safeWebUrl(m.website_url)&&<a className="text-button" href={safeWebUrl(m.website_url)!} target="_blank" rel="noopener noreferrer">Website museum ↗</a>}<CatalogActions id={m.id} name={m.name} category={'musea'}/></article>)}</div>
  {total>50&&<div className="pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Vorige</button><span>Pagina {page+1} van {Math.ceil(total/50)}</span><button disabled={(page+1)*50>=total} onClick={()=>setPage(p=>p+1)}>Volgende</button></div>}
 </section>;
}
