# Smaakprofiel en publicatie

## Bezoekersprofiel

De startpagina `/kunstkiezer/` is een onboarding met drie vragen. Antwoorden verwijzen rechtstreeks naar bestaande inhoudelijke tags. `packages/domain/src/profile.ts` bevat de vragen, normalisatie, profielvalidatie en scoreberekening. `catalogue-tags.ts` bevat de extra zoekbare tags uit de onderzoeksbestanden.

Zonder account wordt het profiel in de browser opgeslagen onder `kunstkiezer.profile.v1`. Met een account bewaart `ProfileProvider` het profiel privé in `kk_profiles`, met conflictcontrole en herladen bij focus. De voorkeuren zijn dan op meerdere apparaten beschikbaar. Een bestaand gastprofiel kan expliciet worden overgenomen wanneer het account nog geen ingevuld profiel heeft. Lege voorkeuren zijn een bewuste geldige keuze. Na succesvol opslaan verdwijnt Mijn kunstkeuze uit de navigatie en stuurt de startpagina door naar Ontdek kunst. `/kunstkiezer/profiel` blijft bereikbaar om tags toe te voegen of te verwijderen. Bij geblokkeerde opslag wordt geen voltooiing geclaimd. Alleen een gast zonder account moet op een ander apparaat of na het wissen van browsergegevens opnieuw invullen. Zie [accounts en beveiliging](accounts-en-beveiliging.md).

## Volgorde

Alle vijf catalogi tellen unieke overeenkomende tags, zonder hoofdletterverschil. Meer overeenkomsten geeft een hogere plaats. Bij gelijke score blijft de bestaande alfabetische of chronologische volgorde behouden. De catalogus wordt in batches volledig opgehaald binnen de actieve filters, daarna gesorteerd en pas daarna gepagineerd. Er worden geen resultaten weggefilterd vanwege smaak; zonder voorkeuren blijft de standaardvolgorde staan. De bezoeker kan ook zelf terugschakelen naar de standaardvolgorde.

## Publicatie van bestaande concepten

De migratie `publish_curated_catalogs` publiceert eenmalig alle bestaande concepten binnen de kunstmuseumselectie en de vier andere verzamelingen. Niet-kunstmusea, archieven en overige redactiewerkzaamheden worden niet aangepast. Publicatie staat voortaan los van bezoekstatus of de volledigheid van het adres; gesloten, tijdelijke en onzekere locaties krijgen een zichtbare melding. Het agendavenster (lopend of start binnen één kalendermaand) blijft gelden.

Interne notities blijven afgeschermd en bewerken blijft voorbehouden aan redacteuren. De onderzoeksbestanden en hun oude rapporten blijven historische momentopnamen; de live publicatiestatus staat in Supabase. Nieuw aangemaakte vermeldingen beginnen nog steeds als concept.

## Afstand en smaak

De bezoeker kan bij Ontdek kunst en Mijn profiel **Afstand laten meetellen** aanzetten. Pas die actie vraagt locatietoestemming. Uitzetten blijft mogelijk wanneer de browser toestemming heeft; zonder locatie of met deze keuze uit geldt uitsluitend de smaakvolgorde. Zonder tags maar met locatie geldt nabijheid. De normale catalogusvolgorde blijft apart beschikbaar.

Standaard: 70% afstand, 30% smaak, afstandsbereik 30 km. Score = `taggewicht × (passende unieke tags / gekozen unieke tags) + afstandsgewicht / (1 + hemelsbrede_km / bereik_km)`. Bij zes voorkeurstags scoort 10 km met één tag 57,5 punten en 250 km met zes tags 37,5. Ontbrekende bestemmingscoördinaten leveren geen afstandspunten op. De site haalt alle gefilterde resultaten op vóór sortering en paginering, met behoud van het evenementendatumvenster.

De redacteur wijzigt de globale balans onder **Redactie → Beheer → Afstand en smaak** (`/beheer/instellingen`; `/beheer/volgorde` blijft als alias werken). Gewichten moeten samen 100% zijn; het afstandsbereik mag 1–500 km zijn. Een live voorbeeld toont het effect vóór opslaan. Instellingen staan in `kk_ranking_settings`, zijn openbaar leesbaar en uitsluitend door redacteuren wijzigbaar. Opslaan controleert de laatst gelezen versie zodat gelijktijdige wijzigingen niet worden overschreven. Bezoekers laden instellingen bij starten, focus en iedere minuut.

Privacy: alleen de aan/uit-keuze staat duurzaam in lokale browseropslag. De eigen locatie staat hoogstens in sessionStorage (15 minuten bruikbaar) en wordt bij uitschakelen verwijderd. De locatie gaat niet naar Supabase of PDOK. Een nieuwe browsersessie vraagt nooit vanzelf om toestemming; eerder verleende toestemming kan een hernieuwde locatiebepaling mogelijk maken als de bezoeker afstand aan heeft laten staan. Bij weigeren, time-out of ingetrokken toestemming blijft de site bruikbaar op smaak. Een laat ontvangen locatie na uitschakelen wordt genegeerd.

Bestemmingscoördinaten en herkomst staan in `data/locations/`; aanvullen kan met de SQL in `supabase/location-imports/`. Straat- en plaatsbenaderingen worden zichtbaar als schatting aangeduid. Dit zijn hemelsbrede afstanden, geen reisafstanden.
