import { matchingTags, rankByTaste, uniqueTags } from "./profile.ts";
export interface Coordinates {
  latitude: number;
  longitude: number;
}
export type CoordinatePrecision =
  | "exact"
  | "address"
  | "street"
  | "city"
  | "unknown";
export interface LocatedItem {
  latitude?: number | null;
  longitude?: number | null;
  coordinate_precision?: CoordinatePrecision;
  coordinate_source?: string;
}
export interface RankingSettings {
  distance_weight: number;
  tag_weight: number;
  distance_scale_km: number;
  rating_weight?: number;
  rating_prior?: number;
  updated_at?: string;
}
export const defaultRanking: RankingSettings = {
  distance_weight: 70,
  tag_weight: 30,
  distance_scale_km: 30,
  rating_weight: 0,
  rating_prior: 5,
};
export function validCoordinates(
  value: LocatedItem | null | undefined,
): value is Coordinates & LocatedItem {
  return (
    !!value &&
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    Math.abs(value.longitude) <= 180
  );
}
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dlon / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function validRanking(s: RankingSettings): boolean {
  return (
    Number.isInteger(s.distance_weight) &&
    Number.isInteger(s.tag_weight) &&
    s.distance_weight >= 0 &&
    s.tag_weight >= 0 &&
    s.distance_weight + s.tag_weight + (s.rating_weight ?? 0) === 100 &&
    Number.isInteger(s.rating_weight ?? 0) &&
    (s.rating_weight ?? 0) >= 0 &&
    (s.rating_weight ?? 0) <= 100 &&
    Number.isInteger(s.rating_prior ?? 5) &&
    (s.rating_prior ?? 5) >= 0 &&
    (s.rating_prior ?? 5) <= 100 &&
    Number.isFinite(s.distance_scale_km) &&
    s.distance_scale_km >= 1 &&
    s.distance_scale_km <= 500
  );
}
export function recommendationScore(
  matches: number,
  preferenceCount: number,
  km: number | null,
  settings: RankingSettings,
): number {
  const s = validRanking(settings) ? settings : defaultRanking;
  const taste =
    preferenceCount > 0
      ? Math.min(1, Math.max(0, matches / preferenceCount))
      : 0;
  // An unknown distance never masquerades as a nearby destination.
  const proximity =
    km !== null && Number.isFinite(km) && km >= 0
      ? 1 / (1 + km / s.distance_scale_km)
      : 0;
  return s.tag_weight * taste + s.distance_weight * proximity;
}
export interface RatingTotals {
  item_id: string;
  category: string;
  votes: number;
  stars: number[];
}
export function ratingScore(
  rating: RatingTotals | undefined,
  prior = 5,
): number {
  if (!rating || rating.votes < 3) return 0.5;
  const votes = rating.stars.reduce((a, b) => a + b, 0);
  return (
    (rating.stars.reduce((sum, n, i) => sum + (n * i) / 4, 0) + prior * 0.5) /
    (votes + prior)
  );
}
export function rankRecommendations<
  T extends LocatedItem & { tags: string[]; rating?: RatingTotals | undefined },
>(
  rows: T[],
  preferences: string[],
  origin: Coordinates | null,
  settings: RankingSettings = defaultRanking,
): T[] {
  const s = validRanking(settings) ? settings : defaultRanking;
  const n = uniqueTags(preferences).length;
  return rows
    .map((row, index) => ({
      row,
      index,
      score:
        recommendationScore(
          matchingTags(row.tags, preferences).length,
          n,
          validCoordinates(origin) && validCoordinates(row)
            ? distanceKm(origin, row)
            : null,
          s,
        ) +
        (s.rating_weight ?? 0) * ratingScore(row.rating, s.rating_prior ?? 5),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.row);
}
export function coordinateErrors(row: LocatedItem): Record<string, string> {
  const e: Record<string, string> = {};
  const lat = row.latitude ?? null,
    lon = row.longitude ?? null;
  if ((lat === null) !== (lon === null))
    e[lat === null ? "latitude" : "longitude"] =
      "Vul beide coördinaten in of laat beide leeg.";
  if (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90))
    e.latitude = "Gebruik een breedtegraad tussen -90 en 90.";
  if (lon !== null && (!Number.isFinite(lon) || Math.abs(lon) > 180))
    e.longitude = "Gebruik een lengtegraad tussen -180 en 180.";
  return e;
}
