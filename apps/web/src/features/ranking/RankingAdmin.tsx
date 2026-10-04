import { useAuth } from "../account/AuthContext.tsx";
import { UpdateAdmin, UserAdmin } from "../management/UpdateAdmin.tsx";
import { SourceAdmin } from "../management/SourceAdmin.tsx";
import { useEffect, useState, type FormEvent } from "react";
import {
  readRankingSettings,
  saveRankingSettings,
} from "../../../../../packages/data/src/ranking.ts";
import {
  defaultRanking,
  recommendationScore,
  type RankingSettings,
} from "../../../../../packages/domain/src/ranking.ts";
import { useRecommendations } from "./RecommendationContext.tsx";
export function RankingAdmin() {
  const { client } = useAuth();
  const [value, setValue] = useState<RankingSettings>(defaultRanking),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false),
    [mode, setMode] = useState("loading");
  const { refreshSettings } = useRecommendations();
  useEffect(() => {
    let active = true;
    if (client)
      readRankingSettings(client)
        .then((v) => {
          if (active) {
            setValue(v);
            setMode("editor");
          }
        })
        .catch(() => {
          if (active) {
            setMode("error");
            setMessage(
              "Instellingen konden niet worden geladen. Herlaad de pagina.",
            );
          }
        });
    return () => {
      active = false;
    };
  }, [client]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!client || !value.updated_at) return;
    setSaving(true);
    setMessage("");
    try {
      setValue(await saveRankingSettings(client, value, value.updated_at));
      await refreshSettings();
      setMessage(
        "Opgeslagen. Deze instellingen gelden voor alle vijf categorieën.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }
  const near = recommendationScore(1, 6, 10, value),
    far = recommendationScore(6, 6, 250, value);
  return (
    <>
      <a className="back-link" href="/kunstkiezer/beheer">
        ← Alle verzamelingen
      </a>
      <header className="page-heading">
        <p className="eyebrow">Redactie</p>
        <h1>
          Beheer<span className="accent">.</span>
        </h1>
        <p>
          Beheer de weging van afstand en tags en de updatebronnen, het schema
          en de gebruikers.
        </p>
      </header>
      {mode === "loading" && <p role="status">Instellingen laden…</p>}
      {mode === "editor" && (
        <form className="ranking-form" onSubmit={(e) => void save(e)}>
          <h2>Afstand en smaak</h2>
          <p>
            Afstand en smaak vormen samen 100%. De bezoeker kan afstand altijd
            uitzetten. Dan tellen alleen passende tags mee.
          </p>
          <div className="form-grid">
            <label>
              Gewicht afstand (%)
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={value.distance_weight}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  setValue((v) => ({
                    ...v,
                    distance_weight: n,
                    tag_weight: 100 - n,
                  }));
                  setMessage("");
                }}
              />
            </label>
            <label>
              Gewicht smaak (%)
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                required
                value={value.tag_weight}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  setValue((v) => ({
                    ...v,
                    tag_weight: n,
                    distance_weight: 100 - n,
                  }));
                  setMessage("");
                }}
              />
            </label>
          </div>
          <label>
            Afstandsbereik (km)
            <input
              type="number"
              min="1"
              max="500"
              step="1"
              required
              value={value.distance_scale_km}
              onChange={(e) => {
                setValue((v) => ({
                  ...v,
                  distance_scale_km: e.target.valueAsNumber,
                }));
                setMessage("");
              }}
            />
          </label>
          <p className="muted">
            Op deze afstand is de afstandsscore gehalveerd. Een kleiner bereik
            geeft meer voorrang aan plekken dichtbij. Afstanden zijn
            hemelsbreed; adressen en plaatsen kunnen een schatting opleveren.
          </p>
          <div className="ranking-preview" aria-live="polite">
            <h3>Voorbeeld bij zes voorkeurstags</h3>
            <p>
              10 km · 1 passende tag: <strong>{near.toFixed(1)} punten</strong>
            </p>
            <p>
              250 km · 6 passende tags: <strong>{far.toFixed(1)} punten</strong>
            </p>
            <p>
              <strong>
                {near === far
                  ? "Beide krijgen dezelfde score."
                  : near > far
                    ? "De plek op 10 km komt bovenaan."
                    : "De plek op 250 km komt bovenaan."}
              </strong>
            </p>
          </div>
          <button className="primary-button" disabled={saving}>
            {saving ? "Opslaan…" : "Instellingen opslaan"}
          </button>
        </form>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {mode === "editor" && client && (
        <>
          <SourceAdmin client={client} />
          <UpdateAdmin />
          <UserAdmin />
        </>
      )}
    </>
  );
}
