# Onderzoeksbestanden Kunstkiezer

Momentopname: **4 oktober 2026**. Supabase is de actuele bron voor de website en redactietool. De vijf JSON-bestanden zijn gecontroleerde exports; latere redactiewijzigingen worden pas bij een volgende export in downloads opgenomen.

## Selectie en huidige dekking

- **300 kunstmusea en kunstinstellingen**, inclusief fotografie, design, kunstenaarsmusea en kunsthallen. Algemene erfgoedlocaties met kunst als bijzaak vallen buiten deze categorie.
- **127 openbare kunstwerken**, waaronder alle 100 officiële Sleutelwerken. De overige 299 inzendingen op Sleutelwerken zijn niet automatisch overgenomen. Aanvullingen komen uit gemeentelijke en institutionele collecties, onder andere Rotterdam, Utrecht, Groningen, Den Haag, Amsterdam, Flevoland en 11fountains. Het maximum van 1000 is een bovengrens, geen vuldoel. Selectieargumenten staan per werk vermeld.
- **39 beeldentuinen, parken en routes** met meerdere werken. Museumtuinen kunnen ook bij hun museum horen. Losse beelden zijn geen beeldentuin.
- **188 gepubliceerde architectuurvermeldingen** en vijf gearchiveerde dubbelen. De Architectuurgidsselectie en historische RDMZ Top 100 blijven via samengevoegde bronnen vertegenwoordigd. Een vermelding betekent niet dat het interieur toegankelijk is.
- **66 tentoonstellingen en evenementen** met begin- en einddatum van de organisator. Op de onderzoeksdatum vallen 65 binnen het agendavenster.

De gebruiker heeft publicatie van de geselecteerde concepten gevraagd. Tijdelijke sluiting, historische uitvoering en onzekerheid over een bezoekplek worden daarom met een aparte bedrijfsstatus en bezoektekst beschreven. Ze worden niet stilzwijgend als open bestempeld. Vijf echte dubbele architectuurrecords zijn gearchiveerd; hun bronnen zijn bij het behouden record opgenomen.

## Inhoudelijke controle

Deze actualisatie verbetert 378 bestaande records en voegt 24 records toe. De wijzigingen, oorspronkelijke veldwaarden en verwachte wijzigingstijd staan in `../curation/2026-10-04-changes.json`. De database-update controleerde iedere wijzigingstijd en heeft geen tussentijdse of handmatige redactiewijzigingen overschreven.

91 Sleutelwerken en 187 architectuurvermeldingen kregen specifieke, opnieuw geschreven beschrijvingen. De twee werken met de naam Observatorium zijn uit elkaar gehaald: Krijn de Koning in Deventer en Robert Morris in Flevoland. Het oude adres van het Feestaardvarken geldt niet langer als actuele bezoeklocatie. Foto's uit Commons vermelden maker, bron en licentie. Museumfoto's bij evenementen zijn expliciet als locatiebeeld aangeduid. Historische opnamen zijn waar herkenbaar als zodanig beschreven.

Coördinaten uit objectbeschrijvingen en exact passende BAG-adressen vervangen veel plaatsmiddelpunten. Straat- en plaatsnauwkeurigheid blijven herkenbaar; een secretariaatadres of een willekeurig punt op een route wordt niet als exacte kunstlocatie gebruikt.

## Open punten en wekelijkse actualisatie

`../curation/latest-report.json` bevat aantallen en **per record** de resterende foto-, locatie- en bezoekvragen. Genereer het met `node scripts/audit-catalogs.mjs YYYY-MM-DD`, nadat de bestanden opnieuw met de database zijn vergeleken. Foto's zonder bevestigde hergebruikvoorwaarden staan apart in `../curation/2026-10-04-pending-photo-rights.json`; deze kandidaten zijn niet als vrij herbruikbaar gepubliceerd.

De wekelijkse actualisatie is ingesteld op maandag 09.00 uur, Europe/Amsterdam. Het werkprotocol staat in `../../docs/wekelijkse-actualisatie.md`. De agenda vervalt automatisch op einddatum, maar nieuwe tentoonstellingen worden redactioneel toegevoegd na broncontrole.

De publieke agenda toont gepubliceerde evenementen die al bezig zijn of uiterlijk één kalendermaand na vandaag beginnen; de einddatum moet vandaag of later zijn. Amsterdamse tijd, inclusieve einddatums en echte kalendermaanden gelden. Binnen deze datumperiode garandeert een vermelding geen dagelijkse opening: raadpleeg de organisator.

## Onderzoeksbeperkingen

De NAi010-publicatie **Nederlandse architectuur in 250 topstukken** bevat ook archiefstukken en onuitgevoerde ontwerpen. Het beschikbare inkijkexemplaar bevat niet de hele lijst. Volledige vergelijking met alle 250 is dus nog niet onderbouwd; er zijn geen fictieve NAi-selectielabels toegevoegd.

Toegankelijke tips van KunstVensters, Museumtijdschrift en De Kunstmeisjes en museumprogramma's ondersteunen de evenementenselectie. Afgeschermde kranten en Instagram/Culty Pleasures worden niet opgevoerd alsof ze volledig geraadpleegd zijn. De catalogus is een onderbouwde selectie, geen aantoonbaar volledige inventaris van elk Nederlands kunstaanbod.

## Herhaalbare import

`npm run inventory:discovery` genereert invoegbatches inclusief coördinaten en precisie. Deze voegen alleen ontbrekende records toe. Bestaande records worden nooit vervangen door een oude bestandsversie. Correcties aan bestaande gegevens vereisen controle van de actuele `updated_at`, behoud van redactiewerk en verificatie achteraf. De specifieke correcties van 4 oktober zijn al toegepast; voer ze niet ongecontroleerd opnieuw uit.
