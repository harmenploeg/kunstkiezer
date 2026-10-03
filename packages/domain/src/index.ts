/** Een item is iedere culturele keuze, ook zonder fysieke locatie. */
export interface CulturalItem {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  status: "draft" | "published" | "archived";
}

/** Categorieën zijn gegevens, geen vaste opsomming in de code. */
export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface SiteConfiguration {
  id: string;
  slug: string;
  title: string;
  categoryIds: readonly string[];
}

export type ChoiceIntent = "appreciate" | "want_to_experience" | "experienced";

/** De server ontleent userId aan de geverifieerde sessie. */
export interface UserChoice {
  userId: string;
  itemId: string;
  savedAt: string;
  intent: ChoiceIntent | null;
  contributesToProfile: boolean;
}
