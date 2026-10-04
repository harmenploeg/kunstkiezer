import { test, expect, type Page } from "@playwright/test";
const base = {
  city: "Utrecht",
  province: "Utrecht",
  street_address: "Teststraat 1",
  postal_code: "",
  website_url: "",
  summary: "Beelden in een groene tuin. Raadpleeg de bron. Nog te bevestigen.",
  creator: "Maker Eén",
  year: "2026",
  photos: [],
  sources: [],
  selection_reason: "Controleer het adres.",
  visit_notes: "Toegang gratis. Controleer voor vertrek.",
  operating_status: "open",
  publication_status: "published",
  latitude: 52.1,
  longitude: 5.1,
  coordinate_precision: "exact",
  starts_on: "2026-01-01",
  ends_on: "2099-01-01",
  tags: ["beeldhouwkunst", "maker: maker één"],
};
const museums = [
  {
    ...base,
    id: "10000000-0000-4000-8000-000000000001",
    name: "Museum Eén",
    category: "musea",
    is_art_museum: true,
  },
];
const discoveries = [
  {
    ...base,
    id: "10000000-0000-4000-8000-000000000002",
    name: "Beeldentuin Eén",
    category: "beeldenparken",
    latitude: 52.2,
  },
  {
    ...base,
    id: "10000000-0000-4000-8000-000000000003",
    name: "Stadsbeeld",
    category: "openbare-kunst",
    latitude: 52.3,
    coordinate_precision: "city",
  },
  {
    ...base,
    id: "10000000-0000-4000-8000-000000000004",
    name: "Zonder dezelfde tag",
    category: "architectuur",
    tags: ["modernisme"],
    latitude: 52.4,
  },
];
async function setup(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      "kunstkiezer.profile.v1",
      JSON.stringify({ version: 1, completed: true, tags: ["beeldhouwkunst"] }),
    ),
  );
  await page.route("**/kunstkiezer/api/config", (r) =>
    r.fulfill({
      json: {
        APP_ENV: "production",
        PUBLIC_SUPABASE_URL: "https://catalog-test.supabase.co",
        PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      },
    }),
  );
  await page.route("https://catalog-test.supabase.co/**", async (route) => {
    const u = new URL(route.request().url()),
      headers = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,OPTIONS",
      };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    let data: unknown = [];
    if (u.pathname.endsWith("/kk_ranking_settings"))
      data = {
        distance_weight: 56,
        tag_weight: 24,
        rating_weight: 20,
        rating_prior: 0,
        distance_scale_km: 30,
      };
    if (u.pathname.endsWith("/kk_rating_totals"))
      data = [
        {
          item_id: "10000000-0000-4000-8000-000000000001",
          category: "musea",
          votes: 3,
          stars: [3, 0, 0, 0, 0],
        },
        {
          item_id: "10000000-0000-4000-8000-000000000002",
          category: "beeldenparken",
          votes: 3,
          stars: [0, 0, 0, 0, 3],
        },
      ];
    if (
      u.pathname.endsWith("/kk_museums") ||
      u.pathname.endsWith("/kk_discoveries")
    ) {
      let rows = u.pathname.endsWith("/kk_museums") ? museums : discoveries;
      const category = u.searchParams.get("category")?.slice(3);
      if (category) rows = rows.filter((x) => x.category === category);
      const id = u.searchParams.get("id")?.slice(3);
      data = id ? rows.find((x) => x.id === id) : rows;
    }
    return route.fulfill({ headers, json: data });
  });
}
test("Tags zoeken over alle categorieën, waardering sorteert, interne tekst blijft weg", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/kunstkiezer/agenda/musea");
  await page.getByRole("link", { name: "beeldhouwkunst", exact: true }).click();
  await expect(page).toHaveURL(/tag=beeldhouwkunst/);
  await expect(page.locator(".museum-card")).toHaveCount(3);
  await expect(page.locator(".museum-card h2").first()).toContainText(
    "Beeldentuin Eén",
  );
  await expect(page.locator(".museum-card h2").last()).toContainText(
    "Museum Eén",
  );
  await expect(
    page.getByText(/Raadpleeg|Nog te bevestigen|Controleer|hemelsbreed/),
  ).toHaveCount(0);
  await expect(page.locator(".subject-kind").first()).toContainText(
    "Beeldentuin",
  );
});
test("Kaart toont precieze stippen, popup opent onderwerp met vier navigatiekeuzes", async ({
  page,
  isMobile,
}) => {
  await setup(page);
  await page.goto("/kunstkiezer/agenda?tag=beeldhouwkunst");
  await page.getByRole("button", { name: "Kaart", exact: true }).click();
  await expect(page.getByText(/2 locaties op de kaart/)).toBeVisible();
  const marker = page.getByRole("button", {
    name: "Beeldentuin Eén",
    exact: true,
  });
  await expect(marker).toBeVisible();
  if (!isMobile) {
    await marker.hover();
    await expect(page.locator(".leaflet-tooltip")).toHaveText(
      "Beeldentuin Eén",
    );
  }
  await marker.click();
  await expect(page.locator(".leaflet-popup")).toBeVisible();
  await page
    .locator(".leaflet-popup")
    .getByRole("link", { name: "Beeldentuin Eén →" })
    .click();
  await expect(page).toHaveURL(
    /categorie=beeldenparken&id=10000000-0000-4000-8000-000000000002/,
  );
  await expect(
    page.getByRole("heading", { name: "Beeldentuin Eén", exact: true }),
  ).toBeVisible();
  for (const mode of ["driving", "transit", "bicycling", "walking"])
    await expect(page.locator(`a[href*="travelmode=${mode}"]`)).toHaveCount(1);
  await expect(page.locator(".catalog-map")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 15000,
  });
  await page.screenshot({
    path: `work/catalog-review/detail-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("Dubbelklik op stip opent het onderwerp rechtstreeks", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/kunstkiezer/agenda/musea");
  await page.getByRole("button", { name: "Kaart", exact: true }).click();
  await page
    .getByRole("button", { name: "Museum Eén", exact: true })
    .dblclick();
  await expect(page).toHaveURL(
    /categorie=musea&id=10000000-0000-4000-8000-000000000001/,
  );
});
