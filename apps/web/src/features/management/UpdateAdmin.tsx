import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../account/AuthContext.tsx";
interface Schedule {
  enabled: boolean;
  weekday: number;
  local_time: string;
  next_due: string;
  updated_at: string;
}
interface Run {
  id: string;
  status: string;
  reason: string;
  requested_at: string;
  started_at: string | null;
  finished_at: string | null;
  summary: string;
}
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })
    : "—";
export function UpdateAdmin() {
  const { client } = useAuth(),
    [schedule, setSchedule] = useState<Schedule | null>(null),
    [runs, setRuns] = useState<Run[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  async function load(refreshForm = true) {
    if (!client) return;
    const [s, r] = await Promise.all([
      client.from("kk_update_schedule").select("*").single(),
      client
        .from("kk_update_runs")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(10),
    ]);
    if (s.error || r.error)
      throw Error("Updategegevens konden niet worden geladen.");
    if (refreshForm) setSchedule(s.data);
    setRuns(r.data);
  }
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (active)
        void load(!dirty).catch((e) => {
          if (active) setMessage(e.message);
        });
    };
    refresh();
    const id = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [client, dirty]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!client || !schedule) return;
    setBusy(true);
    try {
      const r = await client
        .from("kk_update_schedule")
        .update({
          enabled: schedule.enabled,
          weekday: schedule.weekday,
          local_time: schedule.local_time,
        })
        .eq("id", true)
        .eq("updated_at", schedule.updated_at)
        .select("*")
        .maybeSingle();
      if (r.error) throw Error("Opslaan is niet gelukt.");
      if (!r.data)
        throw Error("Het schema is ondertussen gewijzigd. Herlaad de pagina.");
      setSchedule(r.data);
      setDirty(false);
      setMessage("Updateschema opgeslagen.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const active = runs.some(
    (r) => r.status === "queued" || r.status === "running",
  );
  return (
    <section className="account-panel">
      <h2>Updates uitvoeren en plannen</h2>
      <p>
        De updater haalt actieve bronnen op voor alle categorieën. Codex
        controleert iedere vijf minuten of er werk klaarstaat. De Codex-app en
        deze computer moeten daarvoor beschikbaar zijn; een aanvraag blijft
        anders wachten.
      </p>
      <button
        className="primary-button"
        disabled={busy || active || !schedule}
        onClick={async () => {
          if (!client) return;
          setBusy(true);
          try {
            const r = await client.rpc("kk_request_update");
            if (r.error) throw Error(r.error.message);
            await load(!dirty);
            setMessage(
              "Extra updateronde aangevraagd. De voortgang verschijnt hieronder.",
            );
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {active ? "Update aangevraagd of bezig" : "Nu updaten"}
      </button>
      {schedule && (
        <form className="ranking-form" onSubmit={save}>
          <h3>Automatische update</h3>
          <label className="source-checkbox">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => {
                setDirty(true);
                setSchedule({ ...schedule, enabled: e.target.checked });
              }}
            />
            Wekelijks automatisch actualiseren
          </label>
          <div className="form-grid">
            <label>
              Dag
              <select
                aria-label="Dag"
                value={schedule.weekday}
                onChange={(e) => {
                  setDirty(true);
                  setSchedule({ ...schedule, weekday: Number(e.target.value) });
                }}
              >
                {[
                  "Zondag",
                  "Maandag",
                  "Dinsdag",
                  "Woensdag",
                  "Donderdag",
                  "Vrijdag",
                  "Zaterdag",
                ].map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tijd (Nederland)
              <input
                type="time"
                required
                value={schedule.local_time.slice(0, 5)}
                onChange={(e) => {
                  setDirty(true);
                  setSchedule({ ...schedule, local_time: e.target.value });
                }}
              />
            </label>
          </div>
          <p>
            Volgende geplande update:{" "}
            {schedule.enabled
              ? date(schedule.next_due)
              : "automatische updates staan uit"}
            . Zomer- en wintertijd worden meegenomen.
          </p>
          <button disabled={busy || !dirty}>Updateschema opslaan</button>
        </form>
      )}
      <h3>Laatste updaterondes</h3>
      {runs.length ? (
        <ol className="update-runs">
          {runs.map((r) => (
            <li key={r.id}>
              <strong>
                {
                  {
                    queued: "In de wachtrij",
                    running: "Bezig",
                    completed: "Afgerond",
                    failed: "Mislukt / onderbroken",
                  }[r.status]
                }
              </strong>{" "}
              · {r.reason === "manual" ? "Extra ronde" : "Gepland"}
              <p>
                Aangevraagd: {date(r.requested_at)} · gestart:{" "}
                {date(r.started_at)} · afgerond: {date(r.finished_at)}
              </p>
              {r.summary && <p>{r.summary}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p>Nog geen updaterondes geregistreerd in dit overzicht.</p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </section>
  );
}
