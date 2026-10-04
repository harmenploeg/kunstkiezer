import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllVisits } from "../packages/data/src/accounts.ts";
test("Accountdownload bevat ook bezoeken voorbij de eerste 1000 rijen", async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => ({
    item_id: String(i),
    category: "musea",
    name: "Bezoek " + i,
    rating: 4,
    seen_at: "2026-01-01",
  }));
  const ranges: number[][] = [];
  const query = {
    select: () => query,
    eq: (key: string, id: string) => {
      assert.equal(key, "user_id");
      assert.equal(id, "own-user");
      return query;
    },
    order: () => query,
    range: async (from: number, to: number) => {
      ranges.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    },
  };
  const client = {
    from: (name: string) => {
      assert.equal(name, "kk_seen");
      return query;
    },
  } as unknown as SupabaseClient;
  assert.equal((await readAllVisits(client, "own-user")).length, 1201);
  assert.deepEqual(ranges, [
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
});
test("Een mislukte vervolgpagina levert geen schijnbaar volledige accountdownload op", async () => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    range: async (from: number) =>
      from === 0
        ? { data: Array(500).fill({}), error: null }
        : { data: null, error: { message: "offline" } },
  };
  await assert.rejects(
    readAllVisits(
      { from: () => query } as unknown as SupabaseClient,
      "own-user",
    ),
    /niet volledig/,
  );
});
