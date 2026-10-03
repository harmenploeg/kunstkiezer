import { appHref, BASE_PATH, categories, navigation } from "../../../packages/domain/src/navigation.ts";
import { ActionLink, EmptyState, Section } from "../../../packages/ui/src/index.tsx";

function PersonalAgenda() {
  return <>
    <header className="page-heading"><p className="eyebrow">Jouw kunstagenda</p><h1>Mijn kunstkeuze<span className="accent">.</span></h1><p>Wat je wilt zien, waar je graag komt en wat je nog kunt ontdekken.</p></header>
    <div className="dashboard">
      <Section title="Mijn plannen" description="Een bezoek in gedachten? Hier komen je geplande uitstapjes.">
        <EmptyState title="Ruimte voor een volgend bezoek">Je hebt nog geen bezoeken gepland.</EmptyState>
      </Section>
      <Section title="Nog te zien" description="Bewaar plekken en activiteiten om later op terug te komen.">
        <EmptyState title="Je eerste keuze begint bij ontdekken" action={<ActionLink href={appHref("/agenda")}>Ontdek kunst in Nederland</ActionLink>}>Hier verschijnen je bewaarde keuzes.</EmptyState>
      </Section>
      <Section title="Laatste kans" description="Bewaarde tentoonstellingen en evenementen die binnenkort eindigen.">
        <EmptyState title="Niets om haast voor te maken">Wanneer je een tijdelijke activiteit bewaart, vind je hier wat bijna afloopt.</EmptyState>
      </Section>
      <Section title="Nieuw bij mijn favorieten" description="Nieuwe activiteiten op plekken die je volgt.">
        <EmptyState title="Blijf dichtbij wat je mooi vindt">Hier verschijnen straks updates van jouw favoriete plekken.</EmptyState>
      </Section>
    </div>
  </>;
}

function Discovery({ categoryId }: { categoryId?: string }) {
  const category = categories.find((item) => item.id === categoryId);
  return <>
    <header className="page-heading"><p className="eyebrow">Kunst in Nederland</p><h1>{category?.name ?? "Ontdek kunst"}<span className="accent">.</span></h1><p>{category?.description ?? "Op plekken die je al kent. En op plekken die je nog wilt ontdekken."}</p></header>
    {category ? <><a className="back-link" href={appHref("/agenda")}>← Alle categorieën</a><Section title="Te zien en te doen" description="Vaste plekken, tentoonstellingen en evenementen."><EmptyState title="Het aanbod wordt binnenkort toegevoegd">Kom terug om plekken en activiteiten te ontdekken.</EmptyState></Section></> : <>
      <div className="category-grid">{categories.map((item, index) => <a key={item.id} className="category-card" href={appHref(`/agenda/${item.id}`)}><span className="category-dot" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h2>{item.name}</h2><p>{item.description}</p><span className="category-link">Bekijk deze categorie <span aria-hidden="true">↗</span></span></a>)}</div>
      <Section title="Tentoonstellingen en evenementen" description="Wat is er vandaag, dit weekend en binnenkort te doen?"><EmptyState title="De agenda wordt gevuld">Hier vind je straks actuele activiteiten bij musea, kunstplekken, beeldenparken en bijzondere gebouwen.</EmptyState></Section>
    </>}
  </>;
}

export function App() {
  const relativePath = window.location.pathname.slice(BASE_PATH.length).replace(/\/$/, "") || "/";
  const activePath = relativePath.startsWith("/agenda") ? "/agenda" : relativePath;
  return <>
    <a className="skip-link" href="#inhoud">Ga naar inhoud</a>
    <header className="site-header"><a className="brand" href={appHref("/")} aria-label="Kunstkiezer, Mijn kunstkeuze"><span className="brand-dot" aria-hidden="true" />kunstkiezer</a><a className="loci-link" href="/">Loci Amsterdam ↗</a></header>
    <nav className="main-nav" aria-label="Hoofdnavigatie">{navigation.map((item) => <a key={item.path} href={appHref(item.path)} aria-current={activePath === item.path ? "page" : undefined}>{item.label}</a>)}</nav>
    <main id="inhoud" tabIndex={-1}>
      {relativePath === "/" ? <PersonalAgenda /> : relativePath === "/agenda" ? <Discovery /> : relativePath.startsWith("/agenda/") ? <Discovery categoryId={relativePath.split("/")[2] ?? ""} /> : relativePath === "/geschiedenis" ? <><header className="page-heading"><p className="eyebrow">Mijn kunstkeuze</p><h1>Gezien<span className="accent">.</span></h1><p>Een persoonlijk geheugen voor je kunstbezoeken.</p></header><EmptyState title="Je geschiedenis begint bij je eerste bezoek">Hier vind je straks wat je hebt gezien, met je eigen waarderingen en notities.</EmptyState></> : <><h1>Pagina niet gevonden</h1><ActionLink href={appHref("/")}>Naar Mijn kunstkeuze</ActionLink></>}
    </main>
    <footer className="site-footer"><span>Kunstkiezer · Nederland</span><span>Bewaren. Bezoeken. Ontdekken.</span></footer>
  </>;
}
