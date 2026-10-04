import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deleteUpdateSource,
  listUpdateSources,
  saveUpdateSource,
  type UpdateSource,
  type UpdateSourceInput,
} from "../../../../../packages/data/src/update-sources.ts";
const blank: UpdateSourceInput = {
  name: "",
  url: "",
  notes: "",
  enabled: true,
};
export function SourceAdmin({ client }: { client: SupabaseClient }) {
  const [rows, setRows] = useState<UpdateSource[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [selected, setSelected] = useState<UpdateSource | null>(null),
    [draft, setDraft] = useState<UpdateSourceInput | null>(null),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const form = useRef<HTMLFormElement>(null),
    name = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    listUpdateSources(client)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client]);
  useEffect(() => {
    if (draft) {
      form.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      name.current?.focus({ preventScroll: true });
    }
  }, [selected, draft === null]);
  function choose(row: UpdateSource | null) {
    if (draft && !window.confirm("Niet-opgeslagen wijzigingen verlaten?"))
      return;
    setSelected(row);
    setDraft(
      row
        ? {
            name: row.name,
            url: row.url,
            notes: row.notes,
            enabled: row.enabled,
          }
        : blank,
    );
    setError("");
    setMessage("");
    setConfirmDelete(false);
  }
  async function reload() {
    if (
      draft &&
      !window.confirm("Niet-opgeslagen wijzigingen verlaten en opnieuw laden?")
    )
      return;
    setLoading(true);
    try {
      setRows(await listUpdateSources(client));
      setDraft(null);
      setSelected(null);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await saveUpdateSource(client, draft, selected);
      setRows((old) =>
        [...old.filter((r) => r.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name, "nl"),
        ),
      );
      setSelected(null);
      setDraft(null);
      setMessage("Bron opgeslagen. De volgende update gebruikt deze lijst.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await deleteUpdateSource(client, selected);
      setRows((old) => old.filter((r) => r.id !== selected.id));
      setDraft(null);
      setSelected(null);
      setConfirmDelete(false);
      setMessage("Bron verwijderd uit de update.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="source-admin" aria-labelledby="sources-heading">
      <h2 id="sources-heading">Bronnen voor de update</h2>
      <p>
        Bij iedere update worden actieve bronnen gebruikt voor alle vijf opties
        en toekomstige categorieën. Een bron kan meerdere soorten kunstaanbod
        opleveren.
      </p>
      <p>
        Voeg een website toe, of beschrijf waar gezocht moet worden.
        Uitschakelen bewaart een bron voor later. Wijzigingen gelden vanaf de
        volgende update.
      </p>
      <p>Wekelijkse controle: krantenrecensies uit de laatste 28 dagen; websites en Instagram op nieuwe inhoud sinds de vorige geslaagde controle, met minimaal 7 dagen overlap. Een onleesbare bron wordt als beperkt of geblokkeerd gemeld, nooit als volledig gecontroleerd.</p>
      <details><summary>Selectie van monumentale openbare kunst</summary><p>We zoeken per provincie in gemeentelijke collecties, landschapskunst, kunstenaarsarchieven en opdrachten voor publieke gebouwen. Grootte alleen is niet voldoende: ook artistieke betekenis, relatie met de plek en herkenbaarheid tellen mee. Elke toevoeging krijgt een onderbouwde selectie en actuele locatiecontrole. Maximaal 1000 werken; ook kleinere gemeenten en het buitengebied worden meegenomen.</p></details>
      <div className="source-actions">
        <button disabled={busy || loading} onClick={() => choose(null)}>
          Bron toevoegen
        </button>
        <button disabled={busy || loading} onClick={() => void reload()}>
          Bronnen opnieuw laden
        </button>
      </div>
      {loading ? (
        <p role="status">Bronnen laden…</p>
      ) : (
        <>
          <p>
            {rows.filter((r) => r.enabled).length} actieve bronnen ·{" "}
            {rows.length} totaal
          </p>
          <div className="source-list">
            {rows.map((r) => (
              <button
                className="museum-row"
                key={r.id}
                disabled={busy}
                aria-pressed={selected?.id === r.id}
                onClick={() => choose(r)}
              >
                <strong>{r.name}</strong>
                <span>{r.url || "Zoekinstructie"}</span>
                {r.notes && <span className="source-instructions">{r.notes}</span>}
                <small>
                  {r.enabled ? "Actief voor alle opties" : "Uitgeschakeld"}
                </small>
              </button>
            ))}
          </div>
          {!rows.length && !error && (
            <p>
              Er zijn nog geen bronnen. Voeg een bron toe om de update te
              voeden.
            </p>
          )}
        </>
      )}
      {draft && (
        <form
          ref={form}
          className="ranking-form source-form"
          onSubmit={(e) => void save(e)}
        >
          <h3>{selected ? "Bron bewerken" : "Nieuwe bron"}</h3>
          <fieldset disabled={busy}>
            <label>
              Naam van de bron
              <input
                ref={name}
                required
                maxLength={150}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              Webadres
              <input
                type="url"
                placeholder="https://…"
                maxLength={2000}
                value={draft.url}
                onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              />
            </label>
            <label>
              Zoekinstructie en aandachtspunten
              <textarea
                rows={5}
                maxLength={8000}
                required={!draft.url.trim()}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <label className="source-checkbox">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft({ ...draft, enabled: e.target.checked })
                }
              />
              Meenemen in de update
            </label>
            <div className="source-actions">
              <button className="primary-button" type="submit">
                {busy ? "Opslaan…" : "Bron opslaan"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  setSelected(null);
                  setConfirmDelete(false);
                }}
              >
                Annuleren
              </button>
              {selected && (
                <button type="button" onClick={() => setConfirmDelete(true)}>
                  Bron verwijderen
                </button>
              )}
            </div>
            {confirmDelete && selected && (
              <div className="notice">
                <p>‘{selected.name}’ verwijderen uit de bronnenlijst?</p>
                <button type="button" onClick={() => void remove()}>
                  Definitief verwijderen
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  Behouden
                </button>
              </div>
            )}
          </fieldset>
        </form>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
