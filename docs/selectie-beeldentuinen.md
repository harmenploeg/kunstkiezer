# Beeldentuinen: landelijke ontdekking en bezoekbaarheid

Een bestaande catalogus nalopen is geen inventarisatie van ontbrekend aanbod. Zoek daarom bij iedere bronnenronde ook nieuwe locaties; de lijst van 42 door de beheerder aangeleverde tuinen is een regressiebasis, geen maximum of volledigheidsbewijs. Het resultaat van de vergelijking staat in `data/curation/2026-10-04-beeldentuinen-uitbreiding.json`.

## Zoeken per provincie en type

Houd voor alle twaalf provincies bij welke gemeenten/regio's en typen onderzocht zijn. Zoek afzonderlijk op beeldentuin, beeldenpark, sculpturentuin, beeldenbos, kunsttuin, galerie met tuin, atelier met tuin, museumtuin en samenhangende beeldenroute. Combineer dit met provincies, gemeenten en kunstenaarsnamen. Neem ook kleine particuliere tuinen, galeries met verkoop en bezoek op afspraak mee wanneer meerdere originele kunstwerken daadwerkelijk buiten te zien zijn. Een losse sculptuur, tuincentrum met decoratie of uitsluitend webverkoop is geen beeldenpark.

Gebruik binnen de ingeschakelde bronnenpool regionale toeristische organisaties, gemeentelijke cultuurinventarissen, open-atelier- en open-tuinenroutes en kunstenaars-/galeriesites naast landelijke overzichten. Doorzoek relevante vervolgpagina's en deelnemerslijsten. Volg namen van exposerende kunstenaars naar andere buitenlocaties. Vergelijk alle musea op museumtuinen en alle openbare-kunstrecords op samenhangende ensembles. Beoordeel een vondst tevens voor de andere categorieën, zonder een gewone galerie automatisch als museum aan te merken.

Leg per zoekactie zoekterm, provincie, bron-URL, controledatum, kandidaten en uitsluitingsreden vast. Minimaal twee verschillende bronsoorten per provincie voordat die provincie 'onderzocht' heet. Alleen een zoekresultaat of bereikbare homepage is onvoldoende. Een ronde zonder vondsten bewijst geen landelijke volledigheid. Wissel bij wekelijkse verdieping provincies af en begin bij nog niet onderzochte gebieden; controleer nieuwe tips direct.

## Identiteit en verificatie

Dedupliceer op adres, terrein, coördinaten, eigenaar en oude namen: Pluck Elke Dag is de opvolger van Beeldentuin Witharen. Aparte locaties van De Buffel zijn afzonderlijke records. Clingenbosch is niet de vrij toegankelijke tuin van Voorlinden; het SculptuurDuin is niet de SprookjesBeelden op de boulevard. Bewaar beide wanneer toegang, terrein en presentatie verschillen.

Bevestig collectie en bezoek bij de eigenaar of terreinbeheerder. Een lokale cultuurroute of VVV-vermelding is aanvullend bewijs; noteer het expliciet wanneer alleen die bron beschikbaar is. Gebruik geen openingstijden van de galerie voor de tuin zonder bevestiging. Oude nieuwsberichten zijn aanwijzingen, geen bewijs van de huidige situatie.

## Bezoekbeperkingen

- Regulier open: `open`, met concrete bezoekuren.
- Op afspraak of alleen groepsbezoek: kan `open` zijn, maar vermeld de beperking vooraan in `visit_notes`. Geen vrije inloop suggereren.
- Buiten seizoen, geen tentoonstelling dit jaar of een volledig uitverkochte reeks: niet als gewone actuele bezoekmogelijkheid publiceren. Bewaar als `temporarily_closed` met concrete reden en hercontrolemoment. Uitverkocht betekent niet dat de instelling verdwenen is.
- Definitief beëindigde publiekslocatie: `disappeared`, bewaren in het archief tegen herimport. Een doorlopend atelier verandert een permanent gesloten beeldentuin niet in een open tuin.
- Onbekend of tegenstrijdig: dossier bewaren, onzekerheid intern vastleggen; geen ongefundeerde openstatus.

Controleer seizoenseinde en aangekondigde heropening wekelijks. Schrijf nooit automatisch het jaartal door. Check bij gereserveerde toegang ook de ticketpagina: een algemene bezoekpagina kan nog een uitverkocht seizoen noemen. Breng seizoensuren niet onder in evenementdatums van een permanente locatie.

## Kwaliteit en voortgang

Beschrijvingen maximaal 80 woorden, inhoudelijke voorkeurtags en afzonderlijke makerinformatie. Een fotograaf is geen maker van het onderwerp. Gebruik alleen foto's met aantoonbare hergebruikvoorwaarden; bewaar ontbrekende foto's als open dossierpunt. Geen foto van een ander park als opvulling. Gebruik het officiële bezoekadres en controleer PDOK-resultaten inclusief huisletter en toevoeging. Onbekende exacte coördinaten blijven onbekend; een straatpunt wordt als straatniveau gemarkeerd.

De wekelijkse taak leest dit protocol naast het protocol voor openbare kunst. De live tabel `kk_update_sources` blijft leidend; herstellen van uitgeschakelde bronnen uit deze documentatie is niet toegestaan. Werk `data/curation/garden-coverage.json` en de catalogusaudit bij na vergelijking met de actuele database. Bestaande redactiewijzigingen behouden en eventuele updates beschermen met `updated_at`.
