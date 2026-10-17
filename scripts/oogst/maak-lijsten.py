"""Bouwt de tussenlijsten van de trechter, zodat de overdracht tussen de stappen klopt.

Zes bestanden werden door de stappen gelezen maar door geen enkel script geschreven; de
beheerder stelde ze elke ronde met de hand samen. Dat kostte niet alleen tijd, het liet
ook instellingen wegvallen. In de ronde van 16 oktober 2026 gaf `oogst.json` 159
instellingen zonder vondst, maar bevatte `js-paginas.json` er 132: 21 beeldenparken en 4
architectuurlocaties kregen stap 2 tot 4 nooit, en Museum Belvedere en Mediamatic vielen
zonder reden weg. Het protocol zegt uitdrukkelijk dat de bronsoort geen categoriefilter is.

Daarom laat dit script niets stil wegvallen: wat niet mee kan, wordt met naam en reden
gemeld. Elke lijst is een subopdracht, zodat een stap los te draaien is:

    python3 scripts/oogst/maak-lijsten.py instellingen     # uit de database
    python3 scripts/oogst/maak-lijsten.py catalogus        # uit de database
    python3 scripts/oogst/maak-lijsten.py js-paginas       # na stap 1
    python3 scripts/oogst/maak-lijsten.py zonder-sitemap   # na stap 2
    python3 scripts/oogst/maak-lijsten.py browser-nodig    # na stap 3
    python3 scripts/oogst/maak-lijsten.py restlijst        # na filter-ruis.py

`instellingen` en `catalogus` lezen de database en hebben daarvoor de secret key nodig,
uit `~/.config/kunstkiezer/service-role` (of `KK_SERVICE_ROLE`). Dit is het enige script
in deze laag dat een sleutel gebruikt; hij staat alleen in de verzoekkoppen en komt niet
in een bestand of in de uitvoer terecht. De vier andere lijsten lezen alleen de werkmap.
"""
import collections
import io
import json
import os
import sys
import urllib.parse
import urllib.request

from werkmap import WERK, pad
import titels

BASIS = (os.environ.get('KK_SUPABASE_URL') or 'https://qrlfywcqkkzmerglmsbj.supabase.co').rstrip('/')
SLEUTELPAD = os.environ.get('KK_SERVICE_ROLE') or '~/.config/kunstkiezer/service-role'
# de locatievelden die de volgende stappen alleen doorgeven, en hun kolom in de database
LOCATIE = {'museum': 'name', 'city': 'city', 'province': 'province', 'adres': 'street_address',
           'lat': 'latitude', 'lon': 'longitude', 'precisie': 'coordinate_precision'}


def sleutel():
    pad_ = os.path.expanduser(SLEUTELPAD)
    try:
        s = io.open(pad_, encoding='utf-8').read().strip()
    except OSError:
        raise SystemExit(f'Geen sleutel te lezen op {pad_}. Zet KK_SERVICE_ROLE of leg hem daar neer.')
    if not s:
        raise SystemExit(f'De sleutel op {pad_} is leeg.')
    return s


def api(tabel, **vraag):
    """Alle rijen van een tabel, in pagina's van duizend. De sleutel blijft in de koppen."""
    k = sleutel()
    uit, start = [], 0
    while True:
        url = f'{BASIS}/rest/v1/{tabel}?' + urllib.parse.urlencode(vraag)
        req = urllib.request.Request(url, headers={
            'apikey': k, 'Authorization': 'Bearer ' + k,
            'Range-Unit': 'items', 'Range': f'{start}-{start + 999}'})
        with urllib.request.urlopen(req, timeout=60) as r:
            blok = json.load(r)
        uit += blok
        if len(blok) < 1000:
            return uit
        start += 1000


def host_van(url):
    """De host zonder `www.`, waarop de lijst wordt ontdubbeld."""
    try:
        h = (urllib.parse.urlparse(url or '').netloc or '').lower()
    except ValueError:
        return ''
    return h[4:] if h.startswith('www.') else h


def bewaar(naam, rijen):
    with io.open(pad(naam + '.json'), 'w', encoding='utf-8') as f:
        json.dump(rijen, f, ensure_ascii=False, indent=1)
    print(f'-> {naam}.json: {len(rijen)} records')


def werkmap_lijst(naam):
    try:
        return json.load(io.open(pad(naam + '.json'), encoding='utf-8'))
    except OSError:
        raise SystemExit(f'{naam}.json staat niet in de werkmap; draai eerst de stap die het schrijft.')


# ---------------------------------------------------------------- uit de database

def maak_instellingen():
    """Gepubliceerde, open instellingen met webadres, ontdubbeld op host.

    Musea komen uit `kk_museums`; beeldenparken en architectuur uit `kk_discoveries`,
    want dat zijn daar bezoekbare locaties met een eigen programma. De categorie
    `openbare-kunst` blijft eruit: een beeld in de openbare ruimte heeft geen
    tentoonstellingsprogramma om te oogsten (het zou 10 hosts toevoegen).
    """
    musea = api('kk_museums', select='id,name,website_url',
                publication_status='eq.published', operating_status='eq.open',
                website_url='not.is.null', order='name')
    overig = api('kk_discoveries', select='id,name,website_url,category',
                 publication_status='eq.published', website_url='not.is.null',
                 category='in.(beeldenparken,architectuur)', order='name')
    print(f'kk_museums: {len(musea)} | kk_discoveries (beeldenparken, architectuur): {len(overig)}')

    uit, eerste, zonder_host, dubbel = [], {}, [], []
    for rij, categorie in [(r, 'musea') for r in musea] + [(r, r['category']) for r in overig]:
        h = host_van(rij['website_url'])
        if not h:
            zonder_host.append(rij['name'])
            continue
        if h in eerste:
            dubbel.append((rij['name'], h, eerste[h]))
            continue
        eerste[h] = rij['name']
        uit.append({'name': rij['name'], 'host': h, 'website_url': rij['website_url'],
                    'category': categorie})
    print('per categorie:', dict(collections.Counter(r['category'] for r in uit)))
    for naam in zonder_host:
        print(f'  GEEN HOST, valt weg: {naam} (webadres niet te lezen)')
    for naam, h, al in dubbel:
        print(f'  zelfde host als een eerdere instelling, niet dubbel opgenomen: {naam} ({h}, al bezet door {al})')
    bewaar('instellingen', uit)


def maak_catalogus():
    """Alles wat al in `kk_discoveries` staat, ongeacht status.

    Ook `archived` en `draft`: een record dat de redactie heeft weggezet of nog niet
    heeft vrijgegeven, wil je evengoed niet een tweede keer aanmaken.
    """
    rijen = api('kk_discoveries', select='name,city,starts_on,ends_on,publication_status',
                order='name')
    print('per status:', dict(collections.Counter(r['publication_status'] for r in rijen)))
    print('met einddatum:', sum(1 for r in rijen if r.get('ends_on')),
          '| zonder (vaste opstelling):', sum(1 for r in rijen if not r.get('ends_on')))
    zonder_naam = [r for r in rijen if not (r.get('name') or '').strip()]
    for r in zonder_naam:
        print(f'  LET OP: rij zonder naam in kk_discoveries ({r.get("city")}); die kan niets ontdubbelen')
    bewaar('catalogus', rijen)


def locatiekaart():
    """De bezoeklocaties uit de database, op naam en op host.

    Op naam eerst, want een host is geen zaal. Museum de Fundatie heeft twee locaties
    onder hetzelfde webadres (Blijmarkt in Zwolle en Kasteel het Nijenhuis in Heino), en
    utrechtslandschap.nl en architectuurgids.nl dragen er tientallen. Wie op host matcht,
    hangt aan elke vondst een willekeurig van die adressen — precies de fout die de
    verificatieregels verbieden. Kan de naam het niet beslissen en heeft de host meer dan
    een locatie, dan geeft dit script géén adres en zegt het dat.
    """
    op_naam, op_host = {}, {}
    for tabel in ('kk_discoveries', 'kk_museums'):
        velden = 'id,name,website_url,' + ','.join(sorted(set(LOCATIE.values())))
        for r in api(tabel, select=velden, website_url='not.is.null'):
            h = host_van(r['website_url'])
            if not h:
                continue
            plek = {doel: r.get(kolom) for doel, kolom in LOCATIE.items()}
            plek['museum_id'] = r['id']
            op_naam[titels.kern(r['name'])] = plek  # kk_museums wint van kk_discoveries
            op_host.setdefault(h, []).append(plek)
    return op_naam, op_host


def locatie_van(rij, op_naam, op_host):
    """(bezoeklocatie, reden) voor een instelling; bij twijfel geen locatie."""
    plek = op_naam.get(titels.kern(rij.get('naam')))
    if plek:
        return plek, 'op naam'
    kandidaten = op_host.get((rij.get('host') or '').lower()) or op_host.get(host_van(rij.get('programma'))) or []
    if len(kandidaten) == 1:
        return kandidaten[0], 'op host'
    if not kandidaten:
        return None, 'geen rij in de database met dit webadres'
    adressen = {(p.get('adres'), p.get('city')) for p in kandidaten}
    if len(adressen) == 1:
        return kandidaten[0], 'op host (alle rijen dezelfde locatie)'
    return None, f'{len(kandidaten)} locaties op deze host, naam beslist het niet'


# ---------------------------------------------------------------- tussen de stappen

def maak_js_paginas():
    """Wat stap 1 niet opleverde, met de bezoeklocatie erbij, voor stap 2."""
    oogst = werkmap_lijst('oogst')
    op_naam, op_host = locatiekaart()
    zonder = [r for r in oogst if not r.get('vondsten')]
    print(f'oogst.json: {len(oogst)} instellingen, waarvan {len(zonder)} zonder vondst')

    uit, geen_locatie, hoe = [], [], collections.Counter()
    for r in zonder:
        rij = dict(r)
        plek, reden = locatie_van(r, op_naam, op_host)
        hoe[reden] += 1
        if plek:
            rij.update(plek)
        else:
            rij.update({k: None for k in LOCATIE}, museum_id=None)
            rij['museum'] = r.get('naam')
            geen_locatie.append((r.get('naam'), reden))
        uit.append(rij)
    print('per categorie:', dict(collections.Counter(r.get('categorie') for r in uit)))
    print('bezoeklocatie gevonden:', dict(hoe))
    for naam, reden in geen_locatie:
        print(f'  gaat mee ZONDER bezoeklocatie: {naam} ({reden});'
              f' bezoekadres.py leest die uit de aankondiging zelf')
    print(f'  {len(uit) - len(geen_locatie)} van {len(uit)} met een bezoeklocatie uit de database')
    bewaar('js-paginas', uit)


def maak_zonder_sitemap():
    """Wat stap 2 niet opleverde, voor stap 3."""
    bron = werkmap_lijst('sitemap-urls')
    uit = [r for r in bron if not r.get('kandidaat_urls')]
    fout = [r for r in uit if r.get('fout')]
    print(f'sitemap-urls.json: {len(bron)} instellingen, {len(bron) - len(uit)} met kandidaat-URLs')
    for r in fout:
        print(f'  gaat mee na een fout in stap 2: {r.get("museum")} ({r["fout"]})')
    bewaar('zonder-sitemap', uit)


def maak_browser_nodig():
    """Wat stap 3 niet opleverde, voor stap 4."""
    bron = werkmap_lijst('server-links')
    uit = [r for r in bron if not r.get('links')]
    print(f'server-links.json: {len(bron)} instellingen, {len(bron) - len(uit)} met links')
    for r in (r for r in uit if r.get('fout')):
        print(f'  gaat mee na een fout in stap 3: {r.get("museum")} ({r["fout"]})')
    bewaar('browser-nodig', uit)


def maak_restlijst():
    """Kandidaten die nog niet in de catalogus staan, voor `detail-per-kandidaat.py`.

    `ontdubbel.py` vergeleek met de catalogus zoals die aan het begin van de ronde was.
    Tijdens de ronde groeit die, dus hier wordt opnieuw vergeleken, met dezelfde maat uit
    `titels.py`.
    """
    kandidaten = werkmap_lijst('kandidaten-schoon')
    cat = werkmap_lijst('catalogus')
    bekend = [(titels.kern(r['name']), r) for r in cat if (r.get('name') or '').strip()]

    uit, al_bekend, zonder_bron = [], [], []
    for r in kandidaten:
        k = titels.kern(r.get('titel'))
        if len(k) < 4:
            print(f'  titel te kort om te vergelijken, gaat mee: {r.get("titel")!r}')
            uit.append(r)
            continue
        beste, score = titels.beste_treffer(k, bekend)
        if score >= titels.DREMPEL:
            al_bekend.append((r.get('titel'), beste['name'] if beste else '?', round(score, 2)))
            continue
        if not r.get('bron'):
            zonder_bron.append(r.get('titel'))
        uit.append(r)
    print(f'kandidaten-schoon.json: {len(kandidaten)} | staat al in de catalogus: {len(al_bekend)}')
    for titel, lijkt, score in al_bekend[:10]:
        print(f'  al bekend ({score}): {titel[:44]} ~ {lijkt[:40]}')
    if len(al_bekend) > 10:
        print(f'  ... en nog {len(al_bekend) - 10}')
    for titel in zonder_bron:
        print(f'  LET OP: geen bron-URL, detail-per-kandidaat.py kan hier niets openen: {titel}')
    bronnen = [r['bron'] for r in uit if r.get('bron')]
    print(f'  {len(bronnen)} kandidaten op {len(set(bronnen))} overzichtspagina\'s'
          f' (de cache van haal.py haalt die een keer op)')
    bewaar('restlijst', uit)


LIJSTEN = {'instellingen': maak_instellingen, 'catalogus': maak_catalogus,
           'js-paginas': maak_js_paginas, 'zonder-sitemap': maak_zonder_sitemap,
           'browser-nodig': maak_browser_nodig, 'restlijst': maak_restlijst}

HULP = """Bouwt een tussenlijst van de oogsttrechter in de werkmap.

  instellingen     uit de database: gepubliceerde, open instellingen met webadres,
                   ontdubbeld op host (musea, beeldenparken, architectuur)
  catalogus        uit de database: alles wat al in kk_discoveries staat
  js-paginas       na stap 1: wat oogst.json niet opleverde, met de bezoeklocatie erbij
  zonder-sitemap   na stap 2: wat sitemap-urls.json niet opleverde
  browser-nodig    na stap 3: wat server-links.json niet opleverde
  restlijst        na filter-ruis.py: kandidaten die nog niet in de catalogus staan

De werkmap is KK_OOGST_WERKMAP (nu: {werkmap}).
"""

if __name__ == '__main__':
    keuze = sys.argv[1] if len(sys.argv) > 1 else ''
    if keuze not in LIJSTEN:
        print(HULP.format(werkmap=os.path.abspath(WERK)))  # geen pad(): dat zou de werkmap al maken
        raise SystemExit(0 if not keuze else f'Onbekende lijst: {keuze}')
    LIJSTEN[keuze]()
