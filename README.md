# Kunstkiezer

Modulaire kunstagenda voor Nederland, met Mijn kunstkeuze als startpunt.

## Fase 1

React/TypeScript frontend, gedeelde vormgeving en domeintypen, categorienavigatie, lege persoonlijke agenda en API-healthcheck. Er zijn nog geen accounts, opgeslagen keuzes of echte catalogusgegevens.

`npm ci` en `npm run check` controleren types, routes en de productiebuild. `npm run test:e2e` controleert navigatie op mobiel en desktop.

## Cloudflare

De bestaande hoofdsite is Cloudflare Pages-project `interactief`, gekoppeld aan `harmenploeg/interactief` en `www.loci-amsterdam.nl`. Kunstkiezer wordt bedoeld voor `/kunstkiezer/` binnen die site.

De workflow Publicatievoorbereiding levert een build-artifact. Deze publiceert nog niet. De integratie met de bestaande gecontroleerde Pages-publicatie moet nog worden toegevoegd. De Worker-configuratie is uitsluitend geschikt voor lokale routetests en is niet de huidige productieaanpak.

GitHub Actions gebruikt later het repository-secret `CLOUDFLARE_API_TOKEN` en de variable `CLOUDFLARE_ACCOUNT_ID`. Sla tokens nooit op in broncode.
