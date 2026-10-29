# Begrensde Kunstkiezer-updater — voorstelroute

De liveproef van 29 oktober 2026 toonde aan dat een zelfstandige onderzoeksagent
te veel context gebruikte en op databasegoedkeuring vastliep. De actieve coderoute
is daarom vervangen door een beoordelaar die alleen voorstellen teruggeeft.

## Verdeling van het werk

`scripts/weekly-updater.mjs` beheert de wachtrij, het lokale slot, voortgang, het
gezamenlijke dagbudget en de afronding. De standaardbeoordelaar is nu
`createProposalReviewer` uit `scripts/proposal-reviewer.mjs`; de oude `runModel`
wordt niet meer als standaard gestart.

Gewone Node-code leest de actuele ingeschakelde bron en maximaal zes relevante
catalogusrecords via de bestaande Supabase-managementverbinding. Hij haalt maximaal
drie pagina's op de host van de bron op, met een begrensde omvang en wachttijd.
Doorverwijzingen worden niet automatisch gevolgd. Instagram en bronnen zonder
bruikbare HTML krijgen een expliciete beperking, geen verzonnen controle-uitkomst.

Daarna start één nieuwe Codex-sessie per geselecteerde bron, via de bestaande
ChatGPT-aanmelding. Er wordt geen apart betaalde OpenAI API gebruikt; API-sleutels
worden niet aan het kindproces meegegeven. De sessie start in een tijdelijke lege
werkmap met alleen-lezenrechten. Gebruikersconfiguratie, projectdocumenten,
plug-ins, MCP, shell, browser, extra agents en webzoekfuncties worden uitgeschakeld.
Een waargenomen toolpoging beëindigt het proces. De AI ontvangt uitsluitend het
voorbereide pakket en geeft JSON terug. Zij kan geen database of catalogus wijzigen.

## Werkelijke grenzen

- Maximaal 12.000 UTF-8-bytes voor instructie plus aangeleverd pakket.
- Maximaal drie pagina's, ieder maximaal 128 KiB opgehaald; fragmenten worden
  verkleind als het pakket anders niet past. Afgebroken tekst en weggelaten records
  worden in het pakket vermeld.
- Maximaal 45 seconden per beoordeling, bewaakt door de runner en een zelfstandige
  procesbewaker die ook een verweesd kindproces beëindigt.
- JSON-uitkomst met maximaal drie wijzigingsvoorstellen, twee kandidaten en
  5.000 bytes voor de geaccepteerde uitkomst. Een te grote of ongeldige uitkomst
  wordt geweigerd, niet automatisch opnieuw gegenereerd.

Dit zijn geen harde token- of creditlimieten. De Codex-CLI meldt het tokengebruik
pas achteraf en voegt eigen systeemcontext toe. De invoergrens betreft ons pakket,
niet alle interne Codex-instructies. De JSON-limiet begrenst geaccepteerde inhoud,
niet de verborgen redeneertokens. De gebruiker heeft apart API-gebruik afgewezen;
daarom wordt geen API met `max_output_tokens` gebruikt. Aanvullend blijven de
bestaande daglimiet, reservering vóór aanroep en begrensde herhaalpogingen gelden.
Geef tokenmetingen eerlijk weer; gecachete tokens zijn geen volledig nieuwe invoer.

## Voorstellen en bewijs

Een voorstel verwijst naar een meegeleverd record, de oorspronkelijke veldwaarde,
`updated_at`, een werkelijk opgehaalde URL en een letterlijk citaat in het pakket.
De runner weigert onbekende records, onbekende velden, dubbele veldwijzigingen,
verzonnen citaten, ongeldige statussen en te lange beschrijvingen. De AI bepaalt
geen SQL en mag geen gereedschappen oproepen.

Het voorstel krijgt `needs_review`, `catalog_changed=false`, `published=false` en
`coverage=partial`. Ook een geldig voorstel zonder wijzigingen wordt opgeslagen.
Een partij die voorstellen oplevert is `completed` in de wachtrij; dat betekent
uitsluitend dat de voorstelpartij is afgerond, niet dat alle broninhoud is gelezen.
De vorige geslaagde volledige controledatum wordt niet opgeschoven. Per bron wordt
het voorstel bewaard en binnen dezelfde ronde niet opnieuw aangevraagd. Herstel
leest geldige voorstelbestanden terug zodat een crash geen afgemaakt voorstel wist.

Publicatie en het toepassen van voorstellen staan los van deze proef. Eerst moet
redactie bewijs en actualiteit beoordelen. Daarna moeten eventuele wijzigingen via
de gecontroleerde schrijf- en publicatieketen worden verwerkt, met een actuele
conflictcontrole. Deze code publiceert niet automatisch en is dus nog geen volledig
autonome actualisatiedienst.

## Planning en oude dossiers

Het weekschema blijft in `kk_update_schedule`. De oudere dossierachterstand blijft
apart via `backlog-tick`; een gewone bronnenronde laadt die lijst niet. Beide routes
gebruiken hetzelfde dagbudget en slot. De beperkte beoordelaar is ingericht op
HTML-bronnen; bronnen/dossiers zonder geschikte verzamelde informatie blijven open.

De oude Codex-automatisering is gepauzeerd en `.local-updater/activation.json` staat
op `enabled=false`. De nieuwe vijfminutenservice is niet geladen. Laat deze uit
zolang de voorstellen nog niet zijn beoordeeld en de volledige dekking/publicatie
niet geregeld is. Alle 276 bronnen passen niet binnen de voorzichtige weeklimieten.

## Toegang en bestanden

De gewone runner leest het managementtoken uit `SUPABASE_ACCESS_TOKEN` of uit één
macOS-sleutelhangeronderdeel: service `nl.loci.kunstkiezer.supabase-management`,
account `kunstkiezer-updater`. Het token komt niet in de AI-prompt, kindomgeving,
Git of plist. De standaard projectref is `qrlfywcqkkzmerglmsbj`.

`.local-updater/` bevat het gedeelde budget, partijrapporten, invoerpakketten,
voorstellen en broncheckpoints. Deze map is privé en uitgesloten van Git. Wis het
budget of de voortgang niet om een blokkade te omzeilen. De eerdere mislukte proef
blijft bewaard; de nieuwe voorstelproef heeft een eigen voortgangsbestand.

Commando's:

- `npm run updater:preflight`: uitsluitend gereedheid en schema lezen, geen AI.
- `npm run updater:trial`: één bron (11fountains), geen vervolgtaak of publicatie.
  Een reeds afgeronde voorstelproef wordt niet stilzwijgend opnieuw gestart.
- `npm run updater:service`: stopt zolang de activering uit staat, en weigert overlap
  met de oude automatisering.
- `npm run test:updater`: lokale tests zonder echte AI of productie-ingrepen.

De plist onder `.local-updater/install/` is voorbereid en gevalideerd, niet geladen.
Een zelfstandige Codex-Supabase-MCP-verbinding is voor deze voorstelroute niet nodig;
alle databaselezingen gebeuren door gewone code met het managementtoken.

## Gecontroleerde vervolgverwerking

De schrijver, goedkeuring, audit, hervatting en productiecontrole zijn nu uitgewerkt
in [voorstellen-verwerken.md](voorstellen-verwerken.md). De beoordelaar blijft
alleen voorstellen maken; verwerken vereist het expliciet goedgekeurde voorstel.

## Actieve weeksteekproef (29 oktober 2026)

De weekronde behandelt maximaal acht actieve HTTPS-webbronnen, in partijen van vier.
Instagram en RSS/Mailchimp worden niet automatisch door deze tekstbeoordelaar gelezen.
De selectie roteert op de oudste voorstelcontrole; niet geselecteerde bronnen staan
expliciet als uitgesteld in het rapport. Dit is geen volledige wekelijkse brondekking.
Voorstellen wijzigen de catalogus niet. Lokale macOS-meldingen wijzen op gereedgekomen
voorstellen of verbindingsproblemen; `.local-updater/laatste-voorstellen.md` bevat de
bestanden voor beoordeling. De computer moet aan staan en de gebruiker aangemeld zijn.
Een verlopen Supabase-token moet via de Sleutelhanger worden vernieuwd; de runner stopt
dan vóór een AI-start. Er worden geen afzonderlijk betaalde OpenAI-API-aanroepen gebruikt.
De invoer en looptijd zijn begrensd; een harde totale Codex-tokenlimiet is niet beschikbaar.
