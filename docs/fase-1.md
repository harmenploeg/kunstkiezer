# Fase 1 — inventarisatie en voortgang

## Gecontroleerd op 3 oktober 2026

| Onderdeel | Bevinding |
| --- | --- |
| Runtime | Node.js 24.19.0; npm 11.9.0 |
| GitHub-identiteit | `gh api user` bevestigt harmenploeg |
| Bestaande sitecode | harmenploeg/loci, main, commit e486ad1f224d7bb4399f8b40f91a8dc74fc5366e |
| Andere relevante code | harmenploeg/cloudflare, main, commit c1b5c87e973a357b3ba2ea233f34b37a0d22f712 |
| Repository-aanmaak | `gh repo create harmenploeg/kunstkiezer --private` geweigerd: Resource not accessible by integration (createRepository) |
| Gewenst repositorypad | harmenploeg/kunstkiezer; vooraf niet gevonden via gekoppelde GitHub API |
| Vormgeving | Roze accent #ef3850, lichte oppervlakken, ronde kaarten, systeemfont, mobiele layout |
| Bestaande frontend | Statische HTML/CSS en grote app.js; Leaflet, Google Sheets-gegevens en externe media |
| Bestaande tests | package.json verwijst naar tests die niet in de Loci-checkout aanwezig zijn |
| Supabase | Geen Supabase-koppeling vastgesteld in onderzochte Loci-code; project niet geïdentificeerd |
| Cloudomgeving | Actief, actuele netwerkpolicy enforced/unrestricted |
| Cloudcredentials | Geen Cloudflare- of Supabase-secretbindings geconfigureerd |
| GitHub-deploymetadata | Deployment-/secretmetadata van Loci geweigerd met HTTP 403 |
| Bestaande domein | HTTPS-verzoek naar loci-amsterdam.nl kreeg HTTP 403; live-bronmapping niet geverifieerd |
| Gewenst publicatiepad | https://loci-amsterdam.nl/kunstkiezer/ |

Geen AGENTS.md-instructies aangetroffen in de onderzochte checkouts. Geen secretbestanden gelezen of credentials in documentatie opgenomen.

## Lokale basis

React/TypeScript met gedeelde UI en domeintypen. De vormgeving hergebruikt Loci-tokens. Mijn kunstkeuze opent met Mijn plannen, Nog te zien, Laatste kans en Nieuw bij mijn favorieten. De vier categorieën en bezoekgeschiedenis zijn navigeerbaar, met eerlijke lege staten.

De Cloudflare Worker verwerkt alleen het Kunstkiezer-pad. Assets, API en frontend zijn gescheiden. Domeinregels en databasequeries horen niet in UI-componenten. GitHub Actions controleert typen, tests en frontendbouw.

## Serviceworkercompatibiliteit

De huidige Loci-serviceworker behandelt alle navigatieverzoeken binnen zijn scope. Een root-scope-worker kan een Kunstkiezer-response als Loci-index cachen. Voor beide checkouts is daarom een patch voorbereid met uitsluiting van `/kunstkiezer` en `/kunstkiezer/*`, plus een nieuwe cacheversie.

Welke checkout het domein voedt, is onbekend. Alleen de patch voor de actieve bron moet worden toegepast en gepubliceerd. Controleer dit vóór publicatie, inclusief een browser met de oude serviceworker.

## Omgevingen

- Development: lokale Vite-frontend en lokale Worker-runtime.
- Staging: aparte Worker `kunstkiezer-staging`, zonder routes op loci-amsterdam.nl.
- Production: Worker `kunstkiezer`, uitsluitend twee routes voor het Kunstkiezer-pad.

Deze omgevingen zijn voorbereid, niet op Cloudflare aangemaakt. Er is geen apex-DNS-wijziging nodig. Supabase-omgevingen moeten nog worden geïdentificeerd en ingericht; staging gebruikt geen productiegebruikersgegevens.

## Databaseafspraken

Supabase Auth, PostgreSQL en Storage blijven de beoogde basis. Na read-only inventarisatie volgen een migratiebaseline en versiegebonden SQL-migraties. Geen reset van een bestaand project. Persoonlijke tabellen krijgen RLS op de geverifieerde gebruiker; beheerrechten per site. Serverkeys blijven server-side. API-health controleert liveness, geen databaseconnectiviteit.

## Openstaande afhankelijkheden

1. Repository-aanmaakrechten of een lege private repository door de gebruiker.
2. Schrijf- en workflowtoegang tot die repository.
3. Cloudflare-token met Workers Scripts Edit en Workers Routes Edit voor de bedoelde zone.
4. Cloudflare-account-ID en bevestiging van huidige routes/hostingbron.
5. Publicatie van de passende serviceworkerpatch en compatibiliteitscontrole.
6. Identificatie en read-only toegang van het bestaande Supabase-project.
7. Stagingpublicatie, live rooktest, foutregistratie en herstelprocedure controleren.

Deze punten verhinderen volledige afronding. De lokale basis kan worden gebouwd en getest en later als eerste commit worden gepusht.

## Verificatie

- Strikte TypeScript-controle geslaagd.
- 9 configuratie- en routingtests geslaagd.
- 4 browser-/runtimechecks geslaagd op desktop en mobiel.
- Vite-productiebouw geslaagd.
- Cloudflare-productie-dry-run geslaagd; geen live-mutatie uitgevoerd.
- Beide serviceworkerpatches slagen voor git apply --check tegen hun broncommits.
- Mobiele screenshot visueel gecontroleerd.

De live domeinkoppeling, oude serviceworker in productie en Supabase zijn nog niet getest.
