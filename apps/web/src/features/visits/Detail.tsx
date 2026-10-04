import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { getClient } from "../../../../../packages/data/src/client.ts";
import {
  appHref,
  categories,
} from "../../../../../packages/domain/src/navigation.ts";
import {
  amsterdamDay,
  monthAhead,
} from "../../../../../packages/data/src/discovery.ts";
import { safeWebUrl } from "../../../../../packages/data/src/museums.ts";
import type { CatalogItem } from "../../../../../packages/data/src/catalog.ts";
import {
  directionsUrl,
  precisePoint,
  visitorText,
} from "../../../../../packages/domain/src/presentation.ts";
import { Kind, Photos, Tags } from "../catalog/Card.tsx";
import { CatalogActions } from "./Visits.tsx";
const CatalogMap = lazy(() =>
  import("../catalog/Map.tsx").then((m) => ({ default: m.CatalogMap })),
);
export function Detail() {
  const params = new URLSearchParams(location.search),
    category = params.get("categorie") ?? "",
    id = params.get("id") ?? "";
  const [item, setItem] = useState<CatalogItem | null>(null),
    [message, setMessage] = useState("Onderwerp laden…");
  const points = useMemo(() => (item ? [item] : []), [item]);
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
          .eq("publication_status", "published")
          .eq("operating_status", "open");
        if (category !== "musea") q = q.eq("category", category);
        else q = q.eq("is_art_museum", true);
        if (category === "evenementen")
          q = q
            .gte("ends_on", amsterdamDay())
            .lte("starts_on", monthAhead(amsterdamDay()));
        const r = await q.maybeSingle();
        if (active) {
          setItem(r.data ? { ...r.data, category } : null);
          setMessage(
            r.error
              ? "Laden is niet gelukt. Probeer opnieuw."
              : r.data
                ? ""
                : "Dit onderwerp is niet meer beschikbaar.",
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
          <Kind item={item} />
          <p className="eyebrow">{item.city}</p>
          <h1>{item.name}</h1>
          {item.creator && <p>{item.creator}</p>}
          {item.operating_status === "temporarily_closed" && (
            <p>Tijdelijk gesloten</p>
          )}
          <Photos item={item} />
          <p>{visitorText(item.summary)}</p>
          <p>{item.street_address}</p>
          {"visit_notes" in item && visitorText(item.visit_notes) && (
            <p>{visitorText(item.visit_notes)}</p>
          )}
          <Tags tags={item.tags} />
          {safeWebUrl(item.website_url) && (
            <p>
              <a
                href={item.website_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Website ↗
              </a>
            </p>
          )}
          <section aria-label="Plan je bezoek">
            <h2>Plan je bezoek</h2>
            {precisePoint(item) && (
              <Suspense fallback={<p>Kaart laden…</p>}>
                <CatalogMap items={points} compact />
              </Suspense>
            )}
            <p>
              {item.street_address}
              {item.city && `, ${item.city}`}
            </p>
            <div className="navigation-choices">
              {[
                ["driving", "Auto"],
                ["transit", "Ov"],
                ["bicycling", "Fiets"],
                ["walking", "Lopen"],
              ].map(([mode, label]) => (
                <a
                  key={mode}
                  href={directionsUrl(item, mode!)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label} ↗
                </a>
              ))}
            </div>
          </section>
          <CatalogActions id={item.id} category={category} name={item.name} />
        </article>
      )}
    </>
  );
}
