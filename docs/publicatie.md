> **Actualisatie 29 oktober 2026:** het oude pad op `www.loci-amsterdam.nl` verwijst
> met HTTP 301 naar **https://loci-kunstkiezer.pages.dev/**. De huidige publieke
> configuratie staat daar op `/api/config`. Een controle van alleen het oude pad
> of een andere preview is geen bewijs van productie. Voor voorstelwijzigingen
> geldt tevens [voorstellen-verwerken.md](voorstellen-verwerken.md): controleer de
> publieke databasegegevens, de bronrevisie en de vijf gecontroleerde downloads
> op de daadwerkelijke productie. De bestaande gecontroleerde integratieketen
> mag niet worden omzeild.

# Publiceren naar Loci

Het productiedomein is voorlopig **https://loci-kunstkiezer.pages.dev/**, een eigen Cloudflare Pages-project (`loci-kunstkiezer`). Het subdomein **https://kunstkiezer.loci-amsterdam.nl/** staat al aan het project gekoppeld en volgt zodra de DNS-regel bij Soverin er is (`kunstkiezer` → CNAME → `loci-kunstkiezer.pages.dev`). Tot systeemaudit stap 1.3 (oktober 2026) stond de Kunstkiezer onder `www.loci-amsterdam.nl/kunstkiezer/`. Dat pad verwijst nu met een 301 door naar hetzelfde pad op het eigen domein. Deze repo publiceert zelf niets. Het oude previewproject `kunstkiezer.pages.dev` wordt sinds 26 oktober 2026 niet meer bijgewerkt; de workflows die ernaar publiceerden zijn op 29 oktober verwijderd, samen met hun Cloudflare-sleutel.

Productie gebruikt de gecontroleerde publicatieketen van `harmenploeg/interactief`:

1. Test Kunstkiezer met `npm run check` en de relevante browsertests, bouw de te publiceren revisie.
2. Gebruik een schone, actuele checkout van `harmenploeg/interactief` en voer vanuit Kunstkiezer `node scripts/sync-loci.mjs /pad/naar/interactief` uit. Dat vult daar `kunstkiezer/` (de build) en `kunstkiezer-functies/` (de Pages Functions), en zet beide in `release-assets.json` onder `kunstkiezerFiles`.
3. Controleer daar de wijzigingen, `npm run check:release` en `node --test tests/kunstkiezer-pages.test.mjs`.
4. Commit en push de integratie naar `interactief/main`. Wacht op `Controleer LOCI-publicatiepakket`, inclusief de herbruikbare `deploy-checked.yml`-workflow. Die publiceert de Kunstkiezer vóór de app. Omzeil deze controles niet door het Pages-project handmatig te overschrijven.
5. De productiecontrole vergelijkt `/version.json`, pagina’s, alle JS/CSS-assets en de databaseconfiguratie op het eigen domein met de gecontroleerde bronrevisie, en controleert de doorverwijzing vanaf het oude pad. Pas na een geslaagde productierun is de wijziging live.

Op het eigen domein draait de Kunstkiezer los van Loci: geen Cloudflare Access, geen Loci-onderhoudsstand en geen Loci-serviceworker. Persoonlijke gegevens en beheer blijven beschermd door Supabase-accountrechten. De publieke Supabase-browserconfiguratie bevat geen beheersleutel. De kaart haalt zijn sleutel op via `/api/basemap-config`; die staat als geheim `LOCI_CARTO_BASEMAP_KEY` op het Pages-project. Browseropslag gaat niet mee naar een ander domein: wie ingelogd was onder `www.loci-amsterdam.nl/kunstkiezer`, logt op het nieuwe adres één keer opnieuw in, en bij de latere overstap naar het subdomein nog één keer.

In Supabase (project `qrlfywcqkkzmerglmsbj`) staat `https://loci-kunstkiezer.pages.dev/account` als *Site URL*. Zowel `loci-kunstkiezer.pages.dev` als het subdomein staan als toegestane redirect, en de functies `delete-account` en `manage-users` laten beide als herkomst toe. De oude adressen blijven tijdens de overgang toegestaan.
