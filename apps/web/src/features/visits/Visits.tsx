import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../account/AuthContext.tsx";
import { appHref } from "../../../../../packages/domain/src/navigation.ts";
export interface SeenItem {
  item_id: string;
  category: string;
  name: string;
  rating: number | null;
  seen_at: string;
  status?: "seen" | "wanted";
}
interface State {
  rows: SeenItem[];
  ready: boolean;
  error: string;
  save: (
    item: Pick<SeenItem, "item_id" | "category" | "name">,
    rating: number | null,
    status?: "seen" | "wanted",
  ) => Promise<void>;
  remove: (item: SeenItem) => Promise<void>;
}
const Context = createContext<State | null>(null);
export function VisitsProvider({ children }: { children: ReactNode }) {
  const { user, client } = useAuth(),
    [rows, setRows] = useState<SeenItem[]>([]),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const mutations = useRef(0);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  useEffect(() => {
    let active = true;
    setRows([]);
    setReady(false);
    setError("");
    async function load() {
      const revision = mutations.current;
      if (!user || !client) {
        if (active) setReady(true);
        return;
      }
      const all: SeenItem[] = [];
      for (let page = 0; ; page++) {
        const r = await client
          .from("kk_seen")
          .select("item_id,category,name,rating,seen_at,status")
          .eq("user_id", user.id)
          .order("seen_at", { ascending: false })
          .order("item_id")
          .range(page * 500, page * 500 + 499);
        if (!active || revision !== mutations.current) return;
        if (r.error) {
          setError(
            "Je bezoeken konden niet worden geladen. Herlaad de pagina.",
          );
          return;
        }
        all.push(...r.data);
        if (r.data.length < 500) break;
      }
      if (active && revision === mutations.current) {
        setRows(all);
        setReady(true);
        setError("");
      }
    }
    void load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [client, user?.id]);
  async function save(
    item: Pick<SeenItem, "item_id" | "category" | "name">,
    rating: number | null,
    status: "seen" | "wanted" = "seen",
  ) {
    if (!user || !client || !ready)
      throw Error("Log eerst in en wacht tot je bezoeken zijn geladen.");
    const uid = user.id,
      old = rows.find(
        (r) => r.item_id === item.item_id && r.category === item.category,
      );
    const value = {
      ...item,
      rating: status === "wanted" ? null : rating,
      status,
      seen_at:
        old && (old.status ?? "seen") === status
          ? old.seen_at
          : new Date().toISOString(),
    };
    const r = await client
      .from("kk_seen")
      .upsert(
        { ...value, user_id: uid },
        { onConflict: "user_id,category,item_id" },
      );
    if (r.error)
      throw Error("Je bezoek kon niet worden opgeslagen. Probeer opnieuw.");
    mutations.current++;
    window.dispatchEvent(new Event("kunstkiezer-ratings"));
    if (owner.current === uid)
      setRows((rows) => [
        value,
        ...rows.filter(
          (r) => r.item_id !== item.item_id || r.category !== item.category,
        ),
      ]);
  }
  async function remove(item: SeenItem) {
    if (!user || !client) return;
    const uid = user.id;
    const r = await client
      .from("kk_seen")
      .delete()
      .eq("user_id", uid)
      .eq("item_id", item.item_id)
      .eq("category", item.category);
    if (r.error) throw Error("Verwijderen is niet gelukt.");
    mutations.current++;
    window.dispatchEvent(new Event("kunstkiezer-ratings"));
    if (owner.current === uid)
      setRows((rows) =>
        rows.filter(
          (r) => r.item_id !== item.item_id || r.category !== item.category,
        ),
      );
  }
  return (
    <Context.Provider value={{ rows, ready, error, save, remove }}>
      {children}
    </Context.Provider>
  );
}
export function useVisits() {
  const v = useContext(Context);
  if (!v) throw Error("VisitsProvider ontbreekt");
  return v;
}
export function CatalogActions({
  id,
  category,
  name,
}: {
  id: string;
  category: string;
  name: string;
}) {
  const { user } = useAuth(),
    visits = useVisits(),
    saved = visits.rows.find(
      (r) => r.item_id === id && r.category === category,
    );
  const dialog = useRef<HTMLDialogElement>(null),
    shareDialog = useRef<HTMLDialogElement>(null),
    [rating, setRating] = useState<number | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const url =
    location.origin +
    appHref("/bekijk") +
    "?categorie=" +
    encodeURIComponent(category) +
    "&id=" +
    encodeURIComponent(id);
  async function save(value: number | null) {
    setBusy(true);
    setMessage("");
    try {
      await visits.save({ item_id: id, category, name }, value);
      dialog.current?.close();
      setMessage("Bewaard op Gezien/te zien.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    setMessage("");
    if (navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: `Samen ontdekken? ${name} op Kunstkiezer.`,
          url,
        });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    shareDialog.current?.showModal();
  }
  return (
    <div className="catalog-actions">
      {user ? (
        <button
          type="button"
          disabled={!visits.ready}
          onClick={() => {
            setRating(saved?.rating ?? null);
            setMessage("");
            dialog.current?.showModal();
          }}
        >
          {saved && saved.status !== "wanted"
            ? `✓ Gezien${saved.rating ? " · " + saved.rating + " ★" : ""}`
            : "✓ Ik heb dit gezien"}
        </button>
      ) : (
        <a className="text-button" href={appHref("/account")}>
          Log in om te bewaren als gezien
        </a>
      )}
      {user ? (
        <button
          type="button"
          disabled={!visits.ready || busy}
          aria-pressed={saved?.status === "wanted"}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              if (saved?.status === "wanted") await visits.remove(saved);
              else {
                if (
                  saved &&
                  !confirm(
                    "Verplaatsen naar Te zien? Je eerdere waardering vervalt.",
                  )
                )
                  return;
                await visits.save(
                  { item_id: id, category, name },
                  null,
                  "wanted",
                );
              }
              setMessage(
                saved?.status === "wanted"
                  ? "Verwijderd uit Te zien."
                  : "Bewaard op Te zien.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {saved?.status === "wanted"
            ? "✓ Hier wil ik nog heen"
            : "Hier wil ik nog heen"}
        </button>
      ) : (
        <a className="text-button" href={appHref("/account")}>
          Hier wil ik nog heen
        </a>
      )}
      <button
        type="button"
        onClick={() => void share()}
        aria-label={`Deel ${name}`}
      >
        <span aria-hidden="true">↗</span> Delen
      </button>
      <small>Tip dit aan iemand met wie je wilt gaan.</small>
      <dialog
        ref={dialog}
        aria-labelledby={"rate-" + id}
        onCancel={() => setMessage("")}
      >
        <h2 id={"rate-" + id}>Wat vond je van {name}?</h2>
        <p>
          Geef 1 tot 5 sterren. Je naam wordt niet getoond. Vanaf drie
          beoordelingen tellen de sterren samen mee in de volgorde.
        </p>
        <div className="stars" role="group" aria-label="Waardering">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? "ster" : "sterren"}`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
            >
              {rating !== null && n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
        <div className="profile-actions">
          <button
            disabled={busy || rating === null}
            className="primary-button"
            onClick={() => void save(rating)}
          >
            Bewaar waardering
          </button>
          <button disabled={busy} onClick={() => void save(null)}>
            Gezien, zonder sterren
          </button>
          <button disabled={busy} onClick={() => dialog.current?.close()}>
            Annuleren
          </button>
        </div>
        {message && <p role="alert">{message}</p>}
      </dialog>
      <dialog ref={shareDialog} aria-labelledby={"share-" + id}>
        <h2 id={"share-" + id}>Deel {name}</h2>
        <p>Wie gaat er met je mee?</p>
        <div className="share-options">
          <a
            href={"https://wa.me/?text=" + encodeURIComponent(name + " " + url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp ↗
          </a>
          <a
            href={
              "https://www.facebook.com/sharer/sharer.php?u=" +
              encodeURIComponent(url)
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook ↗
          </a>
          <a
            href={
              "mailto:?subject=" +
              encodeURIComponent(name) +
              "&body=" +
              encodeURIComponent(url)
            }
          >
            E-mail ↗
          </a>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage("Link gekopieerd.");
              } catch {
                setMessage("Kopieer de link uit het veld hieronder.");
              }
            }}
          >
            Kopieer link
          </button>
        </div>
        <label>
          Link naar dit onderwerp
          <input readOnly value={url} onFocus={(e) => e.target.select()} />
        </label>
        {message && <p role="status">{message}</p>}
        <button onClick={() => shareDialog.current?.close()}>Sluiten</button>
      </dialog>
      {message && !dialog.current?.open && !shareDialog.current?.open && (
        <p role="status">{message}</p>
      )}
    </div>
  );
}
