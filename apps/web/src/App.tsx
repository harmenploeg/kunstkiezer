import { useAuth, RequireAdmin } from "./features/account/AuthContext.tsx";
import { useProfileState } from "./features/profile/useProfile.ts";
import { History } from "./features/visits/Visits.tsx";
const RankingAdmin = lazy(() =>
  import("./features/ranking/RankingAdmin.tsx").then((m) => ({
    default: m.RankingAdmin,
  })),
);
const Account = lazy(() =>
  import("./features/account/Account.tsx").then((m) => ({
    default: m.Account,
  })),
);
const DeleteAccount = lazy(() =>
  import("./features/account/Account.tsx").then((m) => ({
    default: m.DeleteAccount,
  })),
);
const Detail = lazy(() =>
  import("./features/visits/Detail.tsx").then((m) => ({ default: m.Detail })),
);
import { Catalog } from "./features/catalog/Catalog.tsx";
import { Profile } from "./features/profile/Profile.tsx";
import { useProfile } from "./features/profile/useProfile.ts";
import { lazy, Suspense, useEffect, useRef } from "react";
const MuseumCatalog = lazy(() =>
  import("./features/museums/Catalog.tsx").then((m) => ({
    default: m.MuseumCatalog,
  })),
);
const MuseumAdmin = lazy(() =>
  import("./features/museums/Admin.tsx").then((m) => ({
    default: m.MuseumAdmin,
  })),
);
import {
  CategoryCards,
  AdminHome,
} from "./features/discovery/CategoryCards.tsx";
import { DiscoveryCatalog } from "./features/discovery/Catalog.tsx";
const DiscoveryAdmin = lazy(() =>
  import("./features/discovery/Admin.tsx").then((m) => ({
    default: m.DiscoveryAdmin,
  })),
);
import {
  discoveryCategories,
  type DiscoveryCategory,
} from "../../../packages/data/src/discovery.ts";
import {
  appHref,
  BASE_PATH,
  categories,
  navigation,
} from "../../../packages/domain/src/navigation.ts";
import {
  ActionLink,
  EmptyState,
  Section,
} from "../../../packages/ui/src/index.tsx";

function Discovery({ categoryId }: { categoryId?: string }) {
  const landing = useRef<HTMLDivElement>(null);
  const category = categories.find((item) => item.id === categoryId);
  const tag = new URLSearchParams(window.location.search).get("tag") ?? "";
  useEffect(() => {
    const root = landing.current;
    const card = root?.querySelector('.category-card');
    if (!root || !card || category || tag) return;
    const resize = () => root.style.setProperty('--discovery-card-height', `${card.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(resize);
    observer.observe(card);
    resize();
    return () => observer.disconnect();
  }, [category, tag]);
  return (
    <div ref={landing} className={!category && !tag ? "discovery-landing" : undefined}>
      <header className={!category && !tag ? "page-heading art-heading" : "page-heading"}>
        <div className="heading-copy"><p className="eyebrow">Kunst in Nederland</p>
        <h1>
          {tag ? `Kunst met ${tag.replace(/^maker: /, "")}` : category?.name ?? "Ontdek kunst"}
          <span className="accent">.</span>
        </h1>
        {category && <p>{category.description}</p>}</div>
      </header>
      {tag ? <Catalog tag={tag}/> : category ? (
        <>
          <nav className="category-shortcuts" aria-label="Kies een categorie">
            {categories.map((option) => (
              <a key={option.id} href={appHref(`/agenda/${option.id}`)} aria-current={option.id === category.id ? "page" : undefined}>
                {option.name}
              </a>
            ))}
          </nav>
          <Section
            title="Te zien en te doen"
            description="Vaste plekken, tentoonstellingen en evenementen."
          >
            {category.id === "musea" ? (
              <MuseumCatalog />
            ) : (
              <DiscoveryCatalog category={category.id as DiscoveryCategory} />
            )}
          </Section>
        </>
      ) : (
        <>
          <CategoryCards />
        </>
      )}
    </div>
  );
}

function Page({ path }: { path: string }) {
  const profile = useProfile(),
    state = useProfileState();
  if (path.startsWith("/beheer"))
    return (
      <RequireAdmin>
        {path === "/beheer" ? (
          <AdminHome />
        ) : path === "/beheer/musea" ? (
          <MuseumAdmin />
        ) : ["/beheer/instellingen", "/beheer/volgorde"].includes(path) ? (
          <RankingAdmin />
        ) : discoveryCategories.includes(
            path.split("/")[2] as DiscoveryCategory,
          ) ? (
          <DiscoveryAdmin category={path.split("/")[2] as DiscoveryCategory} />
        ) : (
          <h1>Pagina niet gevonden</h1>
        )}
      </RequireAdmin>
    );
  if (path === "/account") return <Account />;
  if (path === "/account-verwijderen") return <DeleteAccount />;
  if (path === "/bekijk") return <Detail />;
  if (path === "/geschiedenis") return <History />;
  if (path === "/profiel" || path === "/kunstkeuze" || path === "/") {
    if (state.error) return <p role="alert">{state.error}</p>;
    if (!state.ready) return <p role="status">Profiel laden…</p>;
    if (path === "/profiel") return <Profile profile={profile} />;
    return path === "/" && profile.completed ? (
      <Discovery />
    ) : (
      <Profile profile={profile} onboarding />
    );
  }
  if (path === "/agenda") return <Discovery />;
  if (path.startsWith("/agenda/"))
    return <Discovery categoryId={path.split("/")[2] ?? ""} />;
  return (
    <>
      <h1>Pagina niet gevonden</h1>
      <ActionLink href={appHref("/agenda")}>Ontdek kunst</ActionLink>
    </>
  );
}
export function App() {
  const profile = useProfile(),
    state = useProfileState(),
    auth = useAuth();
  useEffect(() => {
    if (
      state.ready &&
      profile.completed &&
      (window.location.pathname === BASE_PATH ||
        window.location.pathname === BASE_PATH + "/")
    )
      window.location.replace(appHref("/agenda"));
  }, [profile.completed, state.ready]);
  const relativePath =
    window.location.pathname.slice(BASE_PATH.length).replace(/\/$/, "") || "/";
  const activePath = relativePath.startsWith("/agenda")
    ? "/agenda"
    : relativePath === "/" ? (profile.completed ? "/agenda" : "/kunstkeuze") : relativePath;
  return (
    <>
      <a className="skip-link" href="#inhoud">
        Ga naar inhoud
      </a>
      <header className="site-header">
        <a
          className="brand"
          href={appHref("/")}
          aria-label="Kunstkiezer, startpagina"
        >
          <span className="brand-dot" aria-hidden="true" />
          kunstkiezer
        </a>
        <div className="header-actions">
          <a href={appHref("/account")} aria-current={activePath === "/account" ? "page" : undefined}>
            {auth.user ? "Mijn account" : "Inloggen"}
          </a>
          {auth.admin && <a href={appHref("/beheer")} aria-current={relativePath.startsWith("/beheer") ? "page" : undefined}>Beheer</a>}
        </div>
      </header>
      <nav className="main-nav" aria-label="Hoofdnavigatie">
        {navigation
          .map((item) => (
            <a
              key={item.path}
              href={appHref(item.path)}
              aria-current={activePath === item.path ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
      </nav>
      <main id="inhoud" tabIndex={-1}>
        <Suspense fallback={<p role="status">Pagina laden…</p>}>
          <Page path={relativePath} />
        </Suspense>
      </main>
      <footer className="site-footer">
        <span>Kunstkiezer · Nederland</span>
        <a className="art-credit" href="https://commons.wikimedia.org/wiki/File:Piet_Mondrian,_1942_-_Broadway_Boogie_Woogie.jpg" target="_blank" rel="noreferrer">Achtergrond: Piet Mondriaan · Broadway Boogie Woogie (1942–1943) · MoMA · publiek domein</a>
        {auth.admin && <a href={appHref("/beheer")}>Beheer</a>}
      </footer>
    </>
  );
}
