"""Eén plek waar deze laag pagina's ophaalt, met een cache in de werkmap.

Binnen één ronde heeft de trechter dezelfde pagina meer dan eens nodig: stap 3 plukt
links uit hetzelfde overzicht dat stap 1 al ophaalde, en `detail-per-kandidaat.py` opende
dat overzicht opnieuw voor elke kandidaat erop. Gemeten op de ronde van 17 oktober 2026:
118 kandidaten op 61 overzichtspagina's, waarvan de agenda van Kunstpunt Groningen
zeventien keer — 48 procent van die aanroepen was dubbel.

De cache staat in de werkmap en niet in een vaste map: een nieuwe ronde krijgt een nieuwe
`KK_OOGST_WERKMAP` en dus verse pagina's. Binnen één ronde is een pagina een momentopname
die alle stappen mogen delen. Alleen geslaagde antwoorden worden bewaard; een fout wordt
opnieuw geprobeerd, zodat de stappen dezelfde foutmeldingen blijven geven als voorheen.
"""
import gzip
import hashlib
import json
import os
import ssl
import threading
import urllib.request

from werkmap import pad

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')

# Gelijk aan wat de losse scripts deden; sommige instellingssites hebben een
# onvolledige certificaatketen en vielen anders uit de ronde.
_ctx = ssl.create_default_context()
_ctx.check_hostname = False
_ctx.verify_mode = ssl.CERT_NONE

_slot = threading.Lock()
_telling = {'netwerk': 0, 'cache': 0}


def _cachemap():
    m = pad('cache')
    os.makedirs(m, exist_ok=True)
    return m


def _bestand(url, limiet):
    # de limiet hoort in de sleutel: dezelfde URL met een ruimere limiet is een andere
    # momentopname, en een afgekapte pagina mag een ruimere lezing niet in de weg staan
    naam = hashlib.sha256(f'{limiet}|{url}'.encode('utf-8')).hexdigest()[:40]
    return os.path.join(_cachemap(), naam + '.json')


def _bewaar(doel, inhoud):
    tijdelijk = f'{doel}.{os.getpid()}.{threading.get_ident()}'
    try:
        with open(tijdelijk, 'w', encoding='utf-8') as f:
            json.dump(inhoud, f, ensure_ascii=False)
        os.replace(tijdelijk, doel)  # atomair: threads lezen nooit een half bestand
    except OSError:
        try:
            os.unlink(tijdelijk)
        except OSError:
            pass


def tekst(url, timeout=18, limiet=1_200_000, accept=None, taal='nl,en;q=0.8', uitpakken=False):
    """(status, inhoud, eind-URL) van een openbare pagina.

    Dezelfde URL binnen dezelfde ronde komt uit de cache en kost geen aanroep. Fouten
    worden niet bewaard en dus opnieuw geprobeerd. `uitpakken` gunzipt een sitemap.
    """
    bestand = _bestand(url, limiet)
    try:
        with open(bestand, encoding='utf-8') as f:
            d = json.load(f)
        with _slot:
            _telling['cache'] += 1
        return d['status'], d['tekst'], d['eind']
    except (OSError, ValueError, KeyError):
        pass

    koppen = {'User-Agent': UA}
    if taal:
        koppen['Accept-Language'] = taal
    if accept:
        koppen['Accept'] = accept
    req = urllib.request.Request(url, headers=koppen)
    with urllib.request.urlopen(req, timeout=timeout, context=_ctx) as r:
        status, eind = r.status, r.url
        ruw = r.read(limiet)
    if uitpakken and (url.endswith('.gz') or ruw[:2] == b'\x1f\x8b'):
        ruw = gzip.decompress(ruw)
    inhoud = ruw.decode('utf-8', 'replace')
    with _slot:
        _telling['netwerk'] += 1
    _bewaar(bestand, {'url': url, 'status': status, 'eind': eind, 'tekst': inhoud})
    return status, inhoud, eind


def samenvatting():
    """Regel voor het einde van een stap: hoeveel aanroepen de cache heeft uitgespaard."""
    with _slot:
        netwerk, cache = _telling['netwerk'], _telling['cache']
    deel = f' ({100 * cache // (netwerk + cache)}% uitgespaard)' if netwerk + cache else ''
    return f'{netwerk} opgehaald, {cache} uit de cache{deel}'
