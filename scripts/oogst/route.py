"""Wat bij een instelling werkte, zodat een volgende ronde daar begint.

De ontdekking in stap 1 is deterministisch. De rondes van 16 en 17 oktober 2026 vonden
bij 264 van de 264 instellingen exact dezelfde programmapagina, met hetzelfde aandeel
homepage-link (244) en gegokt pad (20) — en betaalden daar elke ronde 332 opgehaalde
homepages voor. Zulke ontdekking hoort één keer te gebeuren; daarna is het een gegeven.

Het geheugen staat in `data/curation/oogst-routes.json`, per host:

    "www.museumarnhem.nl": {
      "programma": "https://www.museumarnhem.nl/nl/tentoonstellingen",
      "stap": 4, "eindpunt": {"soort": "kirby", "url": ".../tentoonstellingen.json"},
      "gelukt": "2026-10-17"
    }

Dit is gemeten werkwijze en geen momentopname van een site, dus het hoort wél in
versiebeheer — anders is de meting na één ronde weer weg. Dat is ook wat
`scripts/oogst/LEESMIJ.md` al voorschreef voor een gevonden eindpunt: "daarna is die
ingang voor altijd serverzijdig bruikbaar en hoort hij bij de bron te worden vastgelegd".

Een route die niet meer werkt wordt niet stil weggegooid. `vergeet()` zet `gebroken` met
de reden erbij en haalt `programma` weg, zodat de trechter opnieuw zoekt en in het
verslag van de ronde te zien is wat er bij die instelling veranderde.
"""
import datetime
import json
import os
import threading
import urllib.parse

BESTAND = os.environ.get('KK_OOGST_ROUTES') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    'data', 'curation', 'oogst-routes.json')

_slot = threading.Lock()
_routes = None
_vuil = False


def host_van(url):
    """De host waaronder een route wordt bewaard; leeg bij een onbruikbare URL."""
    try:
        return urllib.parse.urlparse(url or '').netloc.lower()
    except ValueError:
        return ''


def lees():
    """Alle onthouden routes, één keer van schijf."""
    global _routes
    with _slot:
        if _routes is None:
            try:
                with open(BESTAND, encoding='utf-8') as f:
                    d = json.load(f)
                _routes = d.get('routes', d) if isinstance(d, dict) else {}
            except (OSError, ValueError):
                _routes = {}
        return _routes


def van(host):
    """De route van deze host, of een lege dict. Een gebroken route geeft niets terug."""
    r = lees().get((host or '').lower()) or {}
    return {} if r.get('gebroken') else r


def onthoud(host, **velden):
    """Leg vast wat werkte. Alleen de meegegeven velden veranderen."""
    global _vuil
    host = (host or '').lower()
    if not host:
        return
    lees()  # buiten het slot: `_slot` is niet herintreedbaar
    with _slot:
        r = _routes.setdefault(host, {})
        r.pop('gebroken', None)
        r.pop('waarom', None)
        r.update({k: v for k, v in velden.items() if v is not None})
        r['gelukt'] = datetime.date.today().isoformat()
        _vuil = True


def vergeet(host, waarom):
    """Markeer een route als gebroken, met de reden, zodat de trechter opnieuw zoekt."""
    global _vuil
    host = (host or '').lower()
    if not host or host not in lees():
        return
    with _slot:
        r = _routes[host]
        r.pop('programma', None)
        r.pop('eindpunt', None)
        r.pop('sitemap', None)
        r['gebroken'] = datetime.date.today().isoformat()
        r['waarom'] = str(waarom)[:120]
        _vuil = True


def vergeet_veld(host, veld, waarom):
    """Vergeet één ingang (eindpunt, sitemap) en laat de rest van de route staan."""
    global _vuil
    host = (host or '').lower()
    if not host or host not in lees():
        return
    with _slot:
        r = _routes[host]
        if r.pop(veld, None) is not None:
            r['waarom_' + veld] = str(waarom)[:120]
            _vuil = True


def bewaar():
    """Schrijf het geheugen terug. Zonder wijziging blijft het bestand ongemoeid."""
    global _vuil
    with _slot:
        if not _vuil or _routes is None:
            return False
        inhoud = {'bijgewerkt': datetime.date.today().isoformat(),
                  'toelichting': 'Per host de goedkoopste route die werkte; zie scripts/oogst/route.py.',
                  'routes': dict(sorted(_routes.items()))}
        os.makedirs(os.path.dirname(BESTAND), exist_ok=True)
        tijdelijk = f'{BESTAND}.{os.getpid()}'
        with open(tijdelijk, 'w', encoding='utf-8') as f:
            json.dump(inhoud, f, ensure_ascii=False, indent=1)
            f.write('\n')
        os.replace(tijdelijk, BESTAND)
        _vuil = False
        return True


def samenvatting():
    """Regel voor het einde van een stap: hoe vol het geheugen staat."""
    r = lees()
    heel = [k for k, v in r.items() if not v.get('gebroken')]
    gebroken = [k for k, v in r.items() if v.get('gebroken')]
    met_eindpunt = [k for k in heel if r[k].get('eindpunt')]
    return (f'{len(heel)} onthouden routes ({len(met_eindpunt)} met eindpunt)'
            + (f', {len(gebroken)} gebroken' if gebroken else ''))
