export const BASE_PATH = "/kunstkiezer";

export const navigation = [
  { path: "/", label: "Mijn kunstkeuze" },
  { path: "/agenda", label: "Ontdek kunst" },
  { path: "/geschiedenis", label: "Gezien" },
  { path: "/profiel", label: "Mijn profiel" },
] as const;

/** Basisconfiguratie; vervangbaar door categoriegegevens uit Supabase. */
export const categories = [
  { id: "musea", name: "Musea", description: "Collecties, tentoonstellingen en activiteiten." },
  { id: "openbare-kunst", name: "Kunst in de openbare ruimte", description: "Beelden, installaties en kunst op straat." },
  { id: "beeldenparken", name: "Beeldenparken en beeldentuinen", description: "Kunst ontdekken tussen bomen, tuinen en landschap." },
  { id: "architectuur", name: "Bijzondere architectuur", description: "Gebouwen, interieurs en plekken om anders naar te kijken." },
  { id: "evenementen", name: "Tentoonstellingen en evenementen", description: "Wat is er vandaag, dit weekend en binnenkort te doen?" },
] as const;

export function appHref(path: string): string {
  return `${BASE_PATH}${path}`;
}

export function isPagePath(path: string): boolean {
  return path === "/beheer" || categories.some(c=>path===`/beheer/${c.id}`) || navigation.some((entry) => entry.path === path)
    || categories.some((category) => path === `/agenda/${category.id}`);
}
