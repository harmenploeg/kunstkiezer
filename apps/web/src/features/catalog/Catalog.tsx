import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { amsterdamDay } from "../../../../../packages/data/src/discovery.ts";
import { getClient } from "../../../../../packages/data/src/client.ts";
import {
  readCatalog,
  type CatalogItem,
} from "../../../../../packages/data/src/catalog.ts";
import { provinces } from "../../../../../packages/data/src/museums.ts";
import { rankRecommendations } from "../../../../../packages/domain/src/ranking.ts";
import { precisePoint } from "../../../../../packages/domain/src/presentation.ts";
import { useProfile } from "../profile/useProfile.ts";
import { useRecommendations } from "../ranking/RecommendationContext.tsx";
import { CatalogCard } from "./Card.tsx";
const CatalogMap = lazy(() =>
  import("./Map.tsx").then((m) => ({ default: m.CatalogMap })),
);
export function Catalog({
  category,
  tag = "",
}: {
  category?: string;
  tag?: string;
}) {
  const profile = useProfile(),
    recommendations = useRecommendations();
  const [day, setDay] = useState(amsterdamDay);
  useEffect(() => {
    const timer = setInterval(() => setDay(amsterdamDay()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [rows, setRows] = useState<CatalogItem[]>([]),
    [search, setSearch] = useState(""),
    [province, setProvince] = useState(""),
    [page, setPage] = useState(0),
    [view, setView] = useState("list"),
    [status, setStatus] = useState("Kunst laden…");
  useEffect(() => {
    let active = true;
    const load = () =>
      getClient()
        .then((c) => readCatalog(c, category))
        .then((r) => {
          if (active) {
            setRows(r);
            setStatus("");
          }
        })
        .catch(() => {
          if (active)
            setStatus(
              "Laden is niet gelukt. Probeer de pagina opnieuw te laden.",
            );
        });
    void load();
    window.addEventListener("kunstkiezer-ratings", load);
    return () => {
      active = false;
      window.removeEventListener("kunstkiezer-ratings", load);
    };
  }, [category, day]);
  const sorted = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("nl-NL");
    const selected = rows.filter(
      (r) =>
        (!province || r.province === province) &&
        (!tag ||
          r.tags.some(
            (t) =>
              t.toLocaleLowerCase("nl-NL") === tag.toLocaleLowerCase("nl-NL"),
          )) &&
        (!needle ||
          [r.name, r.city, r.creator ?? ""]
            .join(" ")
            .toLocaleLowerCase("nl-NL")
            .includes(needle)),
    );
    return rankRecommendations(
      selected,
      profile.tags,
      recommendations.enabled ? recommendations.location : null,
      recommendations.settings,
    );
  }, [
    rows,
    search,
    province,
    tag,
    profile.tags,
    recommendations.location,
    recommendations.enabled,
    recommendations.settings,
  ]);
  useEffect(
    () => setPage(0),
    [
      search,
      province,
      tag,
      profile.tags,
      recommendations.location,
      recommendations.settings,
    ],
  );
  const onMap = sorted.filter(precisePoint).length;
  return (
    <section aria-label="Kunstaanbod">
      <div className="view-choices" aria-label="Weergave">
        <button aria-pressed={view === "list"} onClick={() => setView("list")}>
          Lijst
        </button>
        <button aria-pressed={view === "map"} onClick={() => setView("map")}>
          Kaart
        </button>
      </div>
      <div className="filters">
        <label>
          Zoek op naam, maker of plaats
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Provincie
          <select
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            <option value="">Heel Nederland</option>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
      {category === "evenementen" && (
        <p>Nu te zien en wat er de komende maand begint.</p>
      )}
      <p role="status">{status || `${sorted.length} resultaten`}</p>
      {!status && view === "map" && (
        <>
          <p>
            {onMap} locaties op de kaart. Wijs een stip aan voor de naam; tik
            voor de pop-up of dubbelklik om te openen.
          </p>
          <Suspense fallback={<p>Kaart laden…</p>}>
            <CatalogMap items={sorted} />
          </Suspense>
          {onMap < sorted.length && (
            <p>Het overige aanbod vind je in de lijst.</p>
          )}
        </>
      )}
      {!status && view === "list" && (
        <>
          <div className="museum-grid">
            {sorted.slice(page * 30, page * 30 + 30).map((r) => (
              <CatalogCard
                key={r.category + r.id}
                item={r}
                preferences={profile.tags}
              />
            ))}
          </div>
          {!sorted.length && <p>Geen resultaten voor deze selectie.</p>}
          {sorted.length > 30 && (
            <div className="pagination">
              <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
                Vorige
              </button>
              <span>
                Pagina {page + 1} van {Math.ceil(sorted.length / 30)}
              </span>
              <button
                disabled={(page + 1) * 30 >= sorted.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Volgende
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
