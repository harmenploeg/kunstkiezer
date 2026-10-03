# GitHub en Cloudflare aansluiten

## Bestemming

- Repository: `harmenploeg/kunstkiezer`, private als uitgangspunt, net als Loci.
- Subpagina: `https://loci-amsterdam.nl/kunstkiezer/`.
- Hosting: bestaande Cloudflare-account en zone.

## Repository

De huidige integratie weigerde repository-aanmaak. Zodra rechten beschikbaar zijn:

```sh
gh repo create harmenploeg/kunstkiezer --private --description 'Kunstagenda voor Nederland met Mijn kunstkeuze'
```

Sla dit over wanneer de repository al bestaat. Controleer eerst of deze leeg is. De lokale basis is al geïnitialiseerd en gecommit. Voeg de remote toe en push main. Geen force-push; geen .env, dependencies of buildoutput opnemen.

De installatie onder harmenploeg omvat alle repositories en heeft contents/workflows/actions write, maar geen repository-aanmaakrecht. Een bredere selectie van repositories of een wijziging aan ChatGPT-goedkeuringsinstellingen lost dit niet op.

De eenvoudigste herstelroute is een lege private repository maken via https://github.com/new?name=kunstkiezer onder harmenploeg, zonder README, licentie of .gitignore. Daarna kan de bestaande koppeling worden gebruikt om de gecontroleerde bron te pushen. Controleer na aanmaak dat de nieuwe repository bereikbaar is.

## Cloudflare

Configureer credentials via de beveiligde omgeving of GitHub environment secrets:

- `CLOUDFLARE_API_TOKEN`: Account / Workers Scripts / Edit, Zone / Workers Routes / Edit en Zone / Zone / Read, beperkt tot de bedoelde account en loci-amsterdam.nl.
- `CLOUDFLARE_ACCOUNT_ID`: account-ID als omgevingsvariabele of GitHub environment variable.

Maak een custom token via https://dash.cloudflare.com/profile/api-tokens. Account-ID staat op het account-/zoneoverzicht van Cloudflare. Voeg token en account-ID via beveiligde omgevingsinstellingen toe; deel de token niet in chat. Voor deze sessie is een environmentbinding nodig om account en routes te inspecteren; alleen een GitHub secret volstaat daarvoor niet.

Op 3 oktober is ook `wrangler whoami` gecontroleerd: niet aangemeld. De pluginzoektocht leverde geen Cloudflare-plugin op. Er is dus geen alternatieve geverifieerde Cloudflare-toegang binnen deze sessie. Een tijdelijk previewaccount is geen oplossing voor publicatie op de bestaande zone.

Controleer huidige Workers-routes, eventuele Cloudflare Access-regels en de actieve bron van loci-amsterdam.nl vóór productie. Bestaande routes niet blind overschrijven. Nieuwe routes zijn beperkt tot `/kunstkiezer` en `/kunstkiezer/*`; `/kunstkiezer-anders` wordt niet geclaimd.

## Publicatievolgorde

1. `npm ci` en `npm run check`.
2. `npm run test:e2e`; bouwt frontend en test lokale Worker.
3. `npm run deploy:staging`; controleer `/kunstkiezer/` op de geretourneerde workers.dev-URL.
4. Publiceer de passende serviceworkerpatch uit `integration/` in de actieve Loci-bron.
5. Test vanuit een browser met een bestaande Loci-serviceworker.
6. `npm run deploy:production`, of start de expliciete GitHub Actions-publicatieworkflow.
7. Controleer root-Loci, Kunstkiezer, assets, dieplinks en API-health.

Een geslaagde build of dry-run is geen live-publicatie. Meld een staging-URL pas nadat Cloudflare deze heeft teruggegeven.

## Serviceworkerpatch

Na controle op overeenkomende bron, in de actieve checkout:

```sh
git apply --check /pad/naar/integration/loci-service-worker.patch
git apply /pad/naar/integration/loci-service-worker.patch
```

Gebruik de cloudflare-patch wanneer die repository de actieve bron is. Patches zijn gebaseerd op de commits uit `docs/fase-1.md`. Pas ze aan als de bron gewijzigd is. Kunstkiezer registreert zelf nog geen serviceworker.

## Herstel

Leg de bestaande routes vast vóór publicatie. Bij problemen: verwijder uitsluitend de nieuwe Kunstkiezer-routes of herstel een vorige Kunstkiezer-Worker-versie. Loci-root en DNS blijven behouden. Databaseherstel is een aparte procedure zodra migraties bestaan.
