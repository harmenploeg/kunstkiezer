import assert from "node:assert/strict";
import test from "node:test";
import site from "../workers/api/src/site.ts";

function assets() {
  const paths: string[] = [];
  return { paths, ASSETS: { async fetch(request: Request) { paths.push(new URL(request.url).pathname); return new Response("asset"); } } };
}

test("Loci-bestanden en onbekende paden krijgen geen Kunstkiezer-app", async () => {
  const env = assets();
  for (const path of ["/app.js", "/kunstkiezer-anders", "/kunstkiezer/agenda"]) assert.equal((await site.fetch(new Request(`https://kunstkiezer.loci-amsterdam.nl${path}`), env)).status, 404);
  assert.equal(env.paths.length, 0);
});

test("de app staat aan de wortel; routepagina's krijgen HTML zonder cache", async () => {
  const env = assets();
  const home = await site.fetch(new Request("https://kunstkiezer.loci-amsterdam.nl/?source=loci"), env);
  assert.equal(home.status, 200);
  const page = await site.fetch(new Request("https://kunstkiezer.loci-amsterdam.nl/agenda/musea"), env);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(env.paths, ["/", "/"]);
});

test("assets komen ongewijzigd; onbekende pagina's krijgen geen SPA-HTML", async () => {
  const env = assets();
  await site.fetch(new Request("https://kunstkiezer.loci-amsterdam.nl/assets/app.js"), env);
  await site.fetch(new Request("https://kunstkiezer.loci-amsterdam.nl/version.json"), env);
  assert.deepEqual(env.paths, ["/assets/app.js", "/version.json"]);
  assert.equal((await site.fetch(new Request("https://kunstkiezer.loci-amsterdam.nl/unknown"), env)).status, 404);
  assert.equal((await site.fetch(new Request("https://kunstkiezer.loci-amsterdam.nl/api/unknown"), env)).status, 404);
});

test("API-liveness staat op /api/health", async () => {
  const env = assets();
  const response = await site.fetch(new Request("https://kunstkiezer.loci-amsterdam.nl/api/health"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "kunstkiezer-api" });
});

test("beheerinstellingen en oude volgordelink blijven rechtstreeks bereikbaar",async()=>{for(const path of ['/beheer/instellingen','/beheer/volgorde']){const env=assets();const r=await site.fetch(new Request('https://kunstkiezer.loci-amsterdam.nl'+path),env);assert.equal(r.status,200);assert.deepEqual(env.paths,['/']);}});
