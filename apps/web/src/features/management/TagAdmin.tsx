import { useEffect, useState } from "react";
import { useAuth } from "../account/AuthContext.tsx";
import {
  readTaxonomy,
  validQuestions,
  type TagDefinition,
  type PreferenceQuestion,
} from "../../../../../packages/data/src/taxonomy.ts";
import { uniqueTags } from "../../../../../packages/domain/src/profile.ts";
export function TagAdmin() {
  const { client } = useAuth();
  const [tags, setTags] = useState<TagDefinition[]>([]),
    [questions, setQuestions] = useState<PreferenceQuestion[]>([]),
    [version, setVersion] = useState(""),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [newLabel, setNewLabel] = useState(""),
    [newDimension, setNewDimension] = useState("onderwerp");
  async function load() {
    if (!client) return;
    const d = await readTaxonomy(client);
    setTags(d.tags);
    setQuestions(d.questions);
    setVersion(d.version);
  }
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [client]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage("Opgeslagen.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }
  async function saveTag(tag: TagDefinition) {
    if (!client) return;
    const r = await client
      .from("kk_tags")
      .update({
        dimension: tag.dimension,
        description: tag.description,
        enabled: tag.enabled,
      })
      .eq("label", tag.label)
      .eq("updated_at", tag.updated_at)
      .select("*")
      .single();
    if (r.error || !r.data)
      throw Error("Opslaan mislukt of deze tag is gewijzigd. Herlaad eerst.");
    setTags((old) => old.map((t) => (t.label === tag.label ? r.data : t)));
  }
  function editQuestion(
    i: number,
    o: number,
    field: "label" | "tags",
    value: string,
  ) {
    setQuestions((old) =>
      old.map((q, qi) =>
        qi !== i
          ? q
          : {
              ...q,
              options: q.options.map((opt, oi) =>
                oi !== o
                  ? opt
                  : {
                      ...opt,
                      [field]:
                        field === "tags" ? uniqueTags(value.split(",")) : value,
                    },
              ),
            },
      ),
    );
  }
  return (
    <section className="management-section" aria-label="Tagbeheer">
      <h2>Tagbeheer</h2>
      <p>
        Onderwerptags beschrijven kunst, stijl en beleving. Makertags beginnen
        met ‘maker:’ en horen bij de kunstenaar of architect. Het makerveld van
        een onderwerp vult die tag automatisch aan. Uitschakelen verbergt een
        tag als nieuwe profielkeuze; bestaande koppelingen blijven bewaard.
      </p>
      <label>
        Zoek een tag
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <p>{tags.length} tags</p>
      <div className="tag-management-list">
        {tags
          .filter((t) => t.label.includes(search.toLowerCase()))
          .map((t) => (
            <details key={t.label}>
              <summary>
                {t.label} · {t.dimension}
                {!t.enabled ? " · uitgeschakeld" : ""}
              </summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => saveTag(t));
                }}
              >
                <label>
                  Soort tag
                  <input
                    value={t.dimension}
                    required
                    onChange={(e) =>
                      setTags((old) =>
                        old.map((x) =>
                          x.label === t.label
                            ? { ...x, dimension: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Omschrijving
                  <input
                    value={t.description}
                    onChange={(e) =>
                      setTags((old) =>
                        old.map((x) =>
                          x.label === t.label
                            ? { ...x, description: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) =>
                      setTags((old) =>
                        old.map((x) =>
                          x.label === t.label
                            ? { ...x, enabled: e.target.checked }
                            : x,
                        ),
                      )
                    }
                  />
                  Beschikbaar als profielkeuze
                </label>
                <p>
                  Gekoppelde antwoorden:{" "}
                  {questions
                    .flatMap((q) =>
                      q.options
                        .filter((o) => o.tags.includes(t.label))
                        .map((o) => q.title + " → " + o.label),
                    )
                    .join("; ") || "Geen; wel los te kiezen in Mijn profiel."}
                </p>
                <button disabled={busy}>Tag opslaan</button>
              </form>
            </details>
          ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!client) return;
            let label = newLabel.trim().toLowerCase();
            if (newDimension === "maker" && !label.startsWith("maker: "))
              label = "maker: " + label;
            const r = await client
              .from("kk_tags")
              .insert({
                label,
                dimension: newDimension,
                description: "",
                enabled: true,
              });
            if (r.error)
              throw Error("Toevoegen mislukt. Mogelijk bestaat deze tag al.");
            setNewLabel("");
            await load();
          });
        }}
      >
        <h3>Tag toevoegen</h3>
        <label>
          Nieuwe tag
          <input
            required
            maxLength={110}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </label>
        <label>
          Soort
          <select
            value={newDimension}
            onChange={(e) => setNewDimension(e.target.value)}
          >
            <option value="onderwerp">Onderwerp / stijl</option>
            <option value="maker">Kunstenaar / architect</option>
            <option value="beleving">Beleving</option>
          </select>
        </label>
        <button disabled={busy}>Tag toevoegen</button>
      </form>
      <h3>Voorkeurvragen en tags</h3>
      <p>
        Pas de vragen, antwoorden en bijbehorende tags aan. Dit geldt direct
        voor nieuwe keuzes; opgeslagen gebruikersvoorkeuren worden niet
        overschreven.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!client) return;
            if (!validQuestions(questions))
              throw Error(
                "Vul elke vraag, elk antwoord en de bijbehorende tags in.",
              );
            const known = new Set(
              tags.filter((t) => t.enabled).map((t) => t.label),
            );
            if (
              questions.some((q) =>
                q.options.some((o) => o.tags.some((t) => !known.has(t))),
              )
            )
              throw Error(
                "Gebruik bestaande ingeschakelde tags, of voeg de ontbrekende tag eerst toe.",
              );
            const r = await client
              .from("kk_preference_questions")
              .update({ questions })
              .eq("id", 1)
              .eq("updated_at", version)
              .select("updated_at")
              .single();
            if (r.error || !r.data)
              throw Error(
                "Vragen zijn gewijzigd of opslaan is mislukt. Herlaad eerst.",
              );
            setVersion(r.data.updated_at);
          });
        }}
      >
        {questions.map((q, i) => (
          <fieldset className="question-mapping" key={i}>
            <legend>Vraag {i + 1}</legend>
            <label>
              Vraag
              <input
                value={q.title}
                required
                onChange={(e) =>
                  setQuestions((old) =>
                    old.map((x, j) =>
                      i === j ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Toelichting
              <input
                value={q.description}
                onChange={(e) =>
                  setQuestions((old) =>
                    old.map((x, j) =>
                      i === j ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            {q.options.map((o, j) => (
              <div className="form-grid" key={j}>
                <label>
                  Antwoord
                  <input
                    required
                    value={o.label}
                    onChange={(e) =>
                      editQuestion(i, j, "label", e.target.value)
                    }
                  />
                </label>
                <label>
                  Tags bij dit antwoord, met komma's
                  <input
                    required
                    defaultValue={o.tags.join(", ")}
                    onBlur={(e) => editQuestion(i, j, "tags", e.target.value)}
                  />
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setQuestions((old) =>
                  old.map((x, j) =>
                    i === j
                      ? {
                          ...x,
                          options: [
                            ...x.options,
                            { label: "Nieuw antwoord", tags: [] },
                          ],
                        }
                      : x,
                  ),
                )
              }
            >
              Antwoord toevoegen
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            setQuestions((old) => [
              ...old,
              {
                title: "Nieuwe vraag",
                description: "",
                options: [{ label: "Nieuw antwoord", tags: [] }],
              },
            ])
          }
        >
          Vraag toevoegen
        </button>{" "}
        <button disabled={busy || !version}>Vragen en tags opslaan</button>
      </form>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
