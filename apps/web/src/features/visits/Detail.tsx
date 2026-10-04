import { useEffect, useState } from "react";
import { getClient } from "../../../../../packages/data/src/client.ts";
import {
  appHref,
  categories,
} from "../../../../../packages/domain/src/navigation.ts";
import {
  safeWebUrl,
  type Museum,
} from "../../../../../packages/data/src/museums.ts";
import { CatalogActions } from "./Visits.tsx";
export function Detail() {
  const params = new URLSearchParams(location.search),
    category = params.get("categorie") ?? "",
    id = params.get("id") ?? "";
  const [item, setItem] = useState<Museum | null>(null),
    [message, setMessage] = useState("Onderwerp laden…");
  useEffect(() => {
    let active = true;
    if (
      !categories.some((c) => c.id === category) ||
      !/^[-a-f0-9]{36}$/i.test(id)
    ) {
      setMessage("Deze link is niet geldig.");
      return;
    }
    getClient()
      .then(async (c) => {
        let q = c
          .from(category === "musea" ? "kk_museums" : "kk_discoveries")
          .select("*")
          .eq("id", id)
          .eq("publication_status", "published");
        if (category !== "musea") q = q.eq("category", category);
        const { data, error } = await q.maybeSingle();
        if (active) {
          setItem(data);
          setMessage(
            error
              ? "Laden is niet gelukt. Probeer opnieuw."
              : data
                ? ""
                : "Dit onderwerp is niet meer beschikbaar. Een tentoonstelling kan inmiddels afgelopen zijn.",
          );
        }
      })
      .catch(() => {
        if (active) setMessage("Geen verbinding. Probeer opnieuw.");
      });
    return () => {
      active = false;
    };
  }, [category, id]);
  return (
    <>
      <a
        href={appHref(
          "/agenda/" +
            (categories.some((c) => c.id === category) ? category : ""),
        )}
      >
        ← Ontdek kunst
      </a>
      {message && <p role="status">{message}</p>}
      {item && (
        <article className="museum-card">
          <p className="eyebrow">{item.city}</p>
          <h1>{item.name}</h1>
          <div className="museum-photos">
            {item.photos
              .filter((p) => safeWebUrl(p.url))
              .map((p, i) => (
                <figure key={i}>
                  <img src={p.url} alt={p.caption || item.name} />
                  <figcaption>
                    {p.caption} · {p.credit}{" "}
                    {safeWebUrl(p.source_url) && (
                      <a
                        href={p.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {p.license || "Bron"}
                      </a>
                    )}
                  </figcaption>
                </figure>
              ))}
          </div>
          <p>{item.summary}</p>
          <p>{item.street_address}</p>
          <div className="tag-list">
            {item.tags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          {safeWebUrl(item.website_url) && (
            <p>
              <a
                href={item.website_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Bezoekinformatie ↗
              </a>
            </p>
          )}
          <CatalogActions id={item.id} category={category} name={item.name} />
        </article>
      )}
    </>
  );
}
