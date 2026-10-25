// De CARTO-sleutel voor de kaart, alleen voor pagina's van dit domein. Tot
// systeemaudit stap 1.3 (oktober 2026) leende de Kunstkiezer deze functie van de Loci-app; op een eigen
// subdomein staat hij op zichzelf, met dezelfde herkomstcontrole. De sleutel staat
// als geheim LOCI_CARTO_BASEMAP_KEY op het Pages-project loci-kunstkiezer.
const KEY_PATTERN = /^[A-Za-z0-9_-]{20,160}$/u;
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const reply = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers });

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin) return origin === new URL(request.url).origin && (!fetchSite || ["same-origin", "none"].includes(fetchSite));
  return ["same-origin", "none"].includes(fetchSite || "");
}

export function onRequestGet({ request, env }) {
  if (!sameOrigin(request)) return reply({ error: "ander domein geweigerd" }, 403);
  const key = String(env?.LOCI_CARTO_BASEMAP_KEY || "").trim();
  if (!KEY_PATTERN.test(key)) return reply({ error: "CARTO-kaart is niet geconfigureerd" }, 503);
  return reply({ key });
}

export function onRequest() {
  return new Response("methode niet toegestaan", { status: 405, headers: { allow: "GET" } });
}
