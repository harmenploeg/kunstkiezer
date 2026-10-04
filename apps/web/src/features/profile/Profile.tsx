import { LocationControls } from "../ranking/LocationControls.tsx";
import { useState, useEffect, type FormEvent } from "react";
import {
  preferenceQuestions,
  uniqueTags,
  type TasteProfile,
} from "../../../../../packages/domain/src/profile.ts";
import { catalogueTags } from "../../../../../packages/domain/src/catalogue-tags.ts";
import { appHref } from "../../../../../packages/domain/src/navigation.ts";
import { useProfileState } from "./useProfile.ts";
import { useAuth } from "../account/AuthContext.tsx";
import { useRef } from "react";
export function Profile({
  profile,
  onboarding = false,
}: {
  profile: TasteProfile;
  onboarding?: boolean;
}) {
  const state = useProfileState(),
    auth = useAuth(),
    base = useRef(state.version),
    dirty = useRef(false);
  const [tags, setTags] = useState(profile.tags),
    [search, setSearch] = useState(""),
    [message, setMessage] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!dirty.current) {
      setTags(profile.tags);
      base.current = state.version;
    }
  }, [profile.tags, state.version]);
  function change(next: string[]) {
    dirty.current = true;
    setTags(uniqueTags(next));
    setMessage("");
  }
  async function save(e?: FormEvent, all = false) {
    e?.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const selected = all ? [] : tags;
      await state.save(
        { version: 1, completed: true, tags: selected },
        base.current,
      );
      dirty.current = false;
      setTags(selected);
      if (onboarding) window.location.assign(appHref("/agenda"));
      else
        setMessage(
          "Je profiel is opgeslagen. Ontdek kunst gebruikt nu deze voorkeuren.",
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Opslaan is niet gelukt.");
    } finally {
      setSaving(false);
    }
  }
  const found = catalogueTags
    .filter(
      (t) =>
        !tags.includes(t) &&
        t.includes(search.toLocaleLowerCase("nl-NL").trim()),
    )
    .slice(0, 30);
  const questions = (
    <>
      {preferenceQuestions.map((q, i) => (
        <fieldset className="taste-question" key={q.title}>
          <legend>
            <span className="eyebrow">Vraag {i + 1}</span>
            <br />
            {q.title}
          </legend>
          <p>{q.description}</p>
          <div className="taste-options">
            {q.options.map((o) => {
              const chosen = o.tags.every((t) => tags.includes(t));
              const partial = !chosen && o.tags.some((t) => tags.includes(t));
              return (
                <button
                  type="button"
                  key={o.label}
                  aria-pressed={chosen}
                  className="taste-option"
                  onClick={() =>
                    change(
                      chosen
                        ? tags.filter(
                            (t) => !(o.tags as readonly string[]).includes(t),
                          )
                        : [...tags, ...o.tags],
                    )
                  }
                >
                  <strong>{o.label}</strong>
                  <span>{o.tags.join(" · ")}</span>
                  {partial && <small>Deels gekozen via je tags</small>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </>
  );
  const tagEditor = (
    <section className="profile-tags" aria-label="Jouw tags">
      <h2>{onboarding ? "Jouw gekozen tags" : "Opgeslagen en gekozen tags"}</h2>
      <p>Verwijder losse tags of voeg een specifieke voorkeur toe.</p>
      <div className="tag-list">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            aria-label={`Verwijder tag ${t}`}
            onClick={() => change(tags.filter((x) => x !== t))}
          >
            {t} ×
          </button>
        ))}
      </div>
      {!tags.length && (
        <p>
          Geen voorkeuren: je krijgt het volledige aanbod in de
          standaardvolgorde.
        </p>
      )}
      <p>
        {tags.length > 0 && (
          <button type="button" onClick={() => change([])}>
            Alle voorkeuren wissen
          </button>
        )}
      </p>
      <label>
        Zoek een extra tag
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Bijvoorbeeld art deco of portretten"
        />
      </label>
      {search.trim() && (
        <div className="tag-list tag-suggestions">
          {found.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => {
                change([...tags, t]);
                setSearch("");
              }}
            >
              {t} +
            </button>
          ))}
          {!found.length && <p>Geen andere tags gevonden.</p>}
        </div>
      )}
    </section>
  );
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Jouw smaak, jouw ontdekkingen</p>
        <h1>
          {onboarding ? "Mijn kunstkeuze" : "Mijn profiel"}
          <span className="accent">.</span>
        </h1>
        <p>
          {onboarding
            ? "Wat zie je graag? Vertel ons wat je aanspreekt en ontdek kunst die bij je past."
            : "Dit zijn je voorkeuren. Pas ze aan wanneer je smaak verandert of je iets nieuws wilt ontdekken."}
        </p>
      </header>
      {state.error && <p role="alert">{state.error}</p>}
      <form className="taste-form" onSubmit={(e) => save(e)}>
        <p>
          {onboarding
            ? "Je mag meerdere antwoorden kiezen. Ze worden vertaald naar tags: meer overeenkomsten betekent een hogere plek in de resultaten. Het overige aanbod blijft beschikbaar."
            : "Meer overeenkomende tags geeft een hogere plek bij Ontdek kunst. Je kunt hieronder je voorkeuren aanpassen."}
        </p>
        {onboarding ? (
          <>
            {questions}
            {tagEditor}
          </>
        ) : (
          <>
            {tagEditor}
            <details className="profile-questions">
              <summary>Voorkeuren kiezen met de vragen</summary>
              {questions}
            </details>
          </>
        )}

        <LocationControls />
        <p className="storage-note">
          {auth.user
            ? "Je profiel wordt veilig in je account bewaard en is beschikbaar op je andere apparaten."
            : "Zonder account bewaren we je voorkeuren alleen in deze browser."}{" "}
          {!auth.user && (
            <a href={appHref("/account")}>
              Maak een account om je profiel te behouden en overal te gebruiken.
            </a>
          )}{" "}
          Je locatiekeuze geldt per apparaat; je locatie wordt niet online
          opgeslagen.
        </p>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        <div className="profile-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={!state.ready || saving}
          >
            {onboarding
              ? "Bewaar mijn smaak en ontdek kunst"
              : "Profiel opslaan"}
          </button>
          {onboarding ? (
            <button
              type="button"
              disabled={!state.ready || saving}
              onClick={() => save(undefined, true)}
            >
              Ik sta overal voor open
            </button>
          ) : (
            <a className="text-button" href={appHref("/agenda")}>
              Ontdek kunst →
            </a>
          )}
        </div>
      </form>
    </>
  );
}
