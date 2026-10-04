import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext.tsx";
import { useProfileState, readProfile } from "../profile/useProfile.ts";
import { appHref } from "../../../../../packages/domain/src/navigation.ts";
export function Account() {
  const { client, user, loading, error, recovery } = useAuth(),
    profile = useProfileState();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [current, setCurrent] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const reset = recovery;
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Dit is niet gelukt. Probeer opnieuw.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!client) return;
    await run(async () => {
      if (mode === "forgot") {
        const r = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: location.origin + appHref("/account") + "?reset=1",
        });
        if (r.error)
          throw Error(
            "De resetlink kon niet worden aangevraagd. Probeer later opnieuw.",
          );
        setMessage(
          "Als dit e-mailadres een account heeft, ontvang je een resetlink. Bekijk ook je spammap.",
        );
        return;
      }
      if (mode === "signup") {
        if (password !== confirm)
          throw Error("De wachtwoorden zijn niet gelijk.");
        const r = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: location.origin + appHref("/account") },
        });
        if (r.error)
          throw Error(
            "Registreren is niet gelukt. Probeer later opnieuw of vraag een resetlink aan als je al een account hebt.",
          );
        setPassword("");
        setConfirm("");
        setMessage(
          "Bekijk je e-mail en bevestig je e-mailadres. Daarna kun je inloggen.",
        );
        return;
      }
      const r = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setPassword("");
      if (r.error)
        throw Error(
          "Inloggen is niet gelukt. Controleer je gegevens en bevestig eerst je e-mailadres.",
        );
      setMessage(
        "Je bent ingelogd. Je online profiel is beschikbaar op al je apparaten.",
      );
    });
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!client || !user?.email) return;
    await run(async () => {
      if (password !== confirm)
        throw Error("De wachtwoorden zijn niet gelijk.");
      if (!reset) {
        const r = await client.auth.signInWithPassword({
          email: user.email!,
          password: current,
        });
        if (r.error) throw Error("Het huidige wachtwoord klopt niet.");
      }
      const r = await client.auth.updateUser({ password });
      if (r.error)
        throw Error(
          "Wachtwoord wijzigen is niet gelukt. Vraag een nieuwe resetlink aan of probeer opnieuw.",
        );
      setPassword("");
      setConfirm("");
      setCurrent("");
      await client.auth.signOut({ scope: "global" });
      setMessage(
        "Wachtwoord gewijzigd. Log opnieuw in met je nieuwe wachtwoord.",
      );
      history.replaceState(null, "", appHref("/account"));
    });
  }
  async function exportData() {
    if (!client || !user) return;
    await run(async () => {
      const [p, v] = await Promise.all([
        client.from("kk_profiles").select("*").eq("user_id", user.id),
        client.from("kk_seen").select("*").eq("user_id", user.id),
      ]);
      if (p.error || v.error) throw Error("Download mislukt.");
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              { email: user.email, profile: p.data, seen: v.data },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "mijn-kunstkiezer.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  if (loading) return <p role="status">Account laden…</p>;
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Jouw kunst, overal bij je</p>
        <h1>
          Mijn account<span className="accent">.</span>
        </h1>
        <p>
          Bewaar je smaak, bezoeken en waarderingen en gebruik ze op meerdere
          apparaten.
        </p>
      </header>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!user ? (
        <>
          <div className="account-modes">
            {(
              [
                ["login", "Inloggen"],
                ["signup", "Account maken"],
                ["forgot", "Wachtwoord vergeten"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m);
                  setMessage("");
                  setPassword("");
                  setConfirm("");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <form className="login-form" onSubmit={submit}>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {mode !== "forgot" && (
              <label>
                Wachtwoord
                <input
                  type="password"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  minLength={mode === "signup" ? 12 : undefined}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            {mode === "signup" && (
              <>
                <label>
                  Herhaal wachtwoord
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                <p>
                  Gebruik minstens 12 tekens. Je e-mailadres wordt bevestigd. Je
                  profiel en bezoeken zijn alleen voor jou zichtbaar.
                </p>
              </>
            )}
            <button className="primary-button" disabled={busy || !client}>
              {busy
                ? "Even wachten…"
                : mode === "login"
                  ? "Inloggen"
                  : mode === "signup"
                    ? "Account maken"
                    : "Resetlink aanvragen"}
            </button>
          </form>
        </>
      ) : (
        <>
          <p>
            Ingelogd als <strong>{user.email}</strong>.
          </p>
          <p>
            <a className="text-button" href={appHref("/profiel")}>
              Mijn profiel →
            </a>{" "}
            <a className="text-button" href={appHref("/geschiedenis")}>
              Mijn bezoeken →
            </a>
          </p>
          {profile.ready &&
            !profile.profile.completed &&
            readProfile().completed && (
              <section className="account-panel">
                <h2>Voorkeuren van dit apparaat</h2>
                <p>
                  Je had al een lokaal profiel. Wil je die voorkeuren in je
                  account bewaren?
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await profile.importGuest();
                      setMessage("Voorkeuren overgenomen.");
                    })
                  }
                >
                  Neem mijn lokale voorkeuren over
                </button>
              </section>
            )}
          <section className="account-panel">
            <h2>
              {reset ? "Kies een nieuw wachtwoord" : "Wachtwoord wijzigen"}
            </h2>
            <form className="login-form" onSubmit={changePassword}>
              {!reset && (
                <label>
                  Huidig wachtwoord
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                  />
                </label>
              )}
              <label>
                Nieuw wachtwoord (minstens 12 tekens)
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                Herhaal nieuw wachtwoord
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <button disabled={busy} className="primary-button">
                Wachtwoord opslaan
              </button>
            </form>
          </section>
          <section className="account-panel">
            <h2>Je gegevens en sessies</h2>
            <p>
              We bewaren je e-mailadres, voorkeuren, bezoeken en waarderingen.
              Je locatie wordt niet in je account opgeslagen. Je voorkeuren, bezoeken en waarderingen zijn privé. Beheerders zien je e-mailadres om accountrechten te beheren.
            </p>
            <button disabled={busy} onClick={() => void exportData()}>
              Download mijn gegevens
            </button>{" "}
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await client!.auth.signOut();
                  if (r.error) throw r.error;
                  setMessage("Je bent uitgelogd.");
                })
              }
            >
              Uitloggen op alle apparaten
            </button>
            <p>
              <a href={appHref("/account-verwijderen")}>
                Mijn account verwijderen
              </a>
            </p>
          </section>
        </>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
export function DeleteAccount() {
  const { user, client } = useAuth();
  const [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <h1>Account verwijderen</h1>
      <p>
        Je profiel, bezoeken en waarderingen worden definitief verwijderd. De
        laatste beheerder moet eerst het beheer overdragen.
      </p>
      {user ? (
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              !client ||
              !confirm(
                "Je account en persoonlijke gegevens definitief verwijderen?",
              )
            )
              return;
            setBusy(true);
            try {
              const r = await client.functions.invoke("delete-account", {
                body: { password },
              });
              setPassword("");
              if (r.error || r.data?.error)
                throw Error(
                  r.data?.error ||
                    "Verwijderen is niet gelukt. Controleer je wachtwoord en beheerdersrechten.",
                );
              await client.auth.signOut({ scope: "local" });
              location.assign(appHref("/account"));
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Bevestig met je wachtwoord
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy}>Verwijder mijn account definitief</button>
        </form>
      ) : (
        <a href={appHref("/account")}>Log eerst in</a>
      )}
      {message && <p role="alert">{message}</p>}
    </>
  );
}
