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
interface Change {
  id: string;
  run_id: string;
  change: string;
  record_table: string;
  record_name: string;
  fields: string[];
  source_id: string | null;
  source_url: string;
  note: string;
}
// Alleen de laatste rondes zijn nog interessant; ouder dan dat leest niemand terug.
const ZICHTBARE_RONDES = 3;
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" })
    : "—";
const dayTime = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("nl-NL", {
        timeZone: "Europe/Amsterdam",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "onbekende datum";
const clock = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString("nl-NL", {
        timeZone: "Europe/Amsterdam",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const CHANGE_LABEL: Record<string, string> = {
  added: "Toegevoegd",
  updated: "Bijgewerkt",
  archived: "Gearchiveerd",
  rejected: "Afgewezen",
};
// Toegevoegd eerst: dat is waar de beheerder naar zoekt.
const CHANGE_ORDER = ["added", "updated", "archived", "rejected"];
const STATUS_LABEL: Record<string, string> = {
  queued: "In de wachtrij",
  running: "Bezig",
  completed: "Afgerond",
  failed: "Mislukt / onderbroken",
};
const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
};
// De naam van de bron zegt meer dan het webadres; die staat in kk_update_sources.
const sourceLabel = (c: Change, names: Record<string, string>) =>
  (c.source_id && names[c.source_id]) ||
  (c.source_url ? host(c.source_url) : (c.source_id ?? "bron onbekend"));
const sorted = (changes: Change[]) =>
  [...changes].sort(
    (a, b) =>
      CHANGE_ORDER.indexOf(a.change) - CHANGE_ORDER.indexOf(b.change) ||
      a.record_name.localeCompare(b.record_name, "nl"),
  );
const counted = (changes: Change[]) =>
  CHANGE_ORDER.filter((k) => changes.some((c) => c.change === k))
    .map(
      (k) =>
        `${changes.filter((c) => c.change === k).length} ${(CHANGE_LABEL[k] ?? k).toLowerCase()}`,
    )
    .join(" · ");
const waiting = (since: string) => {
  const minutes = Math.floor((Date.now() - new Date(since).getTime()) / 60000);
  if (minutes < 1) return "net aangevraagd";
  if (minutes < 60) return `${minutes} minuten in de wachtrij`;
  return `${Math.floor(minutes / 60)} uur in de wachtrij`;
};
const took = (run: Run) => {
  if (!run.started_at || !run.finished_at) return "";
  const minutes = Math.round(
    (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) /
      60000,
  );
  return minutes < 1 ? " in minder dan een minuut" : ` in ${minutes} minuten`;
};
export function UpdateAdmin() {
  const { client } = useAuth(),
    [schedule, setSchedule] = useState<Schedule | null>(null),
    [runs, setRuns] = useState<Run[]>([]),
    [changes, setChanges] = useState<Record<string, Change[]>>({}),
    [sourceNames, setSourceNames] = useState<Record<string, string>>({}),
    [reportFailed, setReportFailed] = useState(false),
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
        .limit(ZICHTBARE_RONDES),
    ]);
    if (s.error || r.error)
      throw Error("Updategegevens konden niet worden geladen.");
    if (refreshForm) setSchedule(s.data);
    setRuns(r.data);
    const ids = (r.data as Run[]).map((run) => run.id);
    if (!ids.length) return setChanges({});
    const [c, bronnen] = await Promise.all([
      client
        .from("kk_update_changes")
        .select("*")
        .in("run_id", ids)
        .order("created_at"),
      client.from("kk_update_sources").select("id,name"),
    ]);
    // Zonder de namen van de bronnen blijft het verslag leesbaar; dan staat het webadres er.
    if (!bronnen.error)
      setSourceNames(
        Object.fromEntries(
          (bronnen.data as { id: string; name: string }[]).map((b) => [
            b.id,
            b.name,
          ]),
        ),
      );
    if (c.error) {
      setReportFailed(true);
      return setChanges({});
    }
    setReportFailed(false);
    setChanges(
      (c.data as Change[]).reduce<Record<string, Change[]>>((acc, change) => {
        (acc[change.run_id] ??= []).push(change);
        return acc;
      }, {}),
    );
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
    <>
      <section
        id="updates"
        className="account-panel"
        aria-labelledby="updates-title"
      >
        <h2 id="updates-title">Updates uitvoeren en plannen</h2>
        <p>
          De updater haalt actieve bronnen op voor alle categorieën. De
          wekelijkse ronde wordt maandagochtend opgepakt door de geplande taak
          “Kunstkiezer · wekelijkse actualisatie” in Claude Code; een extra
          aanvraag blijft in de wachtrij tot een runner hem claimt. Deze
          computer moet daarvoor aanstaan.
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
                "Extra updateronde aangevraagd. De voortgang verschijnt onder Laatste updaterondes.",
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
                    setSchedule({
                      ...schedule,
                      weekday: Number(e.target.value),
                    });
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
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </section>
      <section
        id="rondes"
        className="account-panel"
        aria-labelledby="rondes-title"
      >
        <h2 id="rondes-title">Laatste updaterondes</h2>
        <p>
          De {ZICHTBARE_RONDES} meest recente rondes. Per ronde staat welke
          verhalen zijn toegevoegd of bijgewerkt, en uit welke bron dat komt.
        </p>
        {runs.length ? (
          <ol className="update-runs">
            {runs.map((r) => {
              const rows = changes[r.id] ?? [];
              return (
                <li key={r.id} className="update-round">
                  <h3>
                    {dayTime(r.requested_at)}
                    <span className="update-round-kind">
                      {r.reason === "manual"
                        ? "Extra ronde"
                        : "Geplande ronde"}
                    </span>
                  </h3>
                  <p className="update-round-state">
                    <strong>{STATUS_LABEL[r.status] ?? r.status}</strong>
                    {r.status === "queued" && ` · ${waiting(r.requested_at)}`}
                    {r.status === "running" &&
                      r.started_at &&
                      ` · gestart om ${clock(r.started_at)}`}
                    {r.finished_at &&
                      ` · klaar om ${clock(r.finished_at)}${took(r)}`}
                  </p>
                  {r.summary && (
                    <p className="update-round-summary">{r.summary}</p>
                  )}
                  {rows.length ? (
                    <>
                      <p className="update-round-counts">{counted(rows)}</p>
                      <div className="table-scroll">
                        <table className="update-change-table">
                          <thead>
                            <tr>
                              <th>Wat</th>
                              <th>Verhaal</th>
                              <th>Bron</th>
                              <th>Toelichting</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted(rows).map((c) => (
                              <tr key={c.id}>
                                <td>
                                  {CHANGE_LABEL[c.change] ?? c.change}
                                  {c.fields.length > 0 && (
                                    <span className="update-change-fields">
                                      {" · "}
                                      {c.fields.join(", ")}
                                    </span>
                                  )}
                                </td>
                                <td>{c.record_name}</td>
                                <td>
                                  {c.source_url ? (
                                    <a
                                      href={c.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {sourceLabel(c, sourceNames)}
                                    </a>
                                  ) : (
                                    sourceLabel(c, sourceNames)
                                  )}
                                </td>
                                <td>{c.note || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : reportFailed ? (
                    <p>Het updateverslag kon niet worden geladen.</p>
                  ) : (
                    r.status === "completed" && (
                      <p>Deze ronde heeft geen wijzigingen vastgelegd.</p>
                    )
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p>Nog geen updaterondes geregistreerd in dit overzicht.</p>
        )}
      </section>
    </>
  );
}
