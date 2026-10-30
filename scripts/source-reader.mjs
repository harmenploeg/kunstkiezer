// Bounded public HTML collection. Never follows a consent gate or another host.
export const SOURCE_LIMITS=Object.freeze({bytes:131072,textBytes:4000,links:8,redirects:3,timeoutMs:10000});
export function allowedSourceUrl(value,base){
 try{const u=new URL(value,base),b=new URL(base);return u.href.length<=2048&&u.protocol==='https:'&&b.protocol==='https:'&&!u.username&&!u.password&&u.port===b.port&&u.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')?u:null;}catch{return null;}
}
export function extractSourceText(html){
 const clean=html.replace(/<!--[\s\S]*?(?:-->|$)/g,' ').replace(/<(script|style|nav|footer|header|noscript)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,' ');
 const main=clean.match(/<main\b[^>]*>([\s\S]*?)(?:<\/main\s*>|$)/i)||clean.match(/<article\b[^>]*>([\s\S]*?)(?:<\/article\s*>|$)/i);
 return (main?main[1]:clean).replace(/<[^>]*(?:>|$)/g,' ').replace(/&(?:nbsp|#160);/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&(?:apos|#39);/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&#(x[\da-f]+|\d+);/gi,(_,s)=>{const n=s[0].toLowerCase()==='x'?parseInt(s.slice(1),16):Number(s);return n>0&&n<=0x10ffff?String.fromCodePoint(n):' ';}).replace(/\s+/g,' ').trim();
}
const clip=(text,n)=>{const bytes=Buffer.from(text);let end=Math.min(bytes.length,n);while(end>0){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,end));}catch{end--;}}return '';};
const consent=u=>/consent|privacy-gate|myprivacy|cookie-consent/i.test(u.hostname+' '+u.pathname);
export async function readSourcePage(value,fetcher=fetch){
 const initial=allowedSourceUrl(value,value);if(!initial)return {status:'unsupported_url'};
 let url=initial;const visited=new Set(),signal=AbortSignal.timeout(SOURCE_LIMITS.timeoutMs);
 try{
  for(let hop=0;hop<=SOURCE_LIMITS.redirects;hop++){
   if(visited.has(url.href))return {status:'redirect_loop'};visited.add(url.href);
   const response=await fetcher(url.href,{redirect:'manual',signal,headers:{'User-Agent':'Kunstkiezer-ProposalReview/2.1'}});
   if([301,302,303,307,308].includes(response.status)){
    await response.body?.cancel();let target;try{target=new URL(response.headers.get('location')||'',url);}catch{return {status:'invalid_redirect'};}
    if(!response.headers.get('location'))return {status:'invalid_redirect'};
    if(consent(target))return {status:'consent_required'};
    const next=allowedSourceUrl(target.href,initial.href);if(!next)return {status:'external_redirect'};
    if(hop===SOURCE_LIMITS.redirects)return {status:'redirect_limit'};url=next;continue;
   }
   const type=response.headers.get('content-type')||'';
   if(!response.ok||!type.includes('text/html')){await response.body?.cancel();return {status:response.status===429?'source_rate_limited':response.status===401||response.status===403?'access_blocked':response.status>=500?'source_unavailable':!response.ok?'http_error':'unsupported_content',http_status:response.status};}
   if(!response.body)return {status:'empty_page'};
   const reader=response.body.getReader(),parts=[];let bytes=0,truncated=false;
   try{while(true){const {done,value}=await reader.read();if(done)break;const remaining=SOURCE_LIMITS.bytes-bytes;
    if(value.length>remaining){parts.push(Buffer.from(value.subarray(0,remaining)));truncated=true;await reader.cancel();break;}
    bytes+=value.length;parts.push(Buffer.from(value));
   }}finally{reader.releaseLock();}
   const html=Buffer.concat(parts).toString('utf8'),text=extractSourceText(html);
   if(/<title[^>]*>[^<]*(?:just a moment|access denied|captcha|consent|privacy settings)/i.test(html)||text.length<600&&/verify (?:that )?you are human|enable javascript and cookies|toegang geweigerd/i.test(text))return {status:'access_blocked'};
   if(text.length<20||truncated&&text.length<50)return {status:truncated?'truncated_before_content':'insufficient_text'};
   const links=[...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(m=>allowedSourceUrl(m[1].replaceAll('&amp;','&'),url.href)).filter(Boolean)
    .filter(u=>/faq|agenda|programma|nieuws|blog|tentoon|expos|bezoek|opening|visit|exhibition/i.test(u.pathname)).map(u=>{u.hash='';return u.href;});
   return {status:'ok',page:{url:url.href,text:clip(text,SOURCE_LIMITS.textBytes),links:[...new Set(links)].filter(u=>u!==url.href).slice(0,SOURCE_LIMITS.links),fetched_at:new Date().toISOString(),html_truncated:truncated,text_truncated:Buffer.byteLength(text)>SOURCE_LIMITS.textBytes,redirects:hop}};
  }
 }catch(e){return {status:signal.aborted||e.name==='TimeoutError'||e.name==='AbortError'?'source_timeout':'network_error'};}
}
