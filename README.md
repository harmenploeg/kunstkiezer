# Kunstkiezer

Kunst ontdekken in Nederland, afgestemd op smaak en afstand. De vijf verzamelingen zijn musea, openbare kunst, beeldentuinen/parken, architectuur en tentoonstellingen/evenementen.

## Gebruik

- [Productie op Loci](https://www.loci-amsterdam.nl/kunstkiezer/)
- [Mijn account](https://www.loci-amsterdam.nl/kunstkiezer/account)
- [Redactie](https://www.loci-amsterdam.nl/kunstkiezer/beheer) — alleen zichtbaar en bereikbaar voor beheerders
- [Beheerinstellingen](https://www.loci-amsterdam.nl/kunstkiezer/beheer/instellingen) — afstand/smaak, bronnen, updateschema, extra update en gebruikersrechten

`kunstkiezer.pages.dev` is uitsluitend een preview. De echte productie wordt gepubliceerd via [harmenploeg/interactief](https://github.com/harmenploeg/interactief). Zie [publicatieprotocol](docs/publicatie.md).

## Wegwijs in de code

| Onderdeel | Locatie |
| --- | --- |
| Pagina's en navigatieschil | `apps/web/src/App.tsx` |
| Account en centrale toegangscontrole | `apps/web/src/features/account` |
| Smaakprofiel en onboarding | `apps/web/src/features/profile` |
| Gezien, sterren en delen | `apps/web/src/features/visits` |
| Redactie, bronnen en updatebeheer | `apps/web/src/features/museums`, `discovery`, `management`, `ranking` |
| Domeinregels, categorieën en rangschikking | `packages/domain` |
| Databaseclients en gegevenstypen | `packages/data` |
| Gedeelde vormgeving en elementen | `packages/ui`, `apps/web/src/styles.css` |
| Database, toegangspolicies en migraties | `supabase/migrations` |
| Serverfunctie voor accountverwijdering | `supabase/functions/delete-account` |
| Onderzoeksbestanden, bronverantwoording en open punten | `data`, met `data/curation/latest-report.json` |
| Webroutes en configuratie | `functions/kunstkiezer`, `workers/api` |

Gebruik gedeelde componenten voor categorie-overstijgende functies. Nieuwe categorieën vragen ook expliciete selectiecriteria, domeinconfiguratie, routes en databasevalidatie. Voeg geen tweede account- of rollenimplementatie toe.

## Accounts en beveiliging

Bezoekers kunnen zonder account ontdekken en lokale voorkeuren bewaren. Ingelogde gebruikers bewaren voorkeuren, bezoeken en persoonlijke sterren in Supabase, bruikbaar op meerdere apparaten. Locaties worden niet in de accountdatabase opgeslagen. Beheerdersrechten komen uit een afgeschermde tabel, nooit uit gebruikersmetadata. RLS beschermt persoonlijke gegevens, concepten, interne notities, bronnen en instellingen.

Registratie gebruikt e-mailbevestiging. Wachtwoordwijziging, herstel, gegevensdownload, wereldwijd uitloggen en eigen account verwijderen zijn aanwezig. **Voor publieke bevestigings- en herstelmails moet custom SMTP nog worden ingericht.** De standaardmaildienst van Supabase bezorgt alleen aan projectteamleden. Zie de actuele [beoordeling van architectuur en beveiliging](docs/accounts-en-beveiliging.md) voor controles en resterende voorwaarden.

## Gegevens en actualisatie

De openbare catalogi lezen uit Supabase. Onderzoeksbestanden zijn reproduceerbare momentopnamen, geen vervanging voor actuele redactionele gegevens. Imports behouden latere bewerkingen; opslaan gebruikt conflictcontrole. Beschrijvingen zijn maximaal 80 woorden, foto's hebben bron-/rechtengegevens, publicatie en bezoekstatus zijn afzonderlijk.

De beheerder bewerkt de bronnen voor alle huidige en toekomstige categorieën en het wekelijkse schema. `Nu updaten` maakt een extra aanvraag. De lokale Codex-runner controleert iedere vijf minuten de wachtrij. De computer en Codex moeten beschikbaar zijn. Een afzonderlijke dagelijkse controle bewaakt technische beveiligingsbevindingen. Zie [actualisatieprotocol](docs/wekelijkse-actualisatie.md) en [smaak/afstand](docs/smaakprofiel.md).

## Ontwikkelen en testen

Gebruik Node 24 of hoger. Installeer exact de lockfile met `npm ci`. `npm run check` voert typecontrole, unit-/databasetests en de productiebuild uit. `npm run test:e2e` controleert de gebruikersstromen op desktop en mobiel. Databasetests gebruiken PostgreSQL/RLS via PGlite; browsertests gebruiken gecontroleerde Supabase-antwoorden. Verifieer nieuwe migraties daarnaast op het echte project.

Supabase-project: `kunstkiezer`, referentie `qrlfywcqkkzmerglmsbj`. Alleen de publishable key mag in de browserconfiguratie. Auth-dashboardinstellingen staan naast het lokale voorbeeld in `supabase/config.toml`; dat bestand alleen past de hosted Auth-instellingen niet aan. Nieuwe migraties worden eerst lokaal gegenereerd en daarna gecontroleerd toegepast. Gebruik de migratiegeschiedenis als autoriteit; push geen oude, anders gedateerde importmigraties opnieuw.
