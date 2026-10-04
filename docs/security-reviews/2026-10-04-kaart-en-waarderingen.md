# Kaart, waarderingen en tagbeheer — 4 oktober 2026

Aanvullende controle bij bronrevisie 081d2972ac56cc556aaab1be676e294cf8dcb3ca en migratie 20261004084559. Geen persoonlijke profielen, bezoekgeschiedenis, sessies of credentials verzameld. Geen accountmutaties. De inhoudelijke wachtrij is niet geclaimd.

## Uitgevoerde controles

- Typecontrole en 50 unit/database-tests geslaagd. Alle 50 desktop- en mobiele browsertests geslaagd; twee aanvullende controles bevestigen geladen kaarttegels. Deze tests omvatten toegangsweigering, accountisolatie, kaartbediening, tags en voorkeurinstellingen.
- `npm audit`: nul kwetsbaarheden. Leaflet is lokaal gebundeld; geen externe scripts nodig. Kaarttegels komen van OpenStreetMap; de locatie van de bezoeker wordt niet als kaartpunt verzonden. Navigatielinks bevatten de bestemming en vervoerswijze, geen opgeslagen profielgegevens.
- Anonieme REST-controle om 09:09 UTC: persoonlijke `kk_seen` geweigerd (401/42501); nieuwe openbare museumvermelding beschikbaar (200, één record); verdwenen onderwerpen onzichtbaar (200, nul records).
- De openbare waarderingsfunctie retourneert uitsluitend totalen en sterverdeling vanaf drie accounts per onderwerp. Geen gebruikersidentiteiten of afzonderlijke beoordelingen. Op productie waren nog geen zulke totalen beschikbaar (200, nul records).
- Voorkeurvragen zijn publiek leesbaar; alleen beheerders kunnen ze wijzigen. Nieuwe beheerfuncties zijn getest op geweigerde toegang voor gewone gebruikers. De waarderingsweging wordt met versiecontrole opgeslagen.
- Publieke Auth-instellingen: e-mailbevestiging vereist, anonieme accounts uit. Mailbezorging niet getest; mailprovider blijft op verzoek van de beheerder uitgesteld.
- Supabase security advisors: uitsluitend de eerder bekende drie informatieve private-RLS-meldingen en de bekende waarschuwing over gelekte-wachtwoordbescherming. Geen nieuwe bevinding. [Supabase-toelichting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Publicatie en beperking

Loci-run 37190244568 doorloopt de bestaande gecontroleerde productieketen. Op het moment van dit verslag was de run nog bezig; dit verslag claimt daarom nog geen geslaagde productiepublicatie van de frontend. Databasewijzigingen zijn afzonderlijk toegepast en via de anonieme API gecontroleerd.

De bestaande afhankelijkheidscorrectie uit het eerdere verslag is gepubliceerd: Loci-run 37183321495 slaagde. De automatische beveiligingscontrole en inhoudelijke wachtrijcontrole zijn op verzoek verplaatst naar afzonderlijke lokale achtergrondtaken; beide blijven actief, met meldingen uitsluitend bij mislukte uitvoeringen. De computer en Codex moeten beschikbaar blijven.
