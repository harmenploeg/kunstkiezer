import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const allowedOrigins=new Set(['https://www.loci-amsterdam.nl','https://loci-amsterdam.nl','https://kunstkiezer.pages.dev']);
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')??'';
 const headers={'Access-Control-Allow-Origin':allowedOrigins.has(origin)?origin:'https://www.loci-amsterdam.nl','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 const response=(data:unknown,status=200)=>Response.json(data,{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST'||!allowedOrigins.has(origin))return response({error:'Niet toegestaan.'},403);
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
 const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const token=(req.headers.get('authorization')??'').replace(/^Bearer /i,'');
 const {data,error}=await client.auth.getUser(token);
 if(error||!data.user?.email)return response({error:'Log opnieuw in.'},401);
 try{
  const body=await req.json();if(typeof body.password!=='string'||body.password.length>512)return response({error:'Wachtwoord vereist.'},400);
  const verified=await client.auth.signInWithPassword({email:data.user.email,password:body.password});
  if(verified.error||verified.data.user?.id!==data.user.id)return response({error:'Het wachtwoord klopt niet. Probeer later opnieuw bij te veel pogingen.'},401);
  // Password authentication is rate limited by Supabase Auth; no credentials are logged.
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const deleted=await admin.auth.admin.deleteUser(data.user.id);
  await client.auth.signOut();
  if(deleted.error)return response({error:'Verwijderen is niet gelukt. Als je de laatste beheerder bent, draag dan eerst het beheer over.'},409);
  return response({deleted:true});
 }catch{return response({error:'Verwijderen is niet gelukt. Probeer opnieuw.'},400);}
});
