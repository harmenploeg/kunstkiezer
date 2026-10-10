# Publiceren naar Loci

Het productiedomein is **https://www.loci-amsterdam.nl/kunstkiezer/**. De workflow `preview-pages.yml` publiceert alleen `kunstkiezer.pages.dev`; een succesvolle preview-deployment bevestigt geen productiepublicatie.

Productie gebruikt de bestaande gecontroleerde publicatieketen van `harmenploeg/interactief`:

1. Test Kunstkiezer met `npm run check` en de relevante browsertests, bouw de te publiceren revisie.
2. Gebruik een schone, actuele checkout van `harmenploeg/interactief` en voer vanuit Kunstkiezer `node scripts/sync-loci.mjs /pad/naar/interactief` uit.
3. Controleer daar de wijzigingen, `npm run check:release` en `node --test tests/kunstkiezer-pages.test.mjs`.
4. Commit en push de integratie naar `interactief/main`. Wacht op `Controleer LOCI-publicatiepakket`, inclusief de herbruikbare `deploy-checked.yml`-workflow. Omzeil deze controles niet door het hele Pages-project handmatig met alleen Kunstkiezer te overschrijven.
5. De productiecontrole vergelijkt `/kunstkiezer/version.json`, pagina’s, alle JS/CSS-assets en de databaseconfiguratie met de gecontroleerde bronrevisie. Pas na een geslaagde productierun is de wijziging live op het echte domein.

De integratie laat de Loci-hoofdapp, toegangsbescherming en onderhoudsstand intact. De publieke Supabase-browserconfiguratie bevat geen beheersleutel. De serviceworker van Loci slaat Kunstkiezer over. Oude browseropslag op de preview wordt niet automatisch naar het productiedomein overgezet.

Sinds 10 oktober 2026 slaat Cloudflare Access uitsluitend `www.loci-amsterdam.nl/kunstkiezer` en onderliggende paden over, met toestemming van de beheerder. Bezoekers krijgen daar geen extra Cloudflare-e-mailcode. Persoonlijke gegevens en beheer blijven beschermd door Supabase-accountrechten. De kaart haalt de browserconfiguratie op via `/kunstkiezer/api/basemap-config`; de Loci-hoofdapp en zijn API-paden blijven afgeschermd. De productiecontrole test Kunstkiezer zonder Access-servicegegevens.
