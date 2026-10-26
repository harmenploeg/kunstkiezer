// Sinds systeemaudit stap 1.3 (oktober 2026) draait de Kunstkiezer op een eigen subdomein,
// kunstkiezer.loci-amsterdam.nl, en dus aan de wortel. Daarvoor stond hij onder
// www.loci-amsterdam.nl/kunstkiezer, dat nu doorverwijst.
export const BASE_PATH = "";

export const navigation = [
  { path: "/kunstkeuze", label: "Mijn kunstkeuze" },
  { path: "/agenda", label: "Ontdek kunst" },
  { path: "/geschiedenis", label: "Gezien/te zien" },
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
  return ["/","/account","/account-verwijderen","/bekijk"].includes(path) || path === "/beheer/instellingen" || path === "/beheer/volgorde" || path === "/beheer" || categories.some(c=>path===`/beheer/${c.id}`) || navigation.some((entry) => entry.path === path)
    || categories.some((category) => path === `/agenda/${category.id}`);
}
