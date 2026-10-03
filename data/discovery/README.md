# Onderzoeksbestanden Kunstkiezer

Momentopname: 3 oktober 2026. De vier JSON-bestanden vormen de eerste redactionele selectie. Supabase is daarna de bron voor de website en voor bewerkingen in de redactietool. De download **Onderzoeksbestand** blijft deze oorspronkelijke momentopname; het is geen export van latere redactiewijzigingen.

Elke vermelding bevat tags, een korte beschrijving, bronlinks, een selectieargument, bezoekinformatie en een publicatiestatus. Concepten zijn wel te bewerken, maar verschijnen niet in de publieke zoekresultaten. Afbeeldingen kunnen met maker, bron en licentie worden toegevoegd; de nieuwe verzamelingen bevatten nog geen fotoselectie.

## Kunst in de openbare ruimte

Alle 100 door BK-informatie als Sleutelwerk gemarkeerde werken zijn opgenomen. De officiële bron bevatte daarnaast 299 andere inzendingen: die zijn niet automatisch als Sleutelwerk overgenomen. `sleutelwerken-selectie.json` verantwoordt die afbakening.

Aanvullingen komen uit de collecties van Sculpture International Rotterdam, Kunst in Utrecht, CBK Groningen, Stroom Den Haag, Amsterdam Museum, Land Art Flevoland en 11fountains. De selectie richt zich op een onderscheidende kunstenaar, beeldtaal, ruimtelijke ervaring of relatie met de plek. Per vermelding staat het argument en de bijbehorende bron. Het maximum van 1000 is een bovengrens, geen vuldoel.

De Sleutelwerkenlijst bevat ook verdwenen, tijdelijke of verplaatste werken. Zonder voldoende bevestiging van de huidige locatie en bezoekmogelijkheid blijven deze concept. Ook andere nog niet op locatie uitgewerkte Sleutelwerken blijven concept. De lijst is dus vollediger dan de publieke selectie.

## Beeldentuinen en parken

Opgenomen zijn tuinen, parken, ensembles en routes met meerdere kunstwerken. Museumtuinen zijn waar mogelijk gekoppeld aan de bestaande museumvermelding. Losse beelden staan bij openbare kunst. De bronnen omvatten officiële instellingen en routes, aangevuld met onder meer NS Dagje Uit, BNNVARA/3 op Reis en toegankelijkheidsorganisatie KUBES. Buitenlandse delen van grensoverschrijdende routes vallen buiten de Nederlandse selectie.

Seizoenslocaties zonder lopende tentoonstelling blijven concept. Dit geldt op de onderzoeksdatum voor Lustwarande en de beeldentuin van Ruïne Ravesteyn. BIG Art & Garden is de huidige naam van de heropende beeldentuin in Gees.

## Architectuur

De Top 100-rubriek van Architectuurgids leverde 107 projectvermeldingen. Samen met de historische Top 100 van de Rijksdienst voor de Monumentenzorg (1990), na samenvoegen van 14 overlappingen, zijn dit 193 vermeldingen. Historische, gesloopte of niet als actuele bestemming bruikbare projecten blijven concept. Selectie als architectuur betekent niet dat een interieur openbaar toegankelijk is; de bezoektekst maakt dit onderscheid.

De publicatie **Nederlandse architectuur in 250 topstukken** van NAi010 is onderzocht via de uitgeversinformatie en het openbare inkijkexemplaar. Het gaat om archiefstukken en ontwerpen, waaronder onuitgevoerde ontwerpen, en niet om 250 zonder meer bezoekbare gebouwen. Het inkijkexemplaar bevat niet de volledige lijst. Daarom wordt deze eerste versie niet gepresenteerd als volledig getoetst aan alle 250 topstukken; er zijn geen onbevestigde NAi-labels toegevoegd.

## Tentoonstellingen en evenementen

Programma's van instellingen uit het museumbestand vormen de basis. Tips en recensies van KunstVensters, Museumtijdschrift en De Kunstmeisjes helpen bij de keuze; geselecteerde data zijn gecontroleerd bij de organisator. Dutch Design Week voegt een meerdaags evenement buiten museumzalen toe. De eerste selectie is niet uitputtend. Culty Pleasures/Instagram en afgeschermde landelijke kranten konden niet volledig worden beoordeeld en worden niet als geraadpleegde recensies opgevoerd.

De publieke agenda toont uitsluitend gepubliceerde, geopende vermeldingen waarvan de einddatum niet verstreken is en de begindatum uiterlijk één kalendermaand na vandaag ligt, gerekend in Europe/Amsterdam. Een evenement begint of eindigt inclusief die datum. Openingstijden binnen die periode worden niet voorspeld. De datumfilter werkt automatisch; nieuw programma-aanbod moet redactioneel worden toegevoegd.

## Import en behoud van redactiewerk

`npm run inventory:discovery` maakt SQL-batches. De import voegt ontbrekende records toe en overschrijft nooit bestaande records. Museumgegevens worden niet bijgewerkt door deze import. Redactie gaat via een atomaire opslagfunctie met controle op tussentijdse wijzigingen; interne notities zijn afgeschermd. De migratie staat in `supabase/migrations/20261003175631_discovery_collections.sql`.

Bronnen voor de niet volledig beschikbare NAi-selectie:
- https://www.nai010.com/product/nederlandse-architectuur-in-250-topstukken/
- https://0f77a1a0-1bb6-4924-b1a2-72921d7eed7e.filesusr.com/ugd/cd116f_6b7802a7d46442adb18b8da6bd1596a7.pdf
