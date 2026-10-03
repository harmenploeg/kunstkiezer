# Smaakprofiel en publicatie

## Bezoekersprofiel

De startpagina `/kunstkiezer/` is een onboarding met drie vragen. Antwoorden verwijzen rechtstreeks naar bestaande inhoudelijke tags. `packages/domain/src/profile.ts` bevat de vragen, normalisatie, profielvalidatie en scoreberekening. `catalogue-tags.ts` bevat de extra zoekbare tags uit de onderzoeksbestanden.

Een profiel wordt uitsluitend in de browser opgeslagen onder `kunstkiezer.profile.v1`, zonder account of serverprofiel. Lege voorkeuren zijn een bewuste geldige keuze. Na succesvol opslaan verdwijnt Mijn kunstkeuze uit de navigatie en stuurt de startpagina door naar Ontdek kunst. `/kunstkiezer/profiel` blijft bereikbaar om tags toe te voegen of te verwijderen. Bij geblokkeerde opslag wordt geen voltooiing geclaimd. Op een ander apparaat of na het wissen van browsergegevens is opnieuw invullen nodig.

## Volgorde

Alle vijf catalogi tellen unieke overeenkomende tags, zonder hoofdletterverschil. Meer overeenkomsten geeft een hogere plaats. Bij gelijke score blijft de bestaande alfabetische of chronologische volgorde behouden. De catalogus wordt in batches volledig opgehaald binnen de actieve filters, daarna gesorteerd en pas daarna gepagineerd. Er worden geen resultaten weggefilterd vanwege smaak; zonder voorkeuren blijft de standaardvolgorde staan. De bezoeker kan ook zelf terugschakelen naar de standaardvolgorde.

## Publicatie van bestaande concepten

De migratie `publish_curated_catalogs` publiceert eenmalig alle bestaande concepten binnen de kunstmuseumselectie en de vier andere verzamelingen. Niet-kunstmusea, archieven en overige redactiewerkzaamheden worden niet aangepast. Publicatie staat voortaan los van bezoekstatus of de volledigheid van het adres; gesloten, tijdelijke en onzekere locaties krijgen een zichtbare melding. Het agendavenster (lopend of start binnen één kalendermaand) blijft gelden.

Interne notities blijven afgeschermd en bewerken blijft voorbehouden aan redacteuren. De onderzoeksbestanden en hun oude rapporten blijven historische momentopnamen; de live publicatiestatus staat in Supabase. Nieuw aangemaakte vermeldingen beginnen nog steeds als concept.
