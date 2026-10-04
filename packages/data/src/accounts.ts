import type { SupabaseClient } from "@supabase/supabase-js";
export interface SeenRecord {
  item_id: string;
  category: string;
  name: string;
  rating: number | null;
  seen_at: string;
}
/** Fetch every page: Supabase caps a single request at 1,000 rows. */
export async function readAllVisits(
  client: SupabaseClient,
  userId: string,
): Promise<SeenRecord[]> {
  const rows: SeenRecord[] = [];
  for (let page = 0; ; page++) {
    const result = await client
      .from("kk_seen")
      .select("item_id,category,name,rating,seen_at")
      .eq("user_id", userId)
      .order("seen_at", { ascending: false })
      .order("category")
      .order("item_id")
      .range(page * 500, page * 500 + 499);
    if (result.error)
      throw Error(
        "Je bezoeken konden niet volledig worden geladen. Probeer opnieuw.",
      );
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}
