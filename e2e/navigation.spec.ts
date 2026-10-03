import { expect, test } from "@playwright/test";

test("Mijn kunstkeuze, categorieën en bezoekgeschiedenis zijn bereikbaar", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/kunstkiezer/");
  await expect(page.getByRole("heading", { name: "Mijn kunstkeuze." })).toBeVisible();
  await expect(page.getByRole("group", {name:/Welke kunst trekt je aandacht/})).toBeVisible();
  await page.screenshot({ path: `/tmp/kunstkiezer-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole("link", { name: "Ontdek kunst", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ontdek kunst." })).toBeVisible();
  await page.getByRole("link", { name: /Musea Collecties/ }).click();
  await expect(page.getByRole("heading", { name: "Musea." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Musea." })).toBeVisible();
  await page.getByRole("link", { name: "Gezien", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Gezien." })).toBeVisible();
  expect(await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("routebegrenzing, redirect en health werken in de echte Worker-runtime", async ({ request }) => {
  expect((await request.get("/")).status()).toBe(404);
  const redirect = await request.get("/kunstkiezer?source=test", { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toBe("http://127.0.0.1:8790/kunstkiezer/?source=test");
  expect(await (await request.get("/kunstkiezer/api/health")).json()).toEqual({ status: "ok", service: "kunstkiezer-api" });
  expect((await request.get("/kunstkiezer/unknown")).status()).toBe(404);
});
