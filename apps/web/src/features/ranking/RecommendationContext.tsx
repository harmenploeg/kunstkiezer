import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {getClient} from '../../../../../packages/data/src/client.ts';
import {readRankingSettings} from '../../../../../packages/data/src/ranking.ts';
import {defaultRanking,validCoordinates,type Coordinates,type RankingSettings} from '../../../../../packages/domain/src/ranking.ts';
export const DISTANCE_CHOICE='kunstkiezer.distance.enabled';
export const LOCATION_CACHE='kunstkiezer.location.session';
const MAX_AGE=15*60*1000;
type Status='idle'|'loading'|'ready'|'denied'|'unavailable'|'timeout';
interface LocationFix extends Coordinates {accuracy:number;timestamp:number;}
interface State {enabled:boolean;location:LocationFix|null;status:Status;settings:RankingSettings;enable:()=>void;disable:()=>void;refreshSettings:()=>Promise<void>;}
const Context=createContext<State|null>(null);
function remember(enabled:boolean){try{localStorage.setItem(DISTANCE_CHOICE,String(enabled));}catch{/* Current page still works without storage. */}}
function cachedFix():LocationFix|null{try{const v=JSON.parse(sessionStorage.getItem(LOCATION_CACHE)??'null');if(!v||typeof v.timestamp!=='number'||typeof v.accuracy!=='number'||!Number.isFinite(v.accuracy)||Date.now()-v.timestamp<0||Date.now()-v.timestamp>=MAX_AGE)return null;const timestamp=v.timestamp,accuracy=v.accuracy;return validCoordinates(v)?{latitude:v.latitude,longitude:v.longitude,timestamp,accuracy}:null;}catch{return null;}}
function clearFix(){try{sessionStorage.removeItem(LOCATION_CACHE);}catch{}}
export function RecommendationProvider({children}:{children:ReactNode}){
 const [enabled,setEnabled]=useState(false),[location,setLocation]=useState<LocationFix|null>(null),[status,setStatus]=useState<Status>('idle'),[settings,setSettings]=useState<RankingSettings>(defaultRanking);
 const request=useRef(0),wanted=useRef(false),mounted=useRef(true);
 async function refreshSettings(){try{const next=await readRankingSettings(await getClient());if(mounted.current)setSettings(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);}catch{/* Use last known settings, or documented defaults. */}}
 function disable(){request.current++;wanted.current=false;setEnabled(false);setLocation(null);setStatus('idle');remember(false);clearFix();}
 function enable(){
  const token=++request.current;wanted.current=true;setEnabled(true);setStatus('loading');setLocation(null);clearFix();remember(true);
  if(!navigator.geolocation){wanted.current=false;setEnabled(false);setStatus('unavailable');remember(false);return;}
  navigator.geolocation.getCurrentPosition(pos=>{
   if(!mounted.current||token!==request.current||!wanted.current)return;
   const fix={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,timestamp:Date.now()};
   if(!validCoordinates(fix)){wanted.current=false;setEnabled(false);setStatus('unavailable');remember(false);return;}
   setLocation(fix);setStatus('ready');try{sessionStorage.setItem(LOCATION_CACHE,JSON.stringify(fix));}catch{}
  },error=>{if(!mounted.current||token!==request.current)return;wanted.current=false;setEnabled(false);setLocation(null);remember(false);clearFix();setStatus(error.code===1?'denied':error.code===3?'timeout':'unavailable');},{enableHighAccuracy:false,maximumAge:0,timeout:12000});
 }
 useEffect(()=>{
  mounted.current=true;let permission:PermissionStatus|undefined;
  async function restore(){let optedIn=false;try{optedIn=localStorage.getItem(DISTANCE_CHOICE)==='true';}catch{}const token=request.current;
   try{permission=await navigator.permissions.query({name:'geolocation'});if(!mounted.current||token!==request.current)return;
    permission.onchange=()=>{if(permission?.state==='denied'){const wasEnabled=wanted.current;disable();if(wasEnabled)setStatus('denied');}};
    if(!optedIn)return;
    if(permission.state==='denied'){disable();setStatus('denied');return;}
    if(permission.state!=='granted')return; // Never prompt on page load.
    const cached=cachedFix();if(cached){wanted.current=true;setEnabled(true);setLocation(cached);setStatus('ready');}else enable();
   }catch{if(!mounted.current||token!==request.current)return;const cached=optedIn?cachedFix():null;if(cached){wanted.current=true;setEnabled(true);setLocation(cached);setStatus('ready');}}
  }
  void restore();void refreshSettings();const focus=()=>{void refreshSettings();};const storage=(e:StorageEvent)=>{if(e.key===DISTANCE_CHOICE&&e.newValue!=='true')disable();};window.addEventListener('focus',focus);window.addEventListener('storage',storage);const timer=setInterval(focus,60000);
  return()=>{mounted.current=false;request.current++;if(permission)permission.onchange=null;window.removeEventListener('focus',focus);window.removeEventListener('storage',storage);clearInterval(timer);};
 },[]);
 return <Context.Provider value={{enabled,location,status,settings,enable,disable,refreshSettings}}>{children}</Context.Provider>;
}
export function useRecommendations(){const value=useContext(Context);if(!value)throw Error('RecommendationProvider ontbreekt.');return value;}
