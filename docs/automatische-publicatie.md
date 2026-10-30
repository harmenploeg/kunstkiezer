# Automatische verwerking en publicatie

De beheerder heeft op 30 oktober 2026 gevraagd de Kunstkiezer automatisch bij te
werken zodra er resultaten zijn. De bestaande lokale vijfminutenrunner doet dit
met gewone code, zonder extra AI-beoordelingen of aparte OpenAI-API-kosten.

## Wat automatisch mag

Beleid `primary-facts-v1` accepteert uitsluitend wijzigingen aan bestaande records
met vers bewijs (maximaal 48 uur) op de officiële website uit het record zelf:

- expliciet beschreven huidige bedrijfsstatus (open/heropend, tijdelijk of definitief gesloten);
- begin- en einddatums die concreet met dag, maand en jaar in het citaat staan;
- bezoekinformatie die letterlijk in het broncitaat voorkomt.

Ontkenningen, onzekere/toekomstige statuswijzigingen, ontbrekende primaire bronnen,
verouderd bewijs en vrije samenvattingen blijven ter beoordeling. Nieuwe kandidaten
bevatten in het voorstel alleen naam/URL/citaat; ze worden pas na completering en
selectiecontrole toegevoegd. Een lege wijzigingenlijst verandert niets.

## Uitvoering

`automatic-publication.mjs` selecteert lokale voorstellen, controleert het beleid
en bewaart één actieve publicatiestaat. Een bestaande verzamelwachtrij loopt eerst
af: de databasewriter weigert iedere overlappende update. Daarna geeft de service
voorrang aan het afmaken van de publicatie vóór nieuwe bronrondes.

`controlled-publisher.mjs` gebruikt per voorstel een geïsoleerde checkout onder
`.local-updater/publications/<vingerafdruk>/`. De bestaande werkcheckout en eigen
redactiewerk worden niet gebruikt voor de release. Vóór databasewijziging wordt de
versiebeheerde export op conflicten gecontroleerd. Daarna volgen exacte
vingerafdrukgoedkeuring namens de beheerder, verse bewijscontrole, de bestaande
atomaire databasewriter en audit, teruglezen en gerichte export van de vijf downloads.

De broncheckout doorloopt `npm run check`. De runner opent een bron-PR en wacht op
`Controle` voor de exacte commit. Hij merge alleen de gecontroleerde PR-head en
wacht ook op de main-controle. Vervolgens bouwt hij de bronrevisie, synchroniseert
naar een geïsoleerde actuele integratiecheckout, voert de integratiecontroles uit
en opent de integratie-PR. Alleen na `Controleer LOCI-publicatiepakket` voor de
exacte PR-head wordt gemerged. Er worden geen admin-bypasses of force-pushes gebruikt.

De runner wacht vervolgens op de gecontroleerde productie-uitrol voor de
mergecommit. De bestaande verifier controleert de productiecheck, bronrevisie,
audit, publieke databasegegevens en de hashes van alle vijf downloads op
https://kunstkiezer.loci-amsterdam.nl. Pas daarna staat de publicatie op `verified`.

Databasewijzigingen zijn in Supabase direct beschikbaar; de statische uitrol volgt
daarna. Bij een uitrolfout wordt geen succes gemeld en blijft de publicatie
hervatbaar. Het proces voert geen automatische rollback over latere redactiewijzigingen uit.

## Herstel en bediening

De deterministische voorstelvingerafdruk voorkomt dubbele databasewrites. Commit-
en PR-identiteiten worden bewaard vóór vervolgstappen; een verloren antwoord na
merge wordt via GitHub teruggelezen. Bij tijdelijke fouten volgt maximaal drie keer
een poging met dertig minuten tussenruimte. Een geweigerde CI, gewijzigde PR-head,
inhoudsconflict of blijvende fout blokkeert de publicatie en geeft een lokale melding.
De geblokkeerde publicatie krijgt voorrang en vereist herstel voordat nieuwe rondes
worden verzameld. Deze stappen werken onafhankelijk van het resterende AI-dagbudget.

De lokale activatie staat in `.local-updater/activation.json` onder
`automatic_publication`: `enabled`, `policy` en `authorized_at`. Uitzetten kan met
`automatic_publication.enabled=false`; de gewone voorstelplanning blijft dan werken.
`enabled=false` op het hoofdniveau stopt beide processen.

De actuele staat staat in `.local-updater/automatic-publication.json` en
`.local-updater/laatste-publicatie.md`. Bij herstel: inspecteer eerst foutcode,
receipt, GitHub-PR en CI. Verander geen voorstel dat al is toegepast en maak geen
nieuwe run om dezelfde databasecorrectie opnieuw te schrijven. Na het oplossen van
een blokkade kan de eigen job weer op `pending`, met `attempts=0` en `retry_at=null`;
de bestaande fase en commit-identiteiten moeten intact blijven.

Supabase-toegang blijft in de macOS-Sleutelhanger. GitHub gebruikt de bestaande
`gh`-aanmelding. Buildprocessen krijgen geen Supabase-token of OpenAI-API-sleutel
via hun omgeving. De Mac moet aan staan en de gebruiker aangemeld zijn.
