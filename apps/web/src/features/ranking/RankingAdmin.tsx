import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../account/AuthContext.tsx";
import { UpdateAdmin, UserAdmin } from "../management/UpdateAdmin.tsx";
import { SourceAdmin } from "../management/SourceAdmin.tsx";
import { TagAdmin } from "../management/TagAdmin.tsx";
import {
  readRankingSettings,
  saveRankingSettings,
} from "../../../../../packages/data/src/ranking.ts";
import {
  readCatalog,
  type CatalogItem,
} from "../../../../../packages/data/src/catalog.ts";
import {
  defaultRanking,
  recommendationScore,
  ratingScore,
  type RankingSettings,
} from "../../../../../packages/domain/src/ranking.ts";
import { detailHref } from "../../../../../packages/domain/src/presentation.ts";
import { useRecommendations } from "./RecommendationContext.tsx";
export function RankingAdmin() {
  const { client } = useAuth(),
    { refreshSettings } = useRecommendations();
  const [value, setValue] = useState<RankingSettings>(defaultRanking),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [ready, setReady] = useState(false),
    [ratings, setRatings] = useState<CatalogItem[]>([]),
    [ratingError, setRatingError] = useState(false);
  useEffect(() => {
    if (!client) return;
    let active = true;
    Promise.all([
      readRankingSettings(client),
      readCatalog(client, undefined, true).catch(() => {
        if (active) setRatingError(true);
        return [];
      }),
    ])
      .then(([v, rows]) => {
        if (active) {
          setValue(v);
          setRatings(rows.filter((r) => r.rating));
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setMessage("Beheer laden is niet gelukt. Herlaad de pagina.");
      });
    return () => {
      active = false;
    };
  }, [client]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!client || !value.updated_at) return;
    setSaving(true);
    try {
      setValue(await saveRankingSettings(client, value, value.updated_at));
      await refreshSettings();
      setMessage("Opgeslagen. De volgorde geldt overal.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }
  const rw = value.rating_weight ?? 0,
    prior = value.rating_prior ?? 5;
  return (
    <>
      <a href="/kunstkiezer/beheer">← Alle verzamelingen</a>
      <header className="page-heading">
        <p className="eyebrow">Redactie</p>
        <h1>
          Beheer<span className="accent">.</span>
        </h1>
        <p>Volgorde, tags, bronnen, updates en gebruikers.</p>
      </header>
      <nav className="category-grid" aria-label="Beheeronderdelen">
        {[
          ["volgorde", "Volgorde en waarderingen"],
          ["tags", "Tagbeheer"],
          ["updates", "Bronnen en updates"],
          ["gebruikers", "Gebruikers"],
        ].map(([id, label]) => (
          <a className="category-card" key={id} href={"#" + id}>
            <h2>{label}</h2>
          </a>
        ))}
      </nav>
      {!ready && !message && <p>Beheer laden…</p>}
      {message && <p role="status">{message}</p>}
      {ready && client && (
        <>
          <section id="volgorde" className="management-section">
            <form onSubmit={(e) => void save(e)}>
              <h2>Volgorde en waarderingen</h2>
              <p>
                Afstand, passende tags en waardering vormen samen 100%. Als de
                bezoeker afstand uitzet, valt dat onderdeel weg. De overige
                verhoudingen blijven hetzelfde. Zonder beoordelingen is de
                waarderingsscore neutraal (50%).
              </p>
              <div className="form-grid">
                {[
                  ["distance_weight", "Gewicht afstand (%)"],
                  ["tag_weight", "Gewicht smaak (%)"],
                  ["rating_weight", "Gewicht waardering (%)"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      required
                      value={value[key as "distance_weight"] ?? 0}
                      onChange={(e) =>
                        setValue((v) => ({
                          ...v,
                          [key!]: e.target.valueAsNumber,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <p>Totaal: {value.distance_weight + value.tag_weight + rw}%</p>
              <div className="form-grid">
                <label>
                  Afstandsbereik (km)
                  <input
                    type="number"
                    min="1"
                    max="500"
                    required
                    value={value.distance_scale_km}
                    onChange={(e) =>
                      setValue((v) => ({
                        ...v,
                        distance_scale_km: e.target.valueAsNumber,
                      }))
                    }
                  />
                </label>
                <label>
                  Neutrale beginstemmen
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={prior}
                    onChange={(e) =>
                      setValue((v) => ({
                        ...v,
                        rating_prior: e.target.valueAsNumber,
                      }))
                    }
                  />
                </label>
              </div>
              <p>
                Een kleiner afstandsbereik geeft meer voorrang aan dichtbij.
                Neutrale beginstemmen voorkomen dat enkele enthousiaste of
                negatieve stemmen de hele lijst bepalen. Meer beginstemmen
                betekent een voorzichtiger invloed.
              </p>
              <div className="ranking-preview">
                <h3>Zo telt de waardering mee</h3>
                <p>
                  1 ★ = 0%, 2 ★ = 25%, 3 ★ = 50%, 4 ★ = 75%, 5 ★ = 100%. We
                  berekenen het gewogen gemiddelde van alle stemmen en mengen
                  dit met {prior} neutrale beginstemmen. Pas vanaf drie
                  verschillende accounts wordt de gezamenlijke verdeling
                  gebruikt; namen en individuele bezoeken blijven privé.
                </p>
                <p>
                  De bijdrage aan de totaalscore is maximaal {rw} punten. Een
                  onderwerp met alleen lage sterren zakt ten opzichte van een
                  neutraal onderwerp; hoge sterren geven juist voordeel.
                </p>
                <h3>Voorbeeld bij zes voorkeurstags en neutrale waardering</h3>
                <p>
                  10 km · 1 passende tag:{" "}
                  {(recommendationScore(1, 6, 10, value) + rw * 0.5).toFixed(1)}{" "}
                  punten
                </p>
                <p>
                  250 km · 6 passende tags:{" "}
                  {(recommendationScore(6, 6, 250, value) + rw * 0.5).toFixed(
                    1,
                  )}{" "}
                  punten
                </p>
              </div>
              <button className="primary-button" disabled={saving}>
                Instellingen opslaan
              </button>
            </form>
            <h3>Gezamenlijke waarderingen</h3>
            {ratingError ? (
              <p>
                De waarderingen konden niet worden geladen. Herlaad de pagina.
              </p>
            ) : !ratings.length ? (
              <p>
                Er zijn nog geen onderwerpen met minstens drie beoordelingen.
              </p>
            ) : (
              <div className="table-scroll">
                <table className="rating-table">
                  <thead>
                    <tr>
                      <th>Onderwerp</th>
                      <th>Aantal</th>
                      <th>Verdeling 1–5 ★</th>
                      <th>Gewogen score</th>
                      <th>Bijdrage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratings.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <a href={detailHref(r)}>{r.name}</a>
                        </td>
                        <td>{r.rating!.votes}</td>
                        <td>
                          {r
                            .rating!.stars.map(
                              (n, i) =>
                                `${i + 1}★ ${Math.round((n / r.rating!.votes) * 100)}%`,
                            )
                            .join(" · ")}
                        </td>
                        <td>
                          {(ratingScore(r.rating, prior) * 100).toFixed(1)}%
                        </td>
                        <td>
                          {(ratingScore(r.rating, prior) * rw).toFixed(1)} /{" "}
                          {rw}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div id="tags">
            <TagAdmin />
          </div>
          <section id="updates">
            <SourceAdmin client={client} />
            <UpdateAdmin />
          </section>
          <section id="gebruikers">
            <UserAdmin />
          </section>
        </>
      )}
    </>
  );
}
