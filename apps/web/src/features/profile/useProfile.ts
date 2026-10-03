import {useEffect,useState} from 'react';
import {PROFILE_KEY,parseProfile,emptyProfile,type TasteProfile} from '../../../../../packages/domain/src/profile.ts';
export function readProfile():TasteProfile{try{return parseProfile(localStorage.getItem(PROFILE_KEY));}catch{return emptyProfile();}}
export function saveProfile(profile:TasteProfile){localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));window.dispatchEvent(new Event('kunstkiezer-profile'));}
export function useProfile(){const [profile,setProfile]=useState(readProfile);useEffect(()=>{
 const update=()=>setProfile(old=>{const next=readProfile();return JSON.stringify(old)===JSON.stringify(next)?old:next;});
 const storage=(event:StorageEvent)=>{if(event.key===PROFILE_KEY||event.key===null)update();};window.addEventListener('storage',storage);window.addEventListener('kunstkiezer-profile',update);
 return()=>{window.removeEventListener('storage',storage);window.removeEventListener('kunstkiezer-profile',update);};},[]);return profile;}
