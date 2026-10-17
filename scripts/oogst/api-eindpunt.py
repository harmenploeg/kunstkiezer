"""Trechterstap 4: zoek een machineleesbaar eindpunt achter een pagina die JavaScript gebruikt.

Veel bouwsystemen bieden dezelfde pagina ook als JSON aan. Kirby doet dat met een .json
achter de URL, WordPress via /wp-json, Craft en Statamic vaak via /api of /actions.
Dat is serverzijdig op te halen en dus veel goedkoper dan een browser.
"""
import json, re, urllib.request, urllib.parse, ssl, concurrent.futures as cf, time
from werkmap import pad

import route

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
DATUM = re.compile(r'\d{1,2}\s+\w{3,10}\.?\s*20\d\d|\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}')


def probeer(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=12, context=ctx) as r:
            soort = (r.headers.get('content-type') or '').lower()
            ruw = r.read(600_000).decode('utf-8', 'replace')
        if 'json' not in soort and not ruw.lstrip().startswith(('{', '[')):
            return None
        data = json.loads(ruw)
        tekst = json.dumps(data, ensure_ascii=False)
        return {'url': url, 'bytes': len(ruw), 'datums': len(DATUM.findall(tekst))}
    except Exception:
        return None


def werk(r):
    p = urllib.parse.urlparse(r['programma'])
    schoon = f'{p.scheme}://{p.netloc}{p.path.rstrip("/")}'
    basis = f'{p.scheme}://{p.netloc}'
    pogingen = [schoon + '.json', schoon + '/index.json',
                basis + '/wp-json/wp/v2/pages?per_page=20',
                basis + '/wp-json/wp/v2/tentoonstelling?per_page=20',
                basis + '/api/tentoonstellingen', basis + '/api/exhibitions']
    uit = {k: r.get(k) for k in ('museum', 'city', 'province', 'adres', 'lat', 'lon', 'precisie', 'museum_id', 'programma')}
    host = route.host_van(r['programma'])
    # een eindpunt dat eerder werkte is één aanroep; zoeken kost er zes
    onthouden = (route.van(host).get('eindpunt') or {}).get('url')
    if onthouden:
        t = probeer(onthouden)
        if t and t['datums'] > 0:
            uit['api'] = t
            uit['via'] = 'onthouden'
            return uit
        route.vergeet_veld(host, 'eindpunt', 'gaf geen datums meer')
    for u in pogingen:
        t = probeer(u)
        if t and t['datums'] > 0:
            uit['api'] = t
            route.onthoud(host, eindpunt={'soort': 'json', 'url': t['url']}, stap=4)
            return uit
    uit['api'] = None
    return uit


if __name__ == '__main__':
    doel = json.load(open(pad('browser-nodig.json')))
    t0 = time.time(); alles = []
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for i, r in enumerate(pool.map(werk, doel), 1):
            alles.append(r)
            if i % 20 == 0: print(f'  {i}/{len(doel)}  {time.time()-t0:.0f}s', flush=True)
    json.dump(alles, open(pad('api-endpoints.json'), 'w'), ensure_ascii=False, indent=1)
    route.bewaar()
    raak = [r for r in alles if r['api']]
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'instellingen met een bruikbaar JSON-eindpunt: {len(raak)}/{len(alles)}')
    for r in raak:
        print(f"  {r['museum'][:30]:32} {r['api']['datums']:>4} datums  {r['api']['url'][:72]}")
