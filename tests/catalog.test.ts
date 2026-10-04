import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rankRecommendations,
  ratingScore,
} from "../packages/domain/src/ranking.ts";
import {
  visitorText,
  precisePoint,
  directionsUrl,
  tagHref,
} from "../packages/domain/src/presentation.ts";
import { validQuestions } from "../packages/data/src/taxonomy.ts";
const rating = (stars: number[]) => ({
  item_id: "a",
  category: "musea",
  votes: stars.reduce((a, b) => a + b, 0),
  stars,
});
test("Waarderingen verhogen en verlagen de volgorde; minder dan drie stemmen blijft neutraal", () => {
  const low = rating([5, 0, 0, 0, 0]),
    high = rating([0, 0, 0, 0, 5]);
  assert.equal(ratingScore(rating([0, 0, 0, 0, 2])), 0.5);
  assert.ok(ratingScore(low) < 0.5);
  assert.ok(ratingScore(high) > 0.5);
  assert.ok(
    ratingScore(rating([0, 0, 0, 3, 0])) < ratingScore(rating([0, 0, 0, 0, 3])),
  );
  const rows = [
    { name: "laag", tags: [], rating: low },
    { name: "neutraal", tags: [] },
    { name: "hoog", tags: [], rating: high },
  ];
  assert.deepEqual(
    rankRecommendations(rows, [], null, {
      distance_weight: 56,
      tag_weight: 24,
      rating_weight: 20,
      rating_prior: 5,
      distance_scale_km: 30,
    }).map((x) => x.name),
    ["hoog", "neutraal", "laag"],
  );
});
test("Afstand blijft zwaar genoeg wegen naast sterren; uitzetten verwijdert afstand uit volgorde", () => {
  const rows = [
    {
      name: "ver",
      tags: ["a", "b", "c", "d", "e", "f"],
      latitude: 54.2,
      longitude: 5,
      rating: rating([0, 0, 0, 0, 5]),
    },
    { name: "nabij", tags: ["a"], latitude: 52.09, longitude: 5 },
  ];
  const s = {
    distance_weight: 56,
    tag_weight: 24,
    rating_weight: 20,
    rating_prior: 5,
    distance_scale_km: 30,
  };
  assert.equal(
    rankRecommendations(
      rows,
      ["a", "b", "c", "d", "e", "f"],
      { latitude: 52, longitude: 5 },
      s,
    )[0]?.name,
    "nabij",
  );
  assert.equal(
    rankRecommendations(rows, ["a", "b", "c", "d", "e", "f"], null, s)[0]?.name,
    "ver",
  );
});
test("Geen redactie-instructies en geen stadscentrum als objectpunt; navigatie ontsnapt de bestemming", () => {
  assert.equal(
    visitorText(
      "Bijzondere beelden in het park. Controleer de locatie. Nog te bevestigen.",
    ),
    "Bijzondere beelden in het park.",
  );
  const r = {
    name: "Kunst & glas",
    street_address: "Straat 3",
    city: "Utrecht",
    latitude: 52,
    longitude: 5,
    coordinate_precision: "city" as const,
  };
  assert.equal(precisePoint(r), false);
  assert.ok(
    new URL(directionsUrl(r, "walking")).searchParams
      .get("destination")
      ?.includes("Kunst & glas"),
  );
  assert.equal(
    new URL(tagHref("maker: a & b"), "https://example.test").searchParams.get(
      "tag",
    ),
    "maker: a & b",
  );
});
test("Voorkeurvragen vereisen benoemde antwoorden met echte tags", () => {
  assert.equal(
    validQuestions([
      {
        title: "Kunst?",
        description: "",
        options: [{ label: "Foto", tags: ["fotografie"] }],
      },
    ]),
    true,
  );
  assert.equal(
    validQuestions([
      {
        title: "Kunst?",
        description: "",
        options: [{ label: "Foto", tags: [] }],
      },
    ]),
    false,
  );
});
