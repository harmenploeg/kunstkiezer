const PAGES = new Set([
 "/", "/agenda", "/geschiedenis", "/profiel", "/agenda/musea", "/beheer/musea",
 "/beheer", "/beheer/openbare-kunst", "/beheer/beeldenparken", "/beheer/architectuur", "/beheer/evenementen", "/agenda/evenementen",
 "/agenda/openbare-kunst", "/agenda/beeldenparken", "/agenda/architectuur"
]);
export async function onRequest({request,env}) {
 const url=new URL(request.url),relative=url.pathname.slice('/kunstkiezer'.length);
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
 if(!relative){url.pathname+='/';return Response.redirect(url.toString(),308);}
 if(relative==='/api/health')return Response.json({status:'ok',service:'kunstkiezer-api'},{headers:{'Cache-Control':'no-store'}});
 const page=PAGES.has(relative.replace(/\/$/,'')||'/');
 if(!page&&!relative.startsWith('/assets/')&&!['/inventory.json','/art-inventory.json','/inventory.csv','/inventory-report.json','/openbare-kunst.json','/beeldenparken.json','/architectuur.json','/evenementen.json'].includes(relative))return new Response('Niet gevonden',{status:404});
 if(page)url.pathname='/kunstkiezer/';
 const asset=await env.ASSETS.fetch(new Request(url,request));
 const headers=new Headers(asset.headers);headers.set('X-Robots-Tag','noindex, nofollow');headers.set('X-Content-Type-Options','nosniff');
 if(page){headers.set('Cache-Control','no-store');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https: http:; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");}
 return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,headers});
}
