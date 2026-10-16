# Oogstlaag: tentoonstellingen van de instellingen zelf

Deze scripts halen titel en **looptijd** rechtstreeks van de eigen website van een
instelling. Ze zijn gebouwd en gemeten op 16 oktober 2026 over 332 instellingswebsites uit
`kk_museums` en `kk_discoveries`, en vormen samen de werkwijze die in
`docs/wekelijkse-actualisatie.md` staat onder *Oogstmethoden die resultaat hebben gehad*.

Waarom niet via Instagram: een bio geeft een titel zonder datum ("Nu te zien: Dora Hitz").
De eigen website geeft de exacte looptijd, kent geen aanmeldmuur en geen snelheidslimiet.
Zonder looptijd mag een evenement niet gepubliceerd worden, dus de website is de bron.

## Draaien

Elke stap leest en schrijft JSON in een werkmap (`werkmap.py`), standaard `oogst-werk/`
naast de huidige map. Zet `KK_OOGST_WERKMAP` om twee rondes gescheiden te houden. Die
tussenbestanden horen niet in versiebeheer: het zijn momentopnamen van externe sites.

```sh
export KK_OOGST_WERKMAP=/pad/naar/ronde-2026-10-23
# instellingen.json: gepubliceerde, open instellingen met webadres, ontdubbeld op host
python3 scripts/oogst/vind-programmapagina.py      # -> programmapaginas.json
python3 scripts/oogst/oogst-overzichtspagina.py    # -> oogst.json
python3 scripts/oogst/ontdubbel.py                 # -> kandidaten.json
python3 scripts/oogst/filter-ruis.py               # -> kandidaten-schoon.json
```

Alleen Python uit de standaardbibliotheek; geen sleutels, geen installatie. De scripts
halen uitsluitend openbare pagina's op en omzeilen geen login-, betaal- of botmuur.

## De trechter, in deze volgorde

Stop bij de eerste stap die de looptijd geeft. De aantallen zijn gemeten, niet geschat.

| Stap | Script | Levert op |
| --- | --- | --- |
| 1. Overzichtspagina serverzijdig | `vind-programmapagina.py` + `oogst-overzichtspagina.py` | 105 van 264 instellingen, 292 tentoonstellingen |
| 2. Sitemap → detailpagina's | `sitemap.py` + `detailpaginas.py` | 35 van de 132 resterende, 864 URL's, in anderhalve minuut |
| 3. Links serverzijdig van het overzicht | `links-serverzijdig.py` + `detailpaginas.py` | 34 van de 95 resterende |
| 4. Machineleesbaar eindpunt | `api-eindpunt.py`, `agenda-eindpunt.py` | 19 van 61 met een agenda-eindpunt |
| 5. Browser, alléén voor de links | `oogst-in-browser.js` + `detailpaginas.py` | 2 van 6 geprobeerd — de dure stap |

Stap 2 en 3 kosten samen nog geen twee minuten en vragen geen browser. Stap 5 is een
andere kostenklasse: zes instellingen kostten evenveel aanroepen als stap 3 in zijn
geheel, en leverden één publiceerbare tentoonstelling op.

**De volgorde binnen de browserstap is omgekeerd aan wat je zou verwachten.** Laat de
browser het overzicht renderen en er alleen de *links* uit halen — één aanroep per
instelling — en haal de detailpagina's daarna gewoon serverzijdig op. Detailpagina's
blijken veel vaker serverzijdig leesbaar dan overzichten (TextielMuseum, Museum Belvédère,
Bonnefanten). Het echte werk gebeurt dan in goedkope Python.

## Het eindpunt achter de pagina

Een pagina die "door JavaScript wordt opgebouwd" haalt zijn gegevens ergens vandaan, en
dat eindpunt is bijna altijd serverzijdig op te halen. Beproefd en werkend:

- **Kirby:** de URL met `.json` erachter. Museum Arnhem biedt zo zijn hele programma aan,
  met titel, ondertitel, locatie, status en looptijd (`"10 okt. 2026 t/m 4 apr. 2027"`).
- **Eigen WordPress-posttypes**, te vinden via `/wp-json/wp/v2/types`: De Wieger heeft
  `expo`, Shimmer `exhibition`, Museum Slager `mec-events`, Elleboogkerk `tentoonstelling`.
- **iCal:** SIGN publiceert op `https://sign2.nl/events/?ical=1` 481 events met `DTSTART`,
  `DTEND`, `SUMMARY`, `URL` en `LOCATION`.
- **The Events Calendar:** `/wp-json/tribe/events/v1/events` (Brinkhuis Laren).

Vind je het eindpunt niet, open de pagina dan **eenmalig** in de browser en lees de
netwerkverzoeken. Dat is één browserbezoek per instelling, niet om te oogsten maar om de
ingang te vinden; daarna is die ingang voor altijd serverzijdig bruikbaar en hoort hij bij
de bron te worden vastgelegd.

Niet aangetroffen op deze sites: `__NEXT_DATA__`, `__NUXT__` of een andere ingebedde
JSON-toestand. Drupal's JSON:API staat bij KM21 uit.

## Nieuwsbrieven, zonder je aan te melden

Instellingen publiceren hun Mailchimp-archief zelf. Een aanmeldformulier post naar
`https://<naam>.<dc>.list-manage.com/subscribe?u=<u>&id=<id>`; met diezelfde `u` en `id`
staat het archief op `https://<dc>.campaign-archive.com/home/?u=..&id=..` en de feed op
`/feed?u=..&id=..`.

```sh
python3 scripts/oogst/nieuwsbrief-dienst.py    # herkent de dienst  -> nieuwsbrieven.json
python3 scripts/oogst/nieuwsbrief-archief.py   # leidt u/id af      -> mailchimp-archieven.json
python3 scripts/oogst/nieuwsbrief-feed.py      # leest de feed      -> nieuwsbrief-feeds.json
python3 scripts/oogst/nieuwsbrief-lezen.py     # leest de brieven   -> brieven.json
```

Gemeten over 332 instellingen: 71 met een herkenbare dienst (34 Mailchimp, 22 eigen
formulier, 6 MailerLite, 5 Spotler, 4 Laposta), 21 af te leiden archiefadressen, 20
werkende feeds, 81 nieuwsbrieven in 120 dagen, plus 180 pers- of nieuwspagina's.

De waarde zit niet in het aantal maar in de soort informatie. Nieuwsbrieven melden
**verlengingen en verzette openingen** — Ruud Kuijer in het Kröller-Müller verlengd tot
6 december, de opening van DEATH & MONEY bij Brutus een dag verzet — en dat staat op geen
enkele overzichtspagina. Werk daarvoor een bestaand record bij in plaats van een tweede
aan te maken. De echte opbrengst zijn de 43 **links** naar eigen detailpagina's: daarmee
is het linkprobleem opgelost voor sites waar overzicht én sitemap niets gaven.

## Valkuilen die geld hebben gekost

- **Bevestig titel en looptijd altijd op de detailpagina van de instelling.** Het
  overzicht van FENIX las als looptijd wat in werkelijkheid een sluitingsbericht was
  ("t/m 6 november is de tentoonstelling gesloten"), en het TextielMuseum koppelde elke
  titel aan de looptijd van de buurman. Zo zou een drie weken afgelopen tentoonstelling
  met verkeerde datums in de agenda zijn beland.
- **De volgorde van titel en datum verschilt per site.** De Pont zet de titel vóór de
  looptijd, het TextielMuseum en het Bonnefanten erna. `oogst-in-browser.js` geeft daarom
  bij elk datumbereik zowel het label ervóór als erna terug; de detailpagina beslist.
- **Toets op een datumBEREIK, niet op een losse datum.** 24 van 61 sites hebben
  `/wp-json/wp/v2/pages`, maar de datums daarin zijn publicatie- en wijzigingsdatums van
  gewone pagina's. Van 28 ogenschijnlijke treffers hielden er vier een echt bereik over.
  Een posttype met de juiste naam is evenmin een garantie: Elleboogkerks `tentoonstelling`
  bevat "Test voorstelling 1 t/m 4" en het `portfolio` van het Anton Pieck Museum is de
  webwinkel.
- **Een agenda is geen zaal.** Kunstpunt Groningen voert de agenda voor stad en provincie;
  die presentaties staan in Zoutkamp, Martiniplaza en Haren. `bezoekadres.py` haalt het
  adres uit de aankondiging zelf, `geocode.py` zoekt het op via Nominatim (eigen
  User-Agent, maximaal één verzoek per seconde). Gebruik alleen een treffer **met
  huisnummer**; een postcode of plaatsnaam is geen objectpunt. Dezelfde fout dreigt bij
  federatiesites: via museum.frl leken drie tentoonstellingen van het Ruurd Wiersma Museum
  te zijn terwijl ze bij Natuurmuseum Fryslân en Museum Opsterlân hoorden.
- **Bij The Events Calendar staat elke dag van een tentoonstelling als apart event.** Neem
  per titel de vroegste en de laatste dag; zet de events niet één op één over.
- **Ruime leeslimiet bij feeds.** Negen Mailchimp-feeds leken stuk met `ParseError`; de
  oorzaak was een eigen leescap van 1,5 MB die een CDATA-blok middendoor knipte. Deze
  archieven zijn groter dan 2 MB. Met 25 MB werken 20 van de 21 feeds en komen er 81
  nieuwsbrieven binnen in plaats van 42.
- **Onderwerpregels van nieuwsbrieven zijn aankondigingen, geen titels** ("Nu geopend.
  Henk Helmantel!"). Ontdubbelen op de onderwerpregel geeft veel vals alarm; ontdubbel op
  de titel van de detailpagina.
- **Een kandidaat is een tip, geen record.** Op een steekproef van 25 kandidaten met
  volledige looptijd waren achttien bruikbaar en zeven ruis: navigatiekoppen ("Straks te
  zien", "December"), een zaalnaam, een workshop. Datums zijn betrouwbaarder dan titels.

## Wat niet werkte

- **De krantenfeeds leverden geen enkel record.** Van 23 kunstartikelen over 28 dagen
  bleken er veertien niet over een tentoonstelling te gaan, en alles wat wél een
  Nederlandse tentoonstelling noemde stond al in de catalogus. Als tipkanaal voor de
  agenda is de krant zwak; de instellingen zelf zijn sneller en completer.
- **Alleen Mailchimp publiceert archieven.** Van 37 instellingen met MailerLite, Spotler,
  Laposta, YMLP of een eigen formulier had er geen één een openbaar archief. Wat die sites
  "archief" noemen zijn hun eigen afgelopen tentoonstellingen.
- **Sites waar ook de detailpagina zijn datums in JavaScript zet** (KM21, Drents Museum
  achter de cookiemelding, Rembrandthuis dat pas bij scrollen laadt). De tekst is wel te
  lezen, de looptijd niet. Daar is een headless browser nodig die élke detailpagina
  rendert; dat hoort in de Worker, niet in losse aanroepen.

## De bestanden

| Script | Doet |
| --- | --- |
| `werkmap.py` | Waar de tussenbestanden staan; `arg(n, standaard)` om een stap over een tweede lijst te draaien |
| `extract.py` | Titel en looptijd uit een pagina: eerst JSON-LD `Event`, anders datumbereiken gekoppeld aan de kop erboven |
| `vind-programmapagina.py` | Kiest op de homepage de link die het meest op een tentoonstellingsoverzicht lijkt |
| `oogst-overzichtspagina.py` | Haalt elke programmapagina op en past de extractor toe |
| `ontdubbel.py` | Vergelijkt met `kk_discoveries` op genormaliseerde titel; weg bij gelijkenis ≥ 0,82 |
| `filter-ruis.py` | Haalt navigatiekoppen, datumcodes, oproepen en niet-beeldende evenementen eruit |
| `sitemap.py` | Leest `robots.txt` en de sitemap, volgt een sitemap-index, filtert tentoonstellings-URL's |
| `detailpaginas.py` | Haalt een lijst detailpagina's serverzijdig op; in- en uitvoer via de opdrachtregel |
| `links-serverzijdig.py` | Plukt de links naar afzonderlijke tentoonstellingen uit de HTML van het overzicht |
| `detail-per-kandidaat.py` | Zoekt bij een openstaande kandidaat de eigen detailpagina en leest daar de looptijd |
| `api-eindpunt.py` | Tast `.json`, `/wp-json/...` en `/api/...` af |
| `agenda-eindpunt.py` | Tast The Events Calendar, iCal en eigen posttypes af |
| `nieuwsbrief-dienst.py` | Herkent de nieuwsbriefdienst en vindt pers- en nieuwspagina's |
| `nieuwsbrief-archief.py` | Leidt het openbare archiefadres af uit het aanmeldformulier |
| `nieuwsbrief-feed.py` | Leest de archieffeed: titel, datum, link, inhoud |
| `nieuwsbrief-lezen.py` | Leest de campagnepagina's volledig uit (inhoud staat achter de taalkiezer, die eindigt op "Tiếng Việt") |
| `bezoekadres.py` | Haalt de werkelijke bezoeklocatie uit een detailpagina |
| `geocode.py` | Zoekt dat adres op via Nominatim; alleen treffers met huisnummer zijn bruikbaar |
| `oogst-in-browser.js` | Draait ín een gerenderde pagina en geeft bij elk datumbereik het label ervóór én erna |

De uitkomst van een ronde is een lijst kandidaten, geen publicatie. Publiceren gebeurt
volgens `docs/publicatie.md` en de stappen in `docs/wekelijkse-actualisatie.md`.
