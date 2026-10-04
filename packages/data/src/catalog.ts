import type { SupabaseClient } from "@supabase/supabase-js";
import type { Museum } from "./museums.ts";
import { amsterdamDay, monthAhead, type DiscoveryItem } from "./discovery.ts";
import type { RatingTotals } from "../../domain/src/ranking.ts";
export type CatalogItem = (Museum | DiscoveryItem) & {
  category: string;
  creator?: string;
  rating?: RatingTotals | undefined;
};
async function all<T>(
  fetchPage: (
    a: number,
    b: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let a = 0; ; a += 500) {
    const { data, error } = await fetchPage(a, a + 499);
    if (error)
      throw Error("Het aanbod kon niet worden geladen. Probeer opnieuw.");
    out.push(...(data ?? []));
    if (!data || data.length < 500) return out;
  }
}
export async function readRatings(c: SupabaseClient): Promise<RatingTotals[]> {
  return all<RatingTotals>((a, b) =>
    c.rpc("kk_rating_totals").order("category").order("item_id").range(a, b),
  );
}
export async function readCatalog(
  c: SupabaseClient,
  category?: string,
  strictRatings = false,
): Promise<CatalogItem[]> {
  const museum = () =>
    all<Museum>((a, b) =>
      c
        .from("kk_museums")
        .select("*")
        .eq("is_art_museum", true)
        .eq("publication_status", "published")
        .eq("operating_status", "open")
        .order("name")
        .order("id")
        .range(a, b),
    );
  const discovery = () =>
    all<DiscoveryItem>((a, b) => {
      let q = c
        .from("kk_discoveries")
        .select("*")
        .eq("publication_status", "published")
        .eq("operating_status", "open")
        .order("name")
        .order("id");
      if (category) q = q.eq("category", category);
      return q.range(a, b);
    });
  const [m, d, ratings] = await Promise.all([
    !category || category === "musea" ? museum() : [],
    category !== "musea" ? discovery() : [],
    readRatings(c).catch((e) => {
      if (strictRatings) throw e;
      return [];
    }),
  ]);
  const day = amsterdamDay();
  const rows: CatalogItem[] = [
    ...m.map((r) => ({ ...r, category: "musea" })),
    ...d.filter(
      (r) =>
        r.category !== "evenementen" ||
        (!!r.ends_on &&
          r.ends_on >= day &&
          !!r.starts_on &&
          r.starts_on <= monthAhead(day)),
    ),
  ];
  const scores = new Map(ratings.map((r) => [r.category + ":" + r.item_id, r]));
  return rows
    .map((r) => ({ ...r, rating: scores.get(r.category + ":" + r.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
}

/** Saved history includes past events; availability rules and RLS still apply. */
export async function readSavedCatalog(
  c: SupabaseClient,
  saved: { item_id: string; category: string }[],
): Promise<CatalogItem[]> {
  const result: CatalogItem[] = [];
  for (const category of new Set(saved.map((r) => r.category))) {
    const ids = saved
      .filter((r) => r.category === category)
      .map((r) => r.item_id);
    for (let offset = 0; offset < ids.length; offset += 100) {
      let query = c
        .from(category === "musea" ? "kk_museums" : "kk_discoveries")
        .select("*")
        .in("id", ids.slice(offset, offset + 100))
        .eq("publication_status", "published")
        .eq("operating_status", "open");
      query =
        category === "musea"
          ? query.eq("is_art_museum", true)
          : query.eq("category", category);
      const { data, error } = await query;
      if (error) throw Error("Kaartgegevens konden niet laden.");
      result.push(...(data ?? []).map((row) => ({ ...row, category })));
    }
  }
  return result;
}
