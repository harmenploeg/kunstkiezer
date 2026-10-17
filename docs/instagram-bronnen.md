# Instagram als bron

De 227 Instagramaccounts in `kk_update_sources` zijn een tipkanaal: een bericht noemt een
titel en een instelling, zelden een volledige looptijd. De looptijd haal je daarna op de
eigen website van de instelling, volgens de werkwijze in `scripts/oogst/LEESMIJ.md`. Zonder
begin- én einddatum mag er niets gepubliceerd worden.

Er zijn twee routes, in deze volgorde.

## 1. De Graph API, met `business_discovery` (de vaste route)

Meta verbiedt geautomatiseerd verzamelen zonder schriftelijke toestemming, en de anonieme
route loopt na ongeveer honderd profielen tegen een snelheidslimiet aan. `business_discovery`
is de ingang die Meta er zelf voor heeft: de eigen app van de beheerder vraagt publieke
gegevens op van een ander zakelijk account.

```sh
python3 scripts/oogst/instagram-graph.py --droogproef   # wie is aan de beurt
python3 scripts/oogst/instagram-graph.py                # een partij van 25 accounts
```

Het script leest de ingeschakelde accounts uit `kk_update_sources`, werkt ze af op volgorde
van wie het langst niet gelezen is, en bewaart die rotatie in
`~/.config/kunstkiezer/instagram-rotatie.json`. Zo komt in een paar weken de hele pool
langs zonder in één ronde tegen een limiet te lopen. Loopt hij toch tegen een limiet of een
verlopen token aan, dan stopt hij meteen en blijft de rest van de partij staan.

**Wat de beheerder één keer moet inrichten** (alles bij Meta, niet in deze repo):

1. Het eigen Instagram-account moet een zakelijk account of creator-account zijn, gekoppeld
   aan een Facebook-pagina.
2. Op `developers.facebook.com` een app van het type Business maken en het product
   *Instagram Graph API* toevoegen.
3. In de Graph API Explorer een token ophalen met `instagram_basic` en `pages_show_list`, en
   dat inwisselen voor een langlopend token (60 dagen).
4. Het id van het eigen Instagram-account opzoeken: het veld `instagram_business_account`
   bij de gekoppelde pagina.
5. Allebei neerzetten met rechten 600:
   `~/.config/kunstkiezer/instagram-token` en `~/.config/kunstkiezer/instagram-account`.

Zonder token doet het script niets en legt het dit uit; de ronde gaat dan verder zonder
Instagram en meldt dat als niet gecontroleerde bron. Het token verloopt na zestig dagen:
vernieuw het op tijd, anders slaat deze stap zichzelf stilletjes over.

**Twee beperkingen die blijven.** `business_discovery` geeft alleen zakelijke accounts en
creator-accounts; een persoonlijk account geeft foutcode 110. Dat is geen storing en geen
reden om die bron uit te zetten — voor die accounts is route 2 de enige weg. En stories zijn
via deze weg niet beschikbaar, alleen berichten en reels.

## 2. De browser, voor accounts die route 1 niet geeft

Vaste werkwijze vanaf 4 oktober 2026. Gebruik uitsluitend de actuele ingeschakelde accounts
uit `kk_update_sources`.

Open het account in de gewone browser, met JavaScript en de beschikbare browsersessie.
Behandel de cookiekeuze (bij voorkeur optionele cookies afwijzen), wacht op de geladen
pagina en open de afzonderlijke posts of reels om bijschrift, publicatiedatum en permalink
te lezen. Controleer vastgezette posts op hun datum; rastervolgorde bewijst geen
chronologie. Gebruik de tekst-ophaaltool of zoekfragmenten alleen aanvullend, niet als
toegangstest. Bij een zichtbare loginmuur: gebruik een beschikbare geautoriseerde
browsersessie; moet de gebruiker inloggen, vraag dan om die concrete handeling en laat de
bron openstaan. Geen wachtwoord, cookies of sessietokens opslaan of exporteren. Bij CAPTCHA
of browserbeveiliging de toepasselijke toestemming volgen, niets omzeilen. Registreer
precies welke posts en datums werkelijk gelezen zijn. Alleen na een echte browserpoging een
concrete toegangsbeperking melden; een toolfout is een technische fout, geen bewijs van
ontoegankelijke inhoud. Is browserbediening niet beschikbaar, meld dat dan als
uitvoeringsblokkade. Geen volledige controle claimen wanneer niet het hele
onderzoeksvenster kon worden gelezen.

Sluit wegklikbare registratie- of aanmeldpromoties voordat je concludeert dat inloggen
vereist is. Klik niet op Volgen, Vind ik leuk of Delen: dit is alleen bronnenonderzoek. Als
een berichtklik geen effect heeft, inspecteer de actuele pagina en open zo nodig de
daadwerkelijk zichtbare permalink rechtstreeks in dezelfde browser. Geen verzonnen URL's of
verborgen endpoints gebruiken. Het uitklappen van een bijschrift moet aantoonbaar werken
voordat het als volledig gelezen geldt.

Browserproef 4 oktober 2026: `https://www.instagram.com/kunstmeisjes/` geopend in de in-app
browser. Optionele cookies afgewezen en de wegklikbare aanmeldpromotie gesloten. Het
openbare profiel toonde twaalf berichtlinks met datums van 14 september tot 4 oktober.
`https://www.instagram.com/kunstmeisjes/p/DeEOjbyjiTL/` rechtstreeks geopend; afbeelding en
begin van het bijschrift over de KM Nieuwsbrief zichtbaar. De knop *meer* gaf bij deze
poging geen zichtbare verandering. Dit bevestigt dat de browserroute meer oplevert dan de
eerdere ophaalfout; het is geen volledige account- of periodecontrole. Andere accounts niet
op grond hiervan als gelezen afvinken.

De weekfrequentie, het onderzoeksvenster en de bestaande toegangsregels blijven intact.

## Wat Instagram tot nu toe opleverde

In de rondes van 15 tot en met 17 oktober 2026 kwam er geen enkel record rechtstreeks uit
Instagram: wel tips, maar alles wat een Nederlandse tentoonstelling noemde was al bekend of
moest alsnog op de eigen website worden bevestigd. Dat is geen reden om het kanaal te laten
vallen — makers en kleine ruimtes kondigen daar wél als eerste aan — maar het is wel de
reden om er de goedkoopste route voor te gebruiken en de dekking niet te overdrijven.
