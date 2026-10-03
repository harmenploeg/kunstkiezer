import assert from "node:assert/strict";
import test from "node:test";
import site from "../workers/api/src/site.ts";

function assets() {
  const paths: string[] = [];
  return { paths, ASSETS: { async fetch(request: Request) { paths.push(new URL(request.url).pathname); return new Response("asset"); } } };
}

test("bestaande Loci-routes worden niet door Kunstkiezer verwerkt", async () => {
  const env = assets();
  for (const path of ["/", "/app.js", "/kunstkiezer-anders"]) assert.equal((await site.fetch(new Request(`https://loci-amsterdam.nl${path}`), env)).status, 404);
  assert.equal(env.paths.length, 0);
});

test("redirect behoudt query en routepagina's krijgen HTML zonder cache", async () => {
  const env = assets();
  const response = await site.fetch(new Request("https://loci-amsterdam.nl/kunstkiezer?source=loci"), env);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("Location"), "https://loci-amsterdam.nl/kunstkiezer/?source=loci");
  const page = await site.fetch(new Request("https://loci-amsterdam.nl/kunstkiezer/agenda/musea"), env);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(env.paths, ["/"]);
});

test("assetpad wordt herschreven; onbekende pagina's krijgen geen SPA-HTML", async () => {
  const env = assets();
  await site.fetch(new Request("https://loci-amsterdam.nl/kunstkiezer/assets/app.js"), env);
  assert.deepEqual(env.paths, ["/assets/app.js"]);
  assert.equal((await site.fetch(new Request("https://loci-amsterdam.nl/kunstkiezer/unknown"), env)).status, 404);
  assert.equal((await site.fetch(new Request("https://loci-amsterdam.nl/kunstkiezer/api/unknown"), env)).status, 404);
});

test("API-liveness staat uitsluitend onder het Kunstkiezer-pad", async () => {
  const env = assets();
  const response = await site.fetch(new Request("https://loci-amsterdam.nl/kunstkiezer/api/health"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "kunstkiezer-api" });
});
