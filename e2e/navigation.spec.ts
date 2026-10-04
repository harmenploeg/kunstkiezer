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

test('Categorieknoppen geven directe toegang en markeren de huidige optie zonder horizontale overflow',async({page})=>{
 await page.goto('/kunstkiezer/agenda/musea');
 const nav=page.getByRole('navigation',{name:'Kies een categorie'});
 await expect(nav.getByRole('link')).toHaveCount(5);
 await expect(nav.getByRole('link',{name:'Musea',exact:true})).toHaveAttribute('aria-current','page');
 await nav.getByRole('link',{name:'Kunst in de openbare ruimte',exact:true}).click();
 await expect(nav.getByRole('link',{name:'Kunst in de openbare ruimte',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('link',{name:'Alle categorieën'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:`work/catalog-review/categories-${test.info().project.name}.png`});
});

 test('Vier vaste hoofdkeuzes naast elkaar en inloggen bovenaan, ook op smal scherm',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await page.goto('/kunstkiezer/');
  const nav=page.getByRole('navigation',{name:'Hoofdnavigatie'});
  await expect(nav.getByRole('link')).toHaveText(['Mijn kunstkeuze','Ontdek kunst','Gezien','Mijn profiel']);
  await expect(nav.getByRole('link',{name:'Mijn kunstkeuze'})).toHaveAttribute('aria-current','page');
  await expect(page.getByRole('banner').getByRole('link',{name:'Inloggen',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Loci Amsterdam/})).toHaveCount(0);
  const tops=await nav.getByRole('link').evaluateAll(nodes=>nodes.map(n=>Math.round(n.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('banner').getByRole('link',{name:'Inloggen',exact:true}).click();
  await expect(page).toHaveURL(/\/account$/);
 });
