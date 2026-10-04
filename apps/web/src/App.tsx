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
import { lazy, Suspense, useEffect } from "react";
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
  const category = categories.find((item) => item.id === categoryId);
  const tag = new URLSearchParams(window.location.search).get("tag") ?? "";
  return (
    <>
      <header className="page-heading">
        <p className="eyebrow">Kunst in Nederland</p>
        <h1>
          {tag ? `Kunst met ${tag.replace(/^maker: /, "")}` : category?.name ?? "Ontdek kunst"}
          <span className="accent">.</span>
        </h1>
        <p>
          {category?.description ??
            "Op plekken die je al kent. En op plekken die je nog wilt ontdekken."}
        </p>
      </header>
      {tag ? <Catalog tag={tag}/> : category ? (
        <>
          <a className="back-link" href={appHref("/agenda")}>
            ← Alle categorieën
          </a>
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
    </>
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
  if (path === "/profiel" || path === "/") {
    if (state.error) return <p role="alert">{state.error}</p>;
    if (!state.ready) return <p role="status">Profiel laden…</p>;
    if (path === "/profiel") return <Profile profile={profile} />;
    return profile.completed ? (
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
    : relativePath;
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
        <a className="loci-link" href="/">
          Loci Amsterdam ↗
        </a>
      </header>
      <nav className="main-nav" aria-label="Hoofdnavigatie">
        {navigation
          .filter((item) => item.path !== "/" || !profile.completed)
          .map((item) => (
            <a
              key={item.path}
              href={appHref(item.path)}
              aria-current={activePath === item.path ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        <a
          href={appHref("/account")}
          aria-current={activePath === "/account" ? "page" : undefined}
        >
          {auth.user ? "Mijn account" : "Inloggen"}
        </a>
        {auth.admin && <a href={appHref("/beheer")}>Beheer</a>}
      </nav>
      <main id="inhoud" tabIndex={-1}>
        <Suspense fallback={<p role="status">Pagina laden…</p>}>
          <Page path={relativePath} />
        </Suspense>
      </main>
      <footer className="site-footer">
        <span>Kunstkiezer · Nederland</span>
        <span>Bewaren. Bezoeken. Ontdekken.</span>
        {auth.admin && <a href={appHref("/beheer")}>Beheer</a>}
      </footer>
    </>
  );
}
