// De Kunstkiezer op zijn eigen subdomein, kunstkiezer.loci-amsterdam.nl, aan de
// wortel. Bekende pagina's krijgen de app, bestanden komen ongewijzigd uit de
// build, en al het andere is 404: dit domein valt nergens op Loci terug.
const PAGES = new Set([
 "/kunstkeuze", "/account", "/account-verwijderen", "/bekijk", "/", "/agenda", "/geschiedenis", "/profiel", "/agenda/musea", "/beheer/musea",
 "/beheer/instellingen", "/beheer/volgorde", "/beheer", "/beheer/openbare-kunst", "/beheer/beeldenparken", "/beheer/architectuur", "/beheer/evenementen", "/agenda/evenementen",
 "/agenda/openbare-kunst", "/agenda/beeldenparken", "/agenda/architectuur"
]);
const FILES = new Set(['/version.json','/inventory.json','/art-inventory.json','/inventory.csv','/inventory-report.json','/openbare-kunst.json','/beeldenparken.json','/architectuur.json','/evenementen.json']);
export async function onRequest({request,env}) {
 const url=new URL(request.url),path=url.pathname;
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
 if(path==='/api/health')return Response.json({status:'ok',service:'kunstkiezer-api'},{headers:{'Cache-Control':'no-store'}});
 const page=PAGES.has(path.replace(/\/$/,'')||'/');
 if(!page&&!path.startsWith('/assets/')&&!FILES.has(path))return new Response('Niet gevonden',{status:404});
 if(page)url.pathname='/';
 const asset=await env.ASSETS.fetch(new Request(url,request));
 const headers=new Headers(asset.headers);headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('X-Content-Type-Options','nosniff');
 if(page){headers.set('Cache-Control','no-store');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https: http:; connect-src 'self' https://*.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");}
 return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,headers});
}
