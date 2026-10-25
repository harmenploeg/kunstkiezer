interface PublicBindings {PUBLIC_SUPABASE_URL?:string; PUBLIC_SUPABASE_PUBLISHABLE_KEY?:string}
export function onRequestGet({env}:{env:PublicBindings}):Response {
 const url=env.PUBLIC_SUPABASE_URL;
 const key=env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!url||!key||!key.startsWith('sb_publishable_')) return Response.json({error:'database_not_configured'},{status:503,headers});
 try{const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error();}catch{return Response.json({error:'invalid_public_config'},{status:503,headers});}
 return Response.json({APP_ENV:'production',PUBLIC_SUPABASE_URL:url,PUBLIC_SUPABASE_PUBLISHABLE_KEY:key},{headers});
}
