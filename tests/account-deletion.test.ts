import { test } from "node:test";
import assert from "node:assert/strict";
import { deleteAccount } from "../supabase/functions/delete-account/handler.ts";
function scenario({
  authenticated = true,
  password = true,
  mismatch = false,
  blocked = false,
} = {}) {
  const deleted: string[] = [],
    signouts: unknown[] = [];
  let adminCreated = false;
  const deps = {
    verifier: () => ({
      auth: {
        getUser: async () => ({
          data: {
            user: authenticated
              ? { id: "own-id", email: "self@example.test" }
              : null,
          },
          error: !authenticated,
        }),
        signInWithPassword: async (input: {
          email: string;
          password: string;
        }) => {
          assert.equal(input.email, "self@example.test");
          return {
            data: {
              user: password ? { id: mismatch ? "other-id" : "own-id" } : null,
            },
            error: !password,
          };
        },
        signOut: async (options: unknown) => {
          signouts.push(options);
        },
      },
    }),
    administrator: () => {
      adminCreated = true;
      return {
        auth: {
          admin: {
            deleteUser: async (id: string) => {
              deleted.push(id);
              return { error: blocked };
            },
          },
        },
      };
    },
  };
  const request = (origin = "https://www.loci-amsterdam.nl") =>
    new Request("https://example.test/delete-account", {
      method: "POST",
      headers: {
        origin,
        authorization: "Bearer test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "test-password", user_id: "victim-id" }),
    });
  return { deps, request, deleted, signouts, adminCreated: () => adminCreated };
}
test("Account verwijderen vereist een geldig token én geldig wachtwoord van dezelfde gebruiker", async () => {
  for (const options of [
    { authenticated: false },
    { password: false },
    { mismatch: true },
  ]) {
    const s = scenario(options);
    assert.equal((await deleteAccount(s.request(), s.deps)).status, 401);
    assert.equal(s.adminCreated(), false);
    assert.deepEqual(s.deleted, []);
  }
});
test("Een meegegeven slachtoffer-id wordt genegeerd: alleen de geverifieerde gebruiker wordt verwijderd", async () => {
  const s = scenario();
  const r = await deleteAccount(s.request(), s.deps);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { deleted: true });
  assert.deepEqual(s.deleted, ["own-id"]);
  assert.deepEqual(s.signouts, [{ scope: "local" }]);
});
test("Laatste-beheerderblokkade bewaart account en logt geen bestaande sessies wereldwijd uit", async () => {
  const s = scenario({ blocked: true });
  assert.equal((await deleteAccount(s.request(), s.deps)).status, 409);
  assert.deepEqual(s.signouts, [{ scope: "local" }]);
});
test("Accountverwijdering weigert vreemde origins voordat een beheersclient wordt gemaakt", async () => {
  const s = scenario();
  assert.equal(
    (await deleteAccount(s.request("https://untrusted.example"), s.deps))
      .status,
    403,
  );
  assert.equal(s.adminCreated(), false);
});
