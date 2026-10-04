# Accounts, architectuur en beveiliging

Beoordeling en uitbreiding: 4 oktober 2026. Broncode: https://github.com/harmenploeg/kunstkiezer. Publicatie-integratie: https://github.com/harmenploeg/interactief. Productie: https://www.loci-amsterdam.nl/kunstkiezer/.

## Architectuur

De grenzen tussen `packages/domain` (regels), `packages/data` (catalogus/database), `packages/ui` (gedeelde vormgeving) en `apps/web/src/features` blijven behouden. Accountcontrole staat nu centraal in `AuthContext` en `RequireAdmin`, in plaats van drie afzonderlijke inlogimplementaties. De app heeft afzonderlijke paginakeuze, account-, profiel-, bezoeken- en beheeronderdelen. Beheer- en accountpagina's worden op aanvraag geladen. Nieuwe account- en beheercode is geformatteerd en gebruikt dezelfde typografie, kleuren, formulieren en kaarten als de site.

De gedeelde `CatalogActions` verzorgt Gezien, de sterrendialoog en delen voor alle vijf catalogi, de detailpagina en de bezoekgeschiedenis. `ProfileProvider` synchroniseert online voorkeuren; `VisitsProvider` beheert bezoeken. Bij wisselen van account wordt de hele persoonlijke werkruimte opnieuw opgebouwd. Tags uit een eerder account kunnen daardoor niet in het formulier van een volgend account blijven staan. Een gastprofiel kan alleen expliciet naar een nieuw leeg account worden overgenomen. Coördinaten blijven buiten de accountdatabase; toestemming en afstandskeuze gelden per apparaat.

Uitbreiden blijft mogelijk, maar is niet volledig zonder code: nieuwe categorieën vereisen domeinconfiguratie, routes, databasevalidatie en selectiecriteria. De bronnenpool en de onderzoeksprocedure zijn categorie-overstijgend. Bestaande cataloguskaarten en formulieren bevatten nog duplicatie; splits verdere gedeelde velden af wanneer een volgende uitbreiding daar baat bij heeft. Maak geen vijf verschillende account- of deelimplementaties.

## Accountstromen

`/account`: e-mail/wachtwoordregistratie, e-mailbevestiging, inloggen, vergeten wachtwoord, wachtwoord wijzigen, gegevens downloaden en wereldwijd uitloggen. `/account-verwijderen`: herbevestiging met huidig wachtwoord en definitieve verwijdering via de server. `/profiel`: smaakvoorkeuren, met optimistische vergrendeling tegen gelijktijdig overschrijven. `/geschiedenis`: eigen bezoeken en eigen 1–5 sterren. Waarderen is optioneel; geen openbare beoordelingen of openbare profielen.

Een herstelvlag in de URL geeft geen bijzondere rechten. Alleen het echte Supabase PASSWORD_RECOVERY-event opent de herstelmodus. Bij normale wachtwoordwijziging is herauthenticatie met het huidige wachtwoord vereist. Accountverwijdering controleert een geldig access token én het actuele wachtwoord op de server. De laatste beheerder moet het beheer eerst overdragen. De Edge Function gebruikt de ingebouwde service key alleen op de server en logt geen wachtwoorden.

## Databeveiliging

- RLS op alle nieuwe tabellen. `kk_profiles` en `kk_seen` zijn uitsluitend bereikbaar voor `auth.uid() = user_id`, ook beheerders krijgen geen persoonlijke inzage.
- Beheerders komen uit `kunstkiezer_private.editors`; nooit uit bewerkbare gebruikersmetadata. Publieke RPC's zijn invoker-functies. Alleen de noodzakelijke rolmutaties en rolcontrole gebruiken afgeschermde, begrensde definer-functies met een lege `search_path` en expliciete rechtenchecks.
- Alleen beheerders lezen of wijzigen bronnen, schema en rollen. Alleen de vertrouwde updater claimt en voltooit taken. De browser kan geen taak als geslaagd markeren.
- De laatste beheerder is beschermd met een transactioneel slot. Accountverwijdering ruimt persoonlijke gegevens op via foreign-key cascades; catalogi worden niet verwijderd.
- Browserconfiguratie bevat alleen de publishable key. Private keys staan niet in browserassets. React ontsnapt tekst; links worden gecontroleerd, externe vensters gebruiken `noopener noreferrer`. CSP blokkeert scripts van andere bronnen, objecten en inbedding. Accountlinks gebruiken vaste eigen routes, zonder vrije return-URL.
- Supabase Auth verzorgt gehashte wachtwoorden, sessies en rate limiting. Publieke registratie is geactiveerd met verplichte e-mailbevestiging. Site URL en twee expliciete terugkeeradressen wijzen naar de Loci-accountpagina. Minimumlengte is 12 tekens; veilige wachtwoordwijziging is ingeschakeld.

## Bevindingen en beperkingen

De npm-audit meldde nul bekende kwetsbaarheden. Database- en browsertests dekken gast/nonadmin/admin, toegang tussen accounts, cloudprofielconflicten, twee apparaten, herstel, sterren en delen. De live delete-accountfunctie weigert ongeauthenticeerde aanvragen met HTTP 401. Dit is geen formele penetratietest en geen garantie dat er nooit een fout kan optreden.

Na het verplaatsen van de rolcontrole verdwijnen de twee SECURITY DEFINER-waarschuwingen uit de publieke API. De drie RLS-zonder-policy-meldingen zijn bewust: interne rollen en wijzigingslogboeken hebben geen rechtstreekse gebruikerspolicies. Supabase meldt nog dat gelekte-wachtwoordbescherming uitstaat. Deze functie vereist Pro of hoger; er is geen betaald abonnement aangegaan. Bron: https://supabase.com/docs/guides/auth/password-security.

**Externe ingebruiknamevoorwaarde:** custom SMTP is nog niet geconfigureerd. De standaarddienst bezorgt alleen aan projectteamleden en is niet geschikt voor publieke registratie of herstelmail. Een mailprovider met geverifieerde afzender is nodig. Houd e-mailbevestiging aan; het uitschakelen daarvan lost de bezorging niet veilig op. Bron: https://supabase.com/docs/guides/auth/auth-smtp. Pas deze paragraaf aan na daadwerkelijke configuratie en bezorgtest.

Aanbevolen volgende beveiligingsstap: MFA voor beheerders en gecontroleerde back-ups/hersteltests. De huidige applicatie vereist geen tweede factor. Het Free-plan biedt geen downloadbare dagelijkse databaseback-ups; de persoonlijke databasegegevens staan niet in Git. Online opslag beschermt tegen verlies van browseropslag, maar is geen onbeperkte beschikbaarheids- of bewaargarantie. Gebruikers kunnen hun gegevens downloaden. Bron: https://supabase.com/docs/guides/deployment/going-into-prod.

## Terugkerende controle

De beveiligingscontrole wordt dagelijks uitgevoerd via een lokale Codex-heartbeat. Controleer wijzigingen en afhankelijkheden, Supabase security advisors, anonieme toegang, rechtenregels, Auth-instellingen en productiecontroles. Meld nieuwe of verslechterde bevindingen en blokkades; herhaal ongewijzigde bevindingen niet dagelijks. De computer, Codex en benodigde verbindingen moeten beschikbaar zijn. Dit is periodieke controle, geen continu intrusion-detectionsysteem. Bewaar alleen technische bevindingen zonder credentials of bezoekersgegevens.
