import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validRanking,
  type RankingSettings,
} from "../../domain/src/ranking.ts";
export async function readRankingSettings(
  c: SupabaseClient,
): Promise<RankingSettings> {
  const { data, error } = await c
    .from("kk_ranking_settings")
    .select(
      "distance_weight,tag_weight,distance_scale_km,rating_weight,rating_prior,updated_at",
    )
    .eq("id", 1)
    .single();
  if (error || !data || !validRanking(data))
    throw Error("De instellingen konden niet worden geladen.");
  return data;
}
export async function saveRankingSettings(
  c: SupabaseClient,
  value: RankingSettings,
  expected: string,
): Promise<RankingSettings> {
  if (!validRanking(value))
    throw Error(
      "De gewichten moeten samen 100% zijn; kies een afstandsbereik van 1 tot 500 km.",
    );
  const { data, error } = await c
    .rpc("kk_save_ranking_v2", {
      payload: {
        ...value,
        rating_weight: value.rating_weight ?? 0,
        rating_prior: value.rating_prior ?? 5,
      },
      expected_updated_at: expected,
    })
    .single();
  if (error?.code === "40001")
    throw Error(
      "De instellingen zijn ondertussen gewijzigd. Herlaad de pagina en probeer opnieuw.",
    );
  if (error || !data)
    throw Error("Opslaan is niet gelukt. Controleer je redactierechten.");
  return data as RankingSettings;
}
