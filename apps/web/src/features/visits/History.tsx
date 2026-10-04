import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAuth } from "../account/AuthContext.tsx";
import { CatalogActions, useVisits } from "./Visits.tsx";
import {
  appHref,
  categories,
} from "../../../../../packages/domain/src/navigation.ts";
import {
  readSavedCatalog,
  type CatalogItem,
} from "../../../../../packages/data/src/catalog.ts";
import { precisePoint } from "../../../../../packages/domain/src/presentation.ts";
const CatalogMap = lazy(() =>
  import("../catalog/Map.tsx").then((m) => ({ default: m.CatalogMap })),
);
export function History() {
  const { user, loading, client } = useAuth(),
    visits = useVisits();
  const [view, setView] = useState("list"),
    [message, setMessage] = useState(""),
    [catalog, setCatalog] = useState<CatalogItem[]>([]),
    [mapState, setMapState] = useState("");
  useEffect(() => {
    let active = true;
    if (view !== "map" || !client || !user) return;
    setMapState("Kaart laden…");
    readSavedCatalog(client, visits.rows)
      .then((rows) => {
        if (active) {
          setCatalog(rows);
          setMapState("");
        }
      })
      .catch(() => {
        if (active)
          setMapState("De kaartgegevens konden niet laden. Probeer opnieuw.");
      });
    return () => {
      active = false;
    };
  }, [view, client, user?.id, visits.rows]);
  const states = useMemo(
    () =>
      Object.fromEntries(
        visits.rows.map((r) => [
          r.category + ":" + r.item_id,
          r.status ?? "seen",
        ]),
      ),
    [visits.rows],
  );
  const points = useMemo(
    () =>
      catalog.filter((r) => states[r.category + ":" + r.id] && precisePoint(r)),
    [catalog, states],
  );
  return (
    <>
      <header className="page-heading">
        <h1>
          Gezien/te zien<span className="accent">.</span>
        </h1>
        <p>Je plannen, bezoeken en waarderingen op één plek.</p>
      </header>
      {loading ? (
        <p>Account laden…</p>
      ) : !user ? (
        <p>
          <a href={appHref("/account")}>Log in of maak een account</a> om je
          lijst op al je apparaten te bewaren.
        </p>
      ) : visits.error ? (
        <p role="alert">{visits.error}</p>
      ) : !visits.ready ? (
        <p role="status">Bezoeken laden…</p>
      ) : (
        <>
          <div className="view-toggle" role="group" aria-label="Weergave">
            <button
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              Lijst
            </button>
            <button
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              Kaart
            </button>
          </div>
          {!visits.rows.length ? (
            <p>
              Bewaar onderwerpen met ‘Hier wil ik nog heen’ of ‘Ik heb dit
              gezien’ op <a href={appHref("/agenda")}>Ontdek kunst</a>.
            </p>
          ) : view === "map" ? (
            <>
              <p className="map-legend">
                <span className="wanted-key">● Te zien</span>{" "}
                <span className="seen-key">● Gezien</span>
              </p>
              {mapState ? (
                <p role="status">{mapState}</p>
              ) : (
                <>
                  <Suspense fallback={<p>Kaart laden…</p>}>
                    <CatalogMap
                      items={points}
                      visitStates={states}
                      focusOnOpen
                    />
                  </Suspense>
                  {points.length < visits.rows.length && (
                    <p>
                      {visits.rows.length - points.length} onderwerp(en) zonder
                      actuele kaartlocatie blijven beschikbaar in je lijst.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            (["wanted", "seen"] as const).map((status) => (
              <section
                key={status}
                aria-label={status === "wanted" ? "Te zien" : "Gezien"}
              >
                <h2>{status === "wanted" ? "Te zien" : "Gezien"}</h2>
                {!visits.rows.some((r) => (r.status ?? "seen") === status) && (
                  <p>Nog geen onderwerpen.</p>
                )}
                <div className="museum-grid">
                  {visits.rows
                    .filter((r) => (r.status ?? "seen") === status)
                    .map((item) => (
                      <article
                        className="museum-card"
                        key={item.category + item.item_id}
                      >
                        <p className="eyebrow">
                          {categories.find((c) => c.id === item.category)?.name}
                        </p>
                        <h3>
                          <a
                            href={
                              appHref("/bekijk") +
                              "?categorie=" +
                              encodeURIComponent(item.category) +
                              "&id=" +
                              encodeURIComponent(item.item_id)
                            }
                          >
                            {item.name}
                          </a>
                        </h3>
                        <CatalogActions
                          id={item.item_id}
                          category={item.category}
                          name={item.name}
                        />
                        <button
                          onClick={async () => {
                            if (
                              !confirm(
                                "Dit onderwerp uit je lijst verwijderen?",
                              )
                            )
                              return;
                            try {
                              await visits.remove(item);
                            } catch (e) {
                              setMessage((e as Error).message);
                            }
                          }}
                        >
                          Verwijder uit{" "}
                          {status === "wanted" ? "Te zien" : "Gezien"}
                        </button>
                      </article>
                    ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </>
  );
}
