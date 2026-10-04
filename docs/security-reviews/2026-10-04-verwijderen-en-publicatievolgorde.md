# Onderwerpen verwijderen en publicatievolgorde — 4 oktober 2026

De redactietool had geen verwijderactie voor onderwerpen. Beide formulieren gebruiken nu één gedeelde bevestiging en dezelfde datafunctie. Verwijderen wijzigt uitsluitend `publication_status` naar `archived`; namen, bronnen, foto's en persoonlijke bezoekgeschiedenis blijven behouden. Het archief is apart te openen en herstellen zet de vermelding op concept. Nieuwe imports mogen deze redactiekeuze niet overschrijven.

De wijziging gebruikt bestaande UPDATE-rechten en RLS; er zijn geen nieuwe grants of productie-accountmutaties. Zowel id als updated_at moeten overeenkomen. Nul gewijzigde rijen is een fout, nooit een succesmelding. De actuele productiepolicies zijn gelezen: uitsluitend beheerders kunnen musea en overige onderwerpen bijwerken. Anonieme bezoekers zien alleen gepubliceerd en open aanbod.

Validatie: 51 unit/database-tests geslaagd. De bestaande 50 desktop/mobiele browsertests slaagden; vier nieuwe tests voor verwijderen, annuleren, conflicten, archief en herstel slaagden na een expliciet toegankelijk label bij de archiefkeuze. De databasetest controleert beide tabellen, gewone gebruikers, versieconflicten, publieke onzichtbaarheid en behoud van redactienotities. Geen echte onderwerpen verwijderd als productieproef.

De afzonderlijke Loci-productietest startte bij een push van de testcode, terwijl dezelfde revisie nog op publicatie wachtte. Daardoor ontstonden onterechte versieverschillen. De workflow start voortaan na een geslaagde hoofdpublicatieworkflow op main en gebruikt de bronrevisie van die publicatie. Pull requests starten deze controle met productietoegang niet. De bestaande controle binnen de publicatieketen blijft bestaan. Handmatige uitvoering blijft mogelijk.

De beveiligingsautomatie is op verzoek gewijzigd naar wekelijks, maandag 08.00 uur. De updater blijft een vijfminutencontrole van de wachtrij, zodat handmatige aanvragen tijdig starten; de inhoudelijke planning blijft in Beheer staan. Afgeronde uitvoeringen zijn gearchiveerd. Nieuwe uitvoeringen plaatsen zichzelf in de aparte sectie Achtergrondtaken en archiveren zichzelf na afloop. Een nieuwe taak kan kort tijdens het starten zichtbaar zijn voordat deze verplaatsing is uitgevoerd.

Productiepublicatie: nog te verifiëren via de gecontroleerde Loci-keten.
