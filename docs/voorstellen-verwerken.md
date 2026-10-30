> **Automatische opvolging vanaf 30 oktober 2026:** op verzoek van de beheerder verwerkt de lokale runner voortaan ondersteunde feitelijke correcties automatisch volgens `primary-facts-v1`. Zie [automatische-publicatie.md](automatische-publicatie.md). De onderstaande handmatige route blijft beschikbaar voor vrije tekst, kandidaten en uitzonderingen. Alle conflict-, audit-, CI- en productiecontroles blijven verplicht.

# Voorstellen gecontroleerd verwerken

Deze route verwerkt bestaande recordwijzigingen uit de voorstelbeoordelaar. De AI
kan deze route niet aanroepen: zij heeft geen shell, databasegereedschappen of
schrijfrechten. Verwerking gebeurt door gewone code, na goedkeuring van de exacte
voorgestelde inhoud. Er is geen extra AI- of API-aanroep voor deze stappen.

## 1. Beoordelen

```
npm run updater:proposal -- review /absoluut/pad/voorstel.json
```

Dit maakt een `.review.md` naast het oorspronkelijke JSON-bestand. Het toont per
veld de oorspronkelijke en voorgestelde waarde, recordversie, bron en citaat. De
vingerafdruk bindt het voorstel én het verzamelde bronpakket. Nieuwe kandidaten
worden apart vermeld; hun minimale naam/URL/citaat is onvoldoende voor een compleet
nieuw catalogusrecord. Deze route voegt ze daarom niet automatisch toe.

## 2. Goedkeuren

Na inhoudelijke beoordeling:

```
npm run updater:proposal -- approve /absoluut/pad/voorstel.json --digest VINGERAFDRUK_UIT_REVIEW
```

Dit schrijft een apart goedkeuringsbestand met de reviewer en het tijdstip. Het
voorstel blijft onveranderd. Goedkeuring geldt voor alle veldwijzigingen in dat
exacte voorstel. Wil je een wijziging afwijzen, maak dan eerst een aangepaste kopie
van het voorstel, beoordeel die opnieuw en gebruik de nieuwe vingerafdruk. Een
oude goedkeuring werkt niet na wijziging van voorstel of bronpakket.

## 3. Toepassen

```
npm run updater:proposal -- apply /absoluut/pad/voorstel.json
```

De schrijver controleert vóór toepassing opnieuw de bereikbare bron en het
letterlijke bewijs. In één databasetransactie worden vervolgens:

- de bestaande wachtrijvergrendeling genomen en andere actieve runs geweigerd;
- de ingeschakelde bron en oorspronkelijke wijzigingsversie vastgezet;
- alle betrokken records vergrendeld en `updated_at` plus oude waarden gecontroleerd;
- uitsluitend goedgekeurde velden bijgewerkt;
- alle wijzigingen met bron, veld, goedkeurder en voorstelvingerafdruk geaudit.

Meerdere velden van hetzelfde record worden in één UPDATE geschreven. Bij een
conflict in een later record draait de hele partij terug, inclusief eerdere
recordwijzigingen en auditregels. Databasevalidaties, triggers en bestaande
publicatievoorwaarden blijven van kracht. De code kent geen zelfbedachte SQL of
tabelnamen uit modeluitvoer toe: tabellen en velden zijn expliciet begrensd.

Na commit worden alle gewijzigde velden én auditregels teruggelezen. De lokale
`.receipt.json` vermeldt `database_verified`, nooit al `published=true`. De
wachtrijrun blijft tot publicatie onbevestigd (`failed` met expliciete notitie
`database_applied; publication_pending`). Dit voorkomt ook dat een verlopen lease
het bewijs van een al toegepaste wijziging vervangt.

Het run-id is deterministisch gekoppeld aan het voorstel. Na een verloren
netwerkantwoord of kapotte lokale receipt leest een herhaling de database terug;
ze schrijft de wijzigingen niet opnieuw. Heeft een redacteur de toegepaste waarde
later veranderd, dan wordt dat een verificatieconflict, geen automatische rollback
of overschrijving. Een lege wijzigingenlijst blijft een no-op zonder databaserun.

## 4. Publicatie voorbereiden

Databasewijzigingen zijn direct aanwezig in Supabase. Voor openbaar gepubliceerde
records moeten daarnaast de statische downloads en de gecontroleerde productie
bijgewerkt worden:

```
npm run updater:proposal -- stage /pad/voorstel.json --release-dir /pad/release
npm run updater:proposal -- install-release /pad/voorstel.json --release-dir /pad/release --checkout /pad/schone-kunstkiezer-checkout
```

`stage` maakt één consistente database-momentopname van de vijf openbare
catalogusdownloads: `art-inventory.json` en de vier categoriebestanden. Concepten en
gearchiveerde records worden niet geëxporteerd. Iedere file krijgt een SHA-256-hash.
De gewijzigde waarden moeten ook in de momentopname staan.

`install-release` accepteert uitsluitend een schone checkout van
`harmenploeg/kunstkiezer` en controleert het complete pakket voordat hij de vijf
bestanden kopieert. Hij commit, pusht of publiceert niet. Bouw en test deze checkout,
beoordeel de exportwijzigingen, commit de bronrevisie en integreer die met de
bestaande gecontroleerde keten van `harmenploeg/interactief`. Volg hiervoor
`docs/publicatie.md`. Bewaar de broncommit, integratiecommit en workflow-run-id.

## 5. Echte productie verifiëren

```
npm run updater:proposal -- verify /pad/voorstel.json --release-dir /pad/release --workflow-run RUN_ID --source-commit BRONCOMMIT --integration-commit INTEGRATIECOMMIT
```

De controle vertrouwt niet op een zelf opgegeven succesvlag. Zij leest met `gh`:

- de geslaagde workflow `Controleer LOCI-publicatiepakket` voor precies de integratiecommit;
- de geslaagde check `Loci gecontroleerde productie` voor diezelfde commit;
- de bronrevisie en alle vijf downloadbestanden uit die gecontroleerde Git-revisie.

Daarna vergelijkt zij de daadwerkelijke productieconfiguratie, publieke Supabase-API,
`version.json` en alle vijf downloads met de goedgekeurde wijzigingen en het
gecontroleerde pakket. De broncode moet van `harmenploeg/kunstkiezer` zijn. Voor
conceptrecords moet de publieke API juist géén rij teruggeven; daarvoor is geen
statische publicatie nodig. De actuele productie is
**https://kunstkiezer.loci-amsterdam.nl/**; het oude Loci-pad verwijst daarnaartoe.

Pas nadat alle controles slagen wordt de run `completed` en de receipt `verified`.
Bij openbare wijzigingen wordt dan `published=true`. Een mislukking blijft als
`verification_blocked` bewaard, inclusief de concrete blokkade. Herhaal na herstel
alleen `verify`; pas het voorstel niet nogmaals toe. Een latere verificatie mag een
oude successtatus niet stilzwijgend laten staan als productie inmiddels afwijkt.

## Bewust buiten deze stap

De weekautomatisering staat aan. Ondersteunde feitelijke correcties hebben voorafgaande beheerderautorisatie volgens `primary-facts-v1`; overige wijzigingen vereisen nog redactionele beoordeling. Nieuwe kandidaten vereisen complete gegevens en
selectiecontrole vóór toevoeging. Er wordt niet beweerd dat een beperkte
bronsteekproef volledige weekdekking oplevert.

Voor een gerichte correctie: geef bij `stage` de optie `--baseline-checkout /pad/naar/actuele/schone/broncheckout` mee. Dat behoudt de bestaande exportredactie en wijzigt uitsluitend goedgekeurde velden; records die in de actuele database niet meer publiek staan vallen uit de downloads. Zonder deze optie wordt een volledige actuele publieke database-export gemaakt, die afzonderlijk redactioneel moet worden gecontroleerd.
