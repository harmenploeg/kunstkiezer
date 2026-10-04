import { ArchiveSubject } from "../management/ArchiveSubject.tsx";
import { useAuth } from "../account/AuthContext.tsx";
import { useEffect, useState } from "react";
import {
  getMuseumExtras,
  listMuseums,
  saveMuseum,
} from "../../../../../packages/data/src/client.ts";
import {
  blankMuseum,
  provinces,
  type Museum,
  type MuseumInput,
  type Editorial,
  type MuseumSource,
} from "../../../../../packages/data/src/museums.ts";
import { MuseumForm } from "./MuseumForm.tsx";
const emptyEditorial: Editorial = { review_notes: "", suggested_tags: [] };
export function MuseumAdmin() {
  const { client } = useAuth();
  const [archive, setArchive] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<Museum[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(0);
  const [search, setSearch] = useState(""),
    [province, setProvince] = useState(""),
    [message, setMessage] = useState("");
  const [selected, setSelected] = useState<MuseumInput | null>(null),
    [existing, setExisting] = useState<Museum | null>(null),
    [editorial, setEditorial] = useState<Editorial>(emptyEditorial),
    [sources, setSources] = useState<MuseumSource[]>([]),
    [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (!client) return;
    let active = true;
    const timer = setTimeout(() => {
      listMuseums(client, search, province, true, page, [], null, undefined, archive)
        .then((r) => {
          if (active) {
            setRows(r.rows);
            setTotal(r.total);
          }
        })
        .catch((e) => {
          if (active) setMessage(e.message);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [client, search, province, page, archive, refresh]);
  async function choose(m: Museum) {
    if (!client) return;
    setMessage("");
    setSelected(null);
    setExisting(m);
    try {
      const extra = await getMuseumExtras(client, m.id);
      setSources(extra.sources);
      setEditorial(extra.editorial);
      setSelected(m);
      setFormKey((k) => k + 1);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function save(m: MuseumInput, notes: string) {
    if (!client) throw Error("Meld je aan als redacteur.");
    const saved = await saveMuseum(client, m, existing, notes);
    setExisting(saved);
    const result = await listMuseums(client, search, province, true, page, [], null, undefined, archive);
    setRows(result.rows);
    setTotal(result.total);
  }
  const visible = rows,
    count = total;
  return (
    <>
      <a className="back-link" href="/kunstkiezer/beheer">
        ← Alle verzamelingen
      </a>
      <header className="page-heading">
        <p className="eyebrow">Redactie</p>
        <h1>
          Musea beheren<span className="accent">.</span>
        </h1>
        <p>Bewerk kunstmusea, collectieteksten, foto’s en tags.</p>
      </header>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <>
        <div className="filters">
          <label>Toon<select aria-label="Toon" value={archive ? "archive" : "active"} onChange={(e) => {setArchive(e.target.value === "archive"); setPage(0); setSelected(null); setExisting(null);}}><option value="active">Actieve onderwerpen</option><option value="archive">Archief</option></select></label>
          <label>
            Zoek museum
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <label>
            Provincie
            <select
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Alle provincies</option>
              {provinces.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setSelected(blankMuseum);
              setExisting(null);
              setSources([]);
              setEditorial(emptyEditorial);
              setFormKey((k) => k + 1);
            }}
          >
            Museum toevoegen
          </button>
        </div>
        <p role="status">
          {count} kunstmusea · pagina {page + 1} van{" "}
          {Math.max(1, Math.ceil(count / 50))}
        </p>
        <div className="admin-layout">
          <section aria-label="Museumlijst" className="museum-list">
            {visible.map((m) => (
              <button
                key={m.id}
                className="museum-row"
                onClick={() => void choose(m)}
              >
                <strong>{m.name}</strong>
                <span>
                  {[m.city, m.province].filter(Boolean).join(" · ") ||
                    "Plaats nog controleren"}
                </span>
                <small>
                  {m.publication_status === "published"
                    ? "Gepubliceerd"
                    : m.publication_status === "archived" ? "Archief" : "Concept"}
                </small>
              </button>
            ))}
            <div className="pagination">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Vorige
              </button>
              <button
                disabled={(page + 1) * 50 >= count}
                onClick={() => setPage((p) => p + 1)}
              >
                Volgende
              </button>
            </div>
          </section>
          {selected ? (
            <div>
            <MuseumForm
              key={formKey}
              museum={selected}
              existing={existing}
              sources={sources}
              editorial={editorial}
              canSave={true}
              onSave={save}
            />
            {existing && <ArchiveSubject key={existing.id + existing.updated_at} table="kk_museums" row={existing} onDone={() => {setSelected(null); setExisting(null); setRefresh(x => x + 1); setMessage(archive ? "Hersteld als concept." : "Onderwerp verwijderd uit het aanbod.");}} />}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Kies een museum</h2>
              <p>
                Open een vermelding om de gegevens, bron en tagvoorstellen te
                bekijken.
              </p>
            </div>
          )}
        </div>
      </>
    </>
  );
}
