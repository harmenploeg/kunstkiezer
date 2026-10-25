# Publiceren naar Loci

Het productiedomein is **https://kunstkiezer.loci-amsterdam.nl/**, een eigen Cloudflare Pages-project (`loci-kunstkiezer`). Tot systeemaudit stap 1.3 (oktober 2026) stond de Kunstkiezer onder `www.loci-amsterdam.nl/kunstkiezer/`. Dat pad verwijst nu met een 301 door naar hetzelfde pad op het subdomein. De workflow `preview-pages.yml` publiceert alleen `kunstkiezer.pages.dev`; een succesvolle preview-deployment bevestigt geen productiepublicatie.

Productie gebruikt de gecontroleerde publicatieketen van `harmenploeg/interactief`:

1. Test Kunstkiezer met `npm run check` en de relevante browsertests, bouw de te publiceren revisie.
2. Gebruik een schone, actuele checkout van `harmenploeg/interactief` en voer vanuit Kunstkiezer `node scripts/sync-loci.mjs /pad/naar/interactief` uit. Dat vult daar `kunstkiezer/` (de build) en `kunstkiezer-functies/` (de Pages Functions), en zet beide in `release-assets.json` onder `kunstkiezerFiles`.
3. Controleer daar de wijzigingen, `npm run check:release` en `node --test tests/kunstkiezer-pages.test.mjs`.
4. Commit en push de integratie naar `interactief/main`. Wacht op `Controleer LOCI-publicatiepakket`, inclusief de herbruikbare `deploy-checked.yml`-workflow. Die publiceert de Kunstkiezer vóór de app. Omzeil deze controles niet door het Pages-project handmatig te overschrijven.
5. De productiecontrole vergelijkt `/version.json`, pagina’s, alle JS/CSS-assets en de databaseconfiguratie op het subdomein met de gecontroleerde bronrevisie, en controleert de doorverwijzing vanaf het oude pad. Pas na een geslaagde productierun is de wijziging live.

Op het eigen subdomein draait de Kunstkiezer los van Loci: geen Cloudflare Access, geen Loci-onderhoudsstand en geen Loci-serviceworker. Persoonlijke gegevens en beheer blijven beschermd door Supabase-accountrechten. De publieke Supabase-browserconfiguratie bevat geen beheersleutel. De kaart haalt zijn sleutel op via `/api/basemap-config`; die staat als geheim `LOCI_CARTO_BASEMAP_KEY` op het Pages-project. Browseropslag gaat niet mee naar een ander domein: wie ingelogd was onder `www.loci-amsterdam.nl/kunstkiezer`, logt op het subdomein één keer opnieuw in.

In Supabase (project `qrlfywcqkkzmerglmsbj`) staan het subdomein als *Site URL* en als toegestane redirect, en de functies `delete-account` en `manage-users` laten het als herkomst toe. De oude adressen blijven tijdens de overgang toegestaan.
