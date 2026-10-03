import {Profile} from './features/profile/Profile.tsx';
import {useProfile} from './features/profile/useProfile.ts';
import { lazy, Suspense, useEffect } from "react";
const MuseumCatalog=lazy(()=>import("./features/museums/Catalog.tsx").then(m=>({default:m.MuseumCatalog})));
const MuseumAdmin=lazy(()=>import("./features/museums/Admin.tsx").then(m=>({default:m.MuseumAdmin})));
import {CategoryCards,AdminHome} from "./features/discovery/CategoryCards.tsx";
import {DiscoveryCatalog} from "./features/discovery/Catalog.tsx";
import {DiscoveryAdmin} from "./features/discovery/Admin.tsx";
import {discoveryCategories,type DiscoveryCategory} from "../../../packages/data/src/discovery.ts";
import { appHref, BASE_PATH, categories, navigation } from "../../../packages/domain/src/navigation.ts";
import { ActionLink, EmptyState, Section } from "../../../packages/ui/src/index.tsx";

function Discovery({ categoryId }: { categoryId?: string }) {
  const category = categories.find((item) => item.id === categoryId);
  return <>
    <header className="page-heading"><p className="eyebrow">Kunst in Nederland</p><h1>{category?.name ?? "Ontdek kunst"}<span className="accent">.</span></h1><p>{category?.description ?? "Op plekken die je al kent. En op plekken die je nog wilt ontdekken."}</p></header>
    {category ? <><a className="back-link" href={appHref("/agenda")}>← Alle categorieën</a><Section title="Te zien en te doen" description="Vaste plekken, tentoonstellingen en evenementen.">{category.id === "musea" ? <MuseumCatalog /> : <DiscoveryCatalog category={category.id as DiscoveryCategory}/>}</Section></> : <>
      <CategoryCards />
    </>}
  </>;
}

export function App() {
  const profile=useProfile();
  useEffect(()=>{if(profile.completed&&(window.location.pathname===BASE_PATH||window.location.pathname===BASE_PATH+'/'))window.location.replace(appHref('/agenda'));},[profile.completed]);
  const relativePath = window.location.pathname.slice(BASE_PATH.length).replace(/\/$/, "") || "/";
  const activePath = relativePath.startsWith("/agenda") ? "/agenda" : relativePath;
  return <>
    <a className="skip-link" href="#inhoud">Ga naar inhoud</a>
    <header className="site-header"><a className="brand" href={appHref("/")} aria-label="Kunstkiezer, startpagina"><span className="brand-dot" aria-hidden="true" />kunstkiezer</a><a className="loci-link" href="/">Loci Amsterdam ↗</a></header>
    <nav className="main-nav" aria-label="Hoofdnavigatie">{navigation.filter(item=>item.path!=='/'||!profile.completed).map((item) => <a key={item.path} href={appHref(item.path)} aria-current={activePath === item.path ? "page" : undefined}>{item.label}</a>)}</nav>
    <main id="inhoud" tabIndex={-1}><Suspense fallback={<p role="status">Pagina laden…</p>}>
      {relativePath === "/beheer" ? <AdminHome/> : relativePath.startsWith("/beheer/") && discoveryCategories.includes(relativePath.split("/")[2] as DiscoveryCategory) ? <DiscoveryAdmin key={relativePath} category={relativePath.split("/")[2] as DiscoveryCategory}/> : relativePath === "/beheer/musea" ? <MuseumAdmin /> : relativePath === "/profiel" ? <Profile profile={profile}/> : relativePath === "/" ? (profile.completed?<Discovery/>:<Profile profile={profile} onboarding/>) : relativePath === "/agenda" ? <Discovery /> : relativePath.startsWith("/agenda/") ? <Discovery categoryId={relativePath.split("/")[2] ?? ""} /> : relativePath === "/geschiedenis" ? <><header className="page-heading"><p className="eyebrow">Mijn kunstkeuze</p><h1>Gezien<span className="accent">.</span></h1><p>Een persoonlijk geheugen voor je kunstbezoeken.</p></header><EmptyState title="Je geschiedenis begint bij je eerste bezoek">Hier vind je straks wat je hebt gezien, met je eigen waarderingen en notities.</EmptyState></> : <><h1>Pagina niet gevonden</h1><ActionLink href={appHref("/")}>Naar Mijn kunstkeuze</ActionLink></>}
    </Suspense></main>
    <footer className="site-footer"><span>Kunstkiezer · Nederland</span><span>Bewaren. Bezoeken. Ontdekken.</span><a href={appHref("/beheer")}>Beheer</a></footer>
  </>;
}
