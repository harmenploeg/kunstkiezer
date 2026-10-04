import type { SupabaseClient } from "@supabase/supabase-js";
export interface TagDefinition {
  label: string;
  dimension: string;
  description: string;
  enabled: boolean;
  updated_at: string;
}
export interface PreferenceQuestion {
  title: string;
  description: string;
  options: { label: string; tags: string[] }[];
}
export function validQuestions(input: unknown): input is PreferenceQuestion[] {
  return (
    Array.isArray(input) &&
    input.length <= 30 &&
    input.every(
      (q) =>
        typeof q?.title === "string" &&
        q.title.trim().length > 0 &&
        q.title.length <= 200 &&
        typeof q.description === "string" &&
        q.description.length <= 500 &&
        Array.isArray(q.options) &&
        q.options.length > 0 &&
        q.options.length <= 40 &&
        q.options.every(
          (o: PreferenceQuestion["options"][number]) =>
            typeof o?.label === "string" &&
            o.label.trim().length > 0 &&
            o.label.length <= 150 &&
            Array.isArray(o.tags) &&
            o.tags.length > 0 &&
            o.tags.length <= 30 &&
            o.tags.every(
              (t) =>
                typeof t === "string" && t.trim().length > 0 && t.length <= 120,
            ),
        ),
    )
  );
}
export async function readTaxonomy(c: SupabaseClient) {
  const tags: TagDefinition[] = [];
  for (let from = 0; ; from += 500) {
    const r = await c
      .from("kk_tags")
      .select("*")
      .order("label")
      .range(from, from + 499);
    if (r.error) throw Error("Tags konden niet worden geladen.");
    tags.push(...r.data);
    if (r.data.length < 500) break;
  }
  const q = await c
    .from("kk_preference_questions")
    .select("questions,updated_at")
    .eq("id", 1)
    .single();
  if (q.error || !validQuestions(q.data?.questions))
    throw Error("De voorkeurvragen konden niet worden geladen.");
  return {
    tags,
    questions: q.data.questions,
    version: q.data.updated_at as string,
  };
}
