# Gebruikersbeheer

Beheer → Instellingen → Gebruikers laat een beheerder accounts uitnodigen, verwijderen en beheerdersrechten geven of intrekken.

- Vul bij **Gebruiker toevoegen** het e-mailadres in. Supabase Auth verstuurt een uitnodiging naar het vaste productieadres `/kunstkiezer/account`. De ontvanger bevestigt zo het adres en kiest zelf een wachtwoord. Hiervoor moet de e-mailvoorziening van het Supabase-project uitnodigingen naar de bedoelde ontvangers toestaan.
- Een nieuw account heeft alleen gebruikersrechten. **Maak beheerder** geeft toegang tot redactie, instellingen en gebruikersbeheer; **Beheer intrekken** neemt deze toegang onmiddellijk weg via de bestaande server-side rollenlijst.
- **Gebruiker verwijderen** vraagt bevestiging en verwijdert het account met de gekoppelde voorkeuren, bezoeken en waarderingen. Eerst worden eventuele beheerdersrechten ingetrokken. Mislukt de daaropvolgende Auth-verwijdering, dan zegt de foutmelding expliciet dat die rechten al zijn ingetrokken en kan verwijderen opnieuw worden geprobeerd.
- De laatste beheerder is in de database beschermd. Je eigen account verwijder je via Mijn account, na eventuele overdracht van het beheer.

## Publicatie en verificatie

Publiceer `supabase/functions/manage-users` in project `qrlfywcqkkzmerglmsbj`, naast de bestaande `delete-account`-functie. De functie controleert zelf het bearer-token met `auth.getUser` en daarna de actuele databasebeheerdersrol met het token van de aanvrager. Daarom staat gateway `verify_jwt` uit; iedere echte mutatie vereist de eigen authenticatie en autorisatie. De service-role-sleutel blijft uitsluitend in de Edge Function. Rechtentoekenning blijft via `kk_set_admin` lopen. Er zijn geen nieuwe databasegrants of schemamigraties nodig.

Volg daarna `docs/publicatie.md` voor de frontend. Tests: `npm run check` en `npx playwright test e2e/management.spec.ts e2e/accounts.spec.ts --project=desktop --project=iphone`. De browsertests gebruiken gesimuleerde Auth-antwoorden; zij versturen geen echte uitnodigingen. Controleer het productiedomein en de bereikbaarheid/toegangsweigering van de Edge Function na publicatie.
