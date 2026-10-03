import assert from "node:assert/strict";
import test from "node:test";
import { readPublicConfiguration } from "../packages/config/src/index.ts";
import api from "../workers/api/src/index.ts";

const valid = {
  APP_ENV: "staging",
  PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};

test("publieke configuratie bevat geen meegegeven servercredentials", () => {
  const config = readPublicConfiguration({ ...valid, SUPABASE_SECRET_KEY: "server-only-example" });
  assert.deepEqual(Object.keys(config).sort(), ["environment", "supabasePublishableKey", "supabaseUrl"]);
});

test("serverkey in publiek veld wordt geweigerd", () => {
  assert.throws(() => readPublicConfiguration({ ...valid, PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_example" }));
});

test("productie weigert HTTP; lokale ontwikkeling staat het toe", () => {
  assert.throws(() => readPublicConfiguration({ ...valid, APP_ENV: "production", PUBLIC_SUPABASE_URL: "http://localhost:54321" }));
  assert.equal(readPublicConfiguration({ ...valid, APP_ENV: "development", PUBLIC_SUPABASE_URL: "http://localhost:54321" }).environment, "development");
});

test("configuratie vereist een expliciete omgeving", () => {
  assert.throws(() => readPublicConfiguration({ ...valid, APP_ENV: undefined }));
});

test("liveness-route en HTTP-afhandeling", async () => {
  const response = await api.fetch(new Request("https://example.org/api/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "kunstkiezer-api" });
  assert.equal((await api.fetch(new Request("https://example.org/api/items"))).status, 404);
  assert.equal((await api.fetch(new Request("https://example.org/api/health", { method: "POST" }))).status, 405);
});
