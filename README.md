# Kunstkiezer

Modulaire kunstagenda voor Nederland. Mijn kunstkeuze is het startpunt.

## Bekijk het resultaat

- App: https://kunstkiezer.pages.dev/kunstkiezer/
- Museuminventaris en bewerkformulier: https://kunstkiezer.pages.dev/kunstkiezer/beheer/musea
- CSV: https://kunstkiezer.pages.dev/kunstkiezer/inventory.csv

De eerste inventaris bevat 1.496 kandidaten uit Museum.nl, twaalf provinciale Wikipedia-lijsten en de Amsterdam-lijst. Exacte overeenkomsten zijn samengevoegd; 62 mogelijke dubbelparen en 71 onbekende provincies blijven te controleren. Historische en gesloten vermeldingen zijn nog aanwezig. Alle records beginnen als concept, niet als gecontroleerde openbare catalogus.

## Backend en beheer

De museumcatalogus leest uitsluitend uit Supabase. Het redacteurformulier ondersteunt aanmelden, zoeken, provinciefilters, toevoegen, wijzigen, bronnen, tagvoorstellen, privénotities en publicatie. RLS beschermt concepten en notities. Museumgegevens en notities worden in één transactie opgeslagen met controle op gelijktijdige wijzigingen.

Supabase-project `kunstkiezer` (`qrlfywcqkkzmerglmsbj`, Frankfurt) bevat vier migraties en 1.496 museumconcepten. GitHub is verbonden met productiebranch `main`. De Pages-publicatieworkflow zet de twee publieke Supabase-runtimevariabelen vanuit GitHub Actions-variabelen. Redacteuren kunnen aanmelden met wachtwoord of een e-maillink. Zonder verbinding toont de beheerpagina een duidelijk gemarkeerde, niet-opslagbare inventarispreview. Zie [inrichting en datamodel](docs/musea-en-supabase.md).

## Ontwikkelen en testen

`npm ci`, `npm run check`, `npm run test:e2e`. De tests voeren de echte PostgreSQL-schema’s en RLS uit met PGlite en controleren de frontend op desktop en mobiel. De login-/opslagbrowsertest gebruikt gemockte Supabase-antwoorden; live databasecontrole volgt na aansluiting.

De code staat modulair in `apps/web/src/features/museums`, `packages/data`, `packages/config` en `functions/kunstkiezer`. Onderzoeksdata en bronnen staan in `data/museums`; de collectie heeft een tagbibliotheek per dimensie.

## Cloudflare

De preview is Cloudflare Pages-project `kunstkiezer`. Runtimevariabelen `PUBLIC_SUPABASE_URL` en `PUBLIC_SUPABASE_PUBLISHABLE_KEY` leveren uitsluitend de openbare clientconfiguratie; serverkeys worden geweigerd.

De eerdere basisintegratie is gepubliceerd in Pages-project `interactief` onder `www.loci-amsterdam.nl/kunstkiezer/`. De nieuwe museumuitbreiding is momenteel op de afzonderlijke preview gepubliceerd; het Loci-publicatiepakket moet voor deze uitbreiding nog worden bijgewerkt.

Persoonlijke keuzes, bezoekplanning en aanbevelingen zijn nog niet geïmplementeerd.

## Kunstmuseumselectie

De redactietool toont nu een eerste selectie van 30 kunstmusea, inclusief fotografie en toegepaste kunst. De brede inventaris blijft bewaard als onderzoeksbron; dit is nog geen uitputtende lijst van alle Nederlandse kunstmusea. Alle 30 hebben een originele collectietekst van maximaal 80 woorden, minimaal één foto (32 totaal) met maker/bron/licentie, en inhoudelijke tags (110 koppelingen).

De selectie staat in `data/museums/art-curation-2026-10-03.json`. Genereer de herhaalbare inhoudsimport met `node scripts/generate-art-curation.mjs` en voer `supabase/art-curation.sql` uit na de migraties en inventarisimport. Deze vult lege teksten/fotolijsten aan, voegt tags samen en behoudt publicatiestatus en latere bewerkingen.

Foto’s kunnen via afbeeldingslinks worden toegevoegd, verwijderd en als omslag gekozen. De collectietekst heeft een woordenteller; frontend én database handhaven maximaal 80 woorden. De afzonderlijke status Gecontroleerd is vervallen. De legacykolom blijft alleen voor compatibiliteit met oude imports bestaan. Publicatie gebeurt expliciet door de redactie; de verrijkte musea blijven concept.
