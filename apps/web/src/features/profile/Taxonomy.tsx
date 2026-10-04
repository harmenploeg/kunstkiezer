import { useEffect, useState } from "react";
import { getClient } from "../../../../../packages/data/src/client.ts";
import {
  readTaxonomy,
  type PreferenceQuestion,
  type TagDefinition,
} from "../../../../../packages/data/src/taxonomy.ts";
import { preferenceQuestions } from "../../../../../packages/domain/src/profile.ts";
import { catalogueTags } from "../../../../../packages/domain/src/catalogue-tags.ts";
export function useTaxonomy() {
  const [data, setData] = useState<{
    questions: readonly PreferenceQuestion[];
    tags: TagDefinition[];
  }>({
    questions: preferenceQuestions as unknown as PreferenceQuestion[],
    tags: catalogueTags.map((label) => ({
      label,
      dimension: "onderwerp",
      description: "",
      enabled: true,
      updated_at: "",
    })),
  });
  useEffect(() => {
    let active = true;
    getClient()
      .then(readTaxonomy)
      .then((v) => {
        if (active) {
          const enabled = new Set(
            v.tags.filter((t) => t.enabled).map((t) => t.label),
          );
          setData({
            ...v,
            questions: v.questions
              .map((q) => ({
                ...q,
                options: q.options
                  .map((o) => ({
                    ...o,
                    tags: o.tags.filter((t) => enabled.has(t)),
                  }))
                  .filter((o) => o.tags.length),
              }))
              .filter((q) => q.options.length),
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return data;
}
