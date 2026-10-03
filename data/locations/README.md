# Bestemmingslocaties — 3 oktober 2026

`coordinates.json` bevat 538 aanvullingen voor bestaande openbare vermeldingen. 143 musea hadden al coördinaten en blijven ongewijzigd. Bron: PDOK Locatieserver (BAG/BRT) en, bij hetzelfde museumadres, de bestaande museumlocatie. Per aanvulling staan bron, gevonden adres en nauwkeurigheid vermeld.

Adressen zijn gematcht op plaats, straat en huisnummer; bij ontbrekende adresmatches is een straat- of plaatscentrum gebruikt. De publieksweergave noemt deze schatting expliciet. Dit is geen routeberekening en geen garantie voor de exacte ingang. Nauwkeurigheid en coördinaten zijn in de redactietool te wijzigen.

20 vermeldingen hebben nog geen betrouwbaar punt (onder meer landelijke kunstprojecten, routes en enkele buurtschappen). Daar toont de site ‘Afstand onbekend’; zij krijgen geen afstandsbonus. Geen coördinaat verzinnen voor een werk dat op meerdere plaatsen voorkomt.

Genereer de herhaalbare SQL met `node scripts/generate-location-imports.mjs`. De import vult uitsluitend lege coördinaatparen aan en controleert of plaats en adres nog overeenkomen; bestaande coördinaten en redactioneel gewijzigde adressen worden niet overschreven. De SQL wijzigt geen publicatie- of bezoekstatus.

PDOK: https://www.pdok.nl/pdok-locatieserver
API: https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/
