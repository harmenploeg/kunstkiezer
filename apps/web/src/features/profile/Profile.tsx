import {useState,useEffect,type FormEvent} from 'react';
import {preferenceQuestions,uniqueTags,type TasteProfile} from '../../../../../packages/domain/src/profile.ts';
import {catalogueTags} from '../../../../../packages/domain/src/catalogue-tags.ts';
import {appHref} from '../../../../../packages/domain/src/navigation.ts';
import {saveProfile} from './useProfile.ts';
export function Profile({profile,onboarding=false}:{profile:TasteProfile;onboarding?:boolean}){
 const [tags,setTags]=useState(profile.tags),[search,setSearch]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>setTags(profile.tags),[profile.tags]);
 function change(next:string[]){setTags(uniqueTags(next));setMessage('');}
 function save(e?:FormEvent,all=false){e?.preventDefault();try{
  const selected=all?[]:tags;saveProfile({version:1,completed:true,tags:selected});setTags(selected);
  if(onboarding)window.location.assign(appHref('/agenda'));else setMessage('Je profiel is opgeslagen. Ontdek kunst gebruikt nu deze voorkeuren.');
 }catch{setMessage('Je browser kon het profiel niet bewaren. Sta lokale opslag toe en probeer opnieuw.');}}
 const found=catalogueTags.filter(t=>!tags.includes(t)&&t.includes(search.toLocaleLowerCase('nl-NL').trim())).slice(0,30);
 const questions=<>{preferenceQuestions.map((q,i)=><fieldset className="taste-question" key={q.title}><legend><span className="eyebrow">Vraag {i+1}</span><br/>{q.title}</legend><p>{q.description}</p><div className="taste-options">{q.options.map(o=>{
 const chosen=o.tags.every(t=>tags.includes(t));const partial=!chosen&&o.tags.some(t=>tags.includes(t));
 return <button type="button" key={o.label} aria-pressed={chosen} className="taste-option" onClick={()=>change(chosen?tags.filter(t=>!(o.tags as readonly string[]).includes(t)):[...tags,...o.tags])}><strong>{o.label}</strong><span>{o.tags.join(' · ')}</span>{partial&&<small>Deels gekozen via je tags</small>}</button>;
 })}</div></fieldset>)}</>;
 const tagEditor=<section className="profile-tags" aria-label="Jouw tags"><h2>{onboarding?'Jouw gekozen tags':'Opgeslagen en gekozen tags'}</h2><p>Verwijder losse tags of voeg een specifieke voorkeur toe.</p><div className="tag-list">{tags.map(t=><button key={t} type="button" aria-label={`Verwijder tag ${t}`} onClick={()=>change(tags.filter(x=>x!==t))}>{t} ×</button>)}</div>{!tags.length&&<p>Geen voorkeuren: je krijgt het volledige aanbod in de standaardvolgorde.</p>}
 <p>{tags.length>0&&<button type="button" onClick={()=>change([])}>Alle voorkeuren wissen</button>}</p><label>Zoek een extra tag<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Bijvoorbeeld art deco of portretten"/></label>{search.trim()&&<div className="tag-list tag-suggestions">{found.map(t=><button type="button" key={t} onClick={()=>{change([...tags,t]);setSearch('');}}>{t} +</button>)}{!found.length&&<p>Geen andere tags gevonden.</p>}</div>}</section>;
 return <><header className="page-heading"><p className="eyebrow">Jouw smaak, jouw ontdekkingen</p><h1>{onboarding?'Mijn kunstkeuze':'Mijn profiel'}<span className="accent">.</span></h1><p>{onboarding?'Wat zie je graag? Vertel ons wat je aanspreekt en ontdek kunst die bij je past.':'Dit zijn je voorkeuren. Pas ze aan wanneer je smaak verandert of je iets nieuws wilt ontdekken.'}</p></header>
 <form className="taste-form" onSubmit={e=>save(e)}>
 <p>{onboarding?'Je mag meerdere antwoorden kiezen. Ze worden vertaald naar tags: meer overeenkomsten betekent een hogere plek in de resultaten. Het overige aanbod blijft beschikbaar.':'Meer overeenkomende tags geeft een hogere plek bij Ontdek kunst. Je kunt hieronder je voorkeuren aanpassen.'}</p>
 {onboarding?<>{questions}{tagEditor}</>:<>{tagEditor}<details className="profile-questions"><summary>Voorkeuren kiezen met de vragen</summary>{questions}</details></>}

 <p className="storage-note">Je profiel wordt op dit apparaat in deze browser bewaard. Je hebt geen account nodig. Na het invullen verdwijnt ‘Mijn kunstkeuze’; aanpassen kan altijd via ‘Mijn profiel’.</p>
 {message&&<p className="notice" role="status">{message}</p>}<div className="profile-actions"><button className="primary-button" type="submit">{onboarding?'Bewaar mijn smaak en ontdek kunst':'Profiel opslaan'}</button>{onboarding?<button type="button" onClick={()=>save(undefined,true)}>Ik sta overal voor open</button>:<a className="text-button" href={appHref('/agenda')}>Ontdek kunst →</a>}</div></form></>;
}
