# Musea: van inventaris naar bewerkbare backend

## Wat is verzameld

De eerste inventaris combineert 553 gestructureerde museumvermeldingen op Museum.nl met 1.189 vermeldingen uit de provinciale Wikipedia-lijsten en de aanvullende Amsterdam-lijst. Exacte overeenkomsten in naam en plaats zijn samengevoegd. Na normalisatie blijven 1.496 kandidaten over, met 62 mogelijke dubbelparen en 71 kandidaten zonder bevestigde provincie. Dit is een brede onderzoeksinventaris, geen volledig gecontroleerd register van alle momenteel geopende musea. Historische musea, kastelen, bezoekerscentra en kunstinstellingen moeten redactioneel worden beoordeeld.

Elk record heeft een vaste UUID, importcode, bronnen en controlestatus. Naam, adres, website en coördinaten komen uit gestructureerde metadata waar beschikbaar. Provincie kan uit een eenduidige plaatsnaam in een provinciale lijst zijn afgeleid; dit staat in de notities. Openingstijden, entreeprijzen, toegankelijkheid en afbeeldingen worden niet aangenomen of gekopieerd. Er is één onbruikbare sitemapverwijzing (`/portal`, 404), geen stil weggelaten fetchfouten.

Bestanden: `data/museums/inventory.json`, `inventory.csv`, `report.json`, `possible-duplicates.json`. De verzameling is reproduceerbaar via `scripts/collect-museums.py` (Python met beautifulsoup4 en lxml). De data moet periodiek opnieuw worden gecontroleerd; de herimport overschrijft bestaande redactionele wijzigingen niet.

## Supabase als enige catalogusbackend

- `kk_museums`: museumlocaties, bezoekgegevens, goedgekeurde tags en publicatiestatus.
- `kk_museum_sources`: bronlinks, ophaaldatum en welke velden de bron onderbouwt.
- `kk_museum_editorial`: interne notities en te beoordelen tagvoorstellen. Alleen redacteuren kunnen deze lezen.
- `kk_tags`: uitbreidbare tagbibliotheek per dimensie. De eerste bibliotheek bevat collectie, medium, periode, stijl, thema, beleving, voorzieningen en locatie.
- `kunstkiezer_private.editors`: expliciet toegekende bewerkrechten voor Supabase Auth-gebruikers.
- `kunstkiezer_private.museum_changes`: revisielog met redacteur, datum en oude/nieuwe museumgegevens.

De prefix `kk_` en de private schema houden de collectie los van eventuele bestaande Loci-tabellen. Elke museumlocatie krijgt een eigen record; organisaties met meerdere locaties worden later apart gekoppeld. Tentoonstellingen en evenementen worden later eigen tabellen met verwijzingen naar museum-ID's. Bewaarde keuzes en aanbevelingen verwijzen eveneens naar deze ID's, niet naar een kopie van museumgegevens.

De openbare pagina `/kunstkiezer/agenda/musea` vraagt uitsluitend gepubliceerde en geopende kunstmusea op uit Supabase. RLS dwingt dit ook af buiten de app. Een anonieme bezoeker en een gewone aangemelde gebruiker kunnen niet schrijven. De browser krijgt uitsluitend de publieke publishable key; er is geen service-role key in frontendcode.

## Beheerformulier

`/kunstkiezer/beheer/musea` bevat zoeken, provinciefilters, paginering, toevoegen, bewerken, bronvermelding, tagvoorstellen, interne notities en expliciete publicatie. Redacteuren melden aan via Supabase Auth. Museumgegevens en notities worden samen in één transactie opgeslagen (`kk_save_museum`). Een update wordt geweigerd wanneer de versie ondertussen door iemand anders is gewijzigd.

Voor publicatie zijn een naam, plaats, adres of coördinaten, selectie als kunstmuseum en status open vereist. Geen automatische publicatie vanuit een import of tagvoorstel. Goedgekeurde tags zijn momenteel een tekstarray; de bibliotheek biedt een gemeenschappelijke betekenis en kan later naar tag-ID-koppelingen worden genormaliseerd.

Zonder Supabase-verbinding toont uitsluitend de beheerpagina een duidelijk gemarkeerde, niet-opslagbare inventarispreview. Deze wordt niet gebruikt als vervanging voor de openbare backendcatalogus.

## Nieuw project aansluiten

Het project `kunstkiezer` in organisatie `loci` is aangesloten. Onderstaande stappen beschrijven het opnieuw opbouwen van de omgeving.

1. Verbind Supabase via de Supabase-koppeling, of maak het project in het Supabase-dashboard aan.
2. Pas alle bestanden uit `supabase/migrations/` in volgorde toe. De lokale `supabase/config.toml` is bedoeld voor de CLI; stel op het cloudproject ook registratie uit als alleen redactieaccounts nodig zijn.
3. Draai `npm run inventory:imports`. Dit maakt 30 transactionele SQL-importbestanden in `supabase/imports/`. Voer ze in volgorde uit in SQL Editor, of gebruik de CLI/databaseverbinding. `data/museums/supabase-museums.csv` is ook geschikt voor Table Editor, maar bevat alleen hoofdgegevens; voor bronnen en notities is de SQL-import nodig.
4. Maak jouw redacteuraccount in Authentication → Users aan en voer `supabase/bootstrap-editor.sql` uit met jouw eigen e-mailadres. Alleen een projecteigenaar kent editorrechten toe.
5. Zet in Cloudflare Pages-project `kunstkiezer` twee runtimevariabelen: `PUBLIC_SUPABASE_URL` en `PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Gebruik een `sb_publishable_...` key, nooit een secret/service-role key. `/kunstkiezer/api/config` geeft uitsluitend die twee openbare waarden door.
6. Voor de subpagina op de hoofdsite moeten dezelfde twee runtimevariabelen in Pages-project `interactief` staan. De frontendbuild, Functions en inventarispreview moeten in het gecontroleerde Loci-publicatiepakket worden opgenomen.

In Supabase Table Editor kun je `kk_museums` als eigenaar direct bekijken en bewerken, inclusief concepten. Voor dagelijks beheer met beperkte rechten is het Kunstkiezer-formulier de aanbevolen ingang. De service-rol mag nooit in een browserformulier worden gebruikt.

## Controle

PostgreSQL-tests met PGlite voeren de echte SQL-migraties, RLS-regels en alle importbatches uit. Ze controleren onbevoegd schrijven, privénotities, publicatievoorwaarden, verloren updates en veilige herimport. Browsertests controleren de inventarispreview en aanmelding/opslag via gemockte Supabase-responses op mobiel en desktop. De live database is aanvullend gecontroleerd op redactierechten en opgeslagen inhoud.

## Collecties en foto’s

`is_art_museum` begrenst de redactie en openbare catalogus. De eerste selectie bevat 30 musea; de overige inventaris blijft behouden. `summary` is een collectietekst van maximaal 80 woorden. `photos` is een geordende JSON-lijst met `url`, `caption`, `credit`, `source_url` en `license`; maximaal 20 afbeeldingen. De eerste foto is de omslag. Foto’s worden met dezelfde versiecontrole als de museumgegevens opgeslagen. Het formulier gebruikt externe afbeeldingslinks; het uploadt geen bestanden.

De legacykolommen `verification_status` en `verified_at` blijven voor oude importbestanden bestaan, maar zijn niet meer zichtbaar of een publicatievoorwaarde. Pas na de inventarisimport ook `supabase/art-curation.sql` toe. Bronnen en fotolicenties staan in `data/museums/art-curation-2026-10-03.json`.
