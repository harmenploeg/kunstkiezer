import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSourcePage,SOURCE_LIMITS,extractSourceText} from '../scripts/source-reader.mjs';
const html=s=>new Response(s,{headers:{'content-type':'text/html; charset=utf-8'}});
const content='<main>Het museum is tijdelijk gesloten wegens onderhoud. Heropening op 17 november.</main>';
test('veilige HTTPS-redirects leveren bewijs op de uiteindelijke bron-URL',async()=>{
 const seen=[];const result=await readSourcePage('https://example.test/',async(u,o)=>{seen.push(u);assert.equal(o.redirect,'manual');return seen.length===1?new Response(null,{status:301,headers:{location:'/bezoek'}}):html(content);});
 assert.equal(result.status,'ok');assert.equal(result.page.url,'https://example.test/bezoek');assert.equal(result.page.redirects,1);assert.equal(seen.length,2);
});
test('cookiepoorten, andere hosts, credentials, HTTP en afwijkende poorten worden niet gevolgd',async()=>{
 for(const [target,status] of [['https://myprivacy.test/consent','consent_required'],['https://other.test/page','external_redirect'],['http://example.test/','external_redirect'],['https://user:pass@example.test/','external_redirect'],['https://example.test:444/','external_redirect']]){
  let calls=0;const result=await readSourcePage('https://example.test/',async()=>{calls++;return new Response(null,{status:302,headers:{location:target}});});assert.equal(result.status,status);assert.equal(calls,1);
 }
});
test('redirectlussen en lange ketens blijven begrensd',async()=>{
 let calls=0;let result=await readSourcePage('https://example.test/',async()=>{calls++;return new Response(null,{status:301,headers:{location:'/'}});});assert.equal(result.status,'redirect_loop');assert.equal(calls,1);
 calls=0;result=await readSourcePage('https://example.test/',async()=>new Response(null,{status:302,headers:{location:'/'+(++calls)}}));assert.equal(result.status,'redirect_limit');assert.equal(calls,SOURCE_LIMITS.redirects+1);
});
test('grote pagina behoudt gelezen tekst binnen bytegrens en markeert ontbrekende rest',async()=>{
 let cancelled=false;const bytes=new TextEncoder().encode(content+'x'.repeat(SOURCE_LIMITS.bytes));
 const result=await readSourcePage('https://example.test/',async()=>new Response(new ReadableStream({start(c){c.enqueue(bytes);},cancel(){cancelled=true;}}),{headers:{'content-type':'text/html'}}));
 assert.equal(result.status,'ok');assert.equal(result.page.html_truncated,true);assert.ok(result.page.text.includes('tijdelijk gesloten'));assert.ok(Buffer.byteLength(result.page.text)<=4000);assert.equal(cancelled,true);
 const skipped=await readSourcePage('https://example.test/',async()=>html('<script>'+('x'.repeat(SOURCE_LIMITS.bytes))+'</script>'+content));assert.equal(skipped.status,'truncated_before_content');
});
test('hoofdinhoud en HTML-entiteiten leveren controleerbare citaten; scripts en navigatie verdwijnen',()=>{
 const text=extractSourceText('<header>Menu</header><script>Vals citaat</script><main>Open &amp; toegankelijk &#x2014; &#39;kunst&#39;.</main><footer>Contact</footer>');assert.equal(text,"Open & toegankelijk — 'kunst'.");
});
test('HTTP- en netwerkproblemen blijven te onderscheiden zonder ruwe inhoud te loggen',async()=>{
 for(const [status,expected] of [[403,'access_blocked'],[429,'source_rate_limited'],[503,'source_unavailable'],[404,'http_error']])assert.equal((await readSourcePage('https://example.test/',async()=>new Response(null,{status}))).status,expected);
 assert.equal((await readSourcePage('https://example.test/',async()=>{throw new Error('secret details');})).status,'network_error');
 assert.equal((await readSourcePage('https://example.test/',async()=>new Response('{}',{headers:{'content-type':'application/json'}}))).status,'unsupported_content');
 assert.equal((await readSourcePage('https://example.test/',async()=>html('<title>Just a moment</title>'+content))).status,'access_blocked');
});
test('korte menu-overblijfselen uit afgebroken pagina worden niet als bruikbare bron aangeboden',async()=>{
 const result=await readSourcePage('https://example.test/',async()=>html('<main>Wikimedia Commons Jump to content<script>'+('x'.repeat(SOURCE_LIMITS.bytes))));assert.equal(result.status,'truncated_before_content');
});
