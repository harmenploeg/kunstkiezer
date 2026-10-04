# Tentoonstellingen en evenementen: dekking van programma's

De agenda moet alle relevante grote tentoonstellingen van grote musea omvatten, aangevuld met opmerkelijke presentaties van kleinere musea, kunstinstellingen en kunstevenementen. Een reeks recensies of losse toevoegingen bewijst geen volledige dekking. Controleer daarom naast de nieuwsbronnen systematisch de officiële programma's.

## Onderzoeksbestand

`data/curation/exhibition-coverage.json` houdt de controle per museum bij. De beginpopulatie is de actuele geselecteerde museumcatalogus; vul ontbrekende grote musea en externe organisatoren aan zodra de actieve bronnenpool die oplevert. De expliciete prioriteitsgroep is een redactionele startgroep, geen ranglijst naar bezoekersaantallen en geen bovengrens. Alle overige geselecteerde musea blijven in het onderzoeksbestand. Een bronuitschakeling in `kk_update_sources` gaat altijd voor deze werklijst.

Begin iedere ronde met de nog niet volledig gecontroleerde programma's van de prioriteitsgroep en met concrete nieuwe aanwijzingen. Loop daarna de overige programma's af, verdeeld over provincies en kunstvormen. Controleer bij grote instellingen alle locaties, huidige tentoonstellingen én binnenkort-pagina's. Eén tentoonstelling toegevoegd of de homepage gelezen betekent `partial`, niet `checked`. Registreer gelezen programmapagina's, peildatum, volledig gecontroleerd datumvenster, alle gevonden tentoonstellingen en de reden van opnemen of uitsluiten. Een leeg programma mag pas worden vastgelegd na inhoudelijke controle van de relevante overzichtspagina's. Houd nieuwsbronnen en programmadekking afzonderlijk bij.

## Selectie

Neem van de grote musea iedere zelfstandig aangekondigde tijdelijke kunsttentoonstelling in het actuele venster op: beeldende kunst, fotografie, vormgeving, toegepaste kunst, mediakunst en architectuur. Selecteer niet alleen de hoofdtentoonstelling op de voorpagina. Bij kleinere instellingen en evenementen zijn een inhoudelijk onderscheidend kunstenaarsprogramma, bijzondere bruiklenen, regionaal belangrijke kunstpresentatie, multidisciplinaire kunstmanifestatie of relevante festivaleditie mogelijke redenen; leg de concrete reden per record vast. Omvang, bekendheid of een recensie zijn geen noodzakelijke voorwaarden. Beoordeel vondsten tevens op museum, beeldentuin, openbare kunst en architectuur.

Een permanente collectie zonder afzonderlijke tijdelijke presentatie hoort bij het locatierecord. Rondleidingen bij dezelfde tentoonstelling vormen geen dubbele tentoonstelling. Boekpresentaties, algemene markten, louter historische presentaties en entertainment zonder onderbouwde kunstinhoud worden niet automatisch opgenomen. Een organisator hoeft niet zelf een geselecteerd kunstmuseum te zijn om een relevante kunsttentoonstelling te organiseren.

## Verificatie en wekelijkse herhaling

Lees vóór bronnenonderzoek de actuele bronnenpool. Gebruik de ingeschakelde groep officiële instellingen voor programma's en de overige ingeschakelde bronnen voor aanwijzingen. Verifieer titel, maker(s), kunstinhoud, werkelijke bezoeklocatie, toegang en volledige begin- en einddatum bij de organisator. Het venster is Europe/Amsterdam: einddatum ten minste vandaag, begindatum uiterlijk vandaag plus één kalendermaand. Bewaar verder vooruit aangekondigde presentaties als kandidaten. Verzin geen einddatum. Noteer concrete datumconflicten en de gekozen primaire bron.

Ontdubbel op organisator, locatie, titel en looptijd. Verbind een tentoonstelling waar passend aan het bestaande museum-id. Gebruik bij verspreide festivals duidelijke locaties; neem geen museumcoördinaat over als die niet de tentoonstelling aanwijst. Foto's vereisen maker, bron en hergebruikvoorwaarden; historische locatiefoto's moeten als zodanig herkenbaar zijn. Een ontbrekende passende foto blijft een expliciet dossierpunt.

Controleer wekelijks verlengingen, gewijzigde openingsdata, sluitingen en aflopende presentaties. De dynamische agendafilter sluit afgelopen tentoonstellingen uit; overschrijf historische datums niet om ze zichtbaar te houden. Behoud redactionele wijzigingen met de bestaande conflictcontrole. Synchroniseer catalogus en audit na databaseverificatie en publiceer via de gecontroleerde Loci-keten.

Rapporteer apart: aantal gecontroleerde musea, aantal volledig gecontroleerde programma's, nog open prioriteitsmusea, nieuwe/gewijzigde tentoonstellingen en concrete bronblokkades. Verhoog `last_complete_check` alleen na volledige programmacontrole; acht nieuwe tentoonstellingen mogen bijvoorbeeld niet worden gepresenteerd als een volledig gecontroleerde landelijke agenda. De bestaande weekplanning en wachtrij blijven leidend; deze methode maakt geen extra automatisering.
