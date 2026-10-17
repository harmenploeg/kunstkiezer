"""Trechterstap 3: verzamel serverzijdig de links naar afzonderlijke tentoonstellingen.

Veel overzichtspagina's renderen hun links wel in de HTML, ook als de looptijden pas
door JavaScript verschijnen. Dan is de browser niet nodig om de detailpagina's te vinden.
"""
import json, re, urllib.parse, html, concurrent.futures as cf, time
from werkmap import pad

import haal
import route
DETAIL = re.compile(r'/(tentoonstelling|tentoonstellingen|expositie|exposities|exhibition|exhibitions|'
                    r'programma|agenda|project|projects|nu-te-zien|activiteit|activiteiten|event)/[^/?#]{3,}', re.I)
NIET = re.compile(r'(archief|archive|afgelopen|past|verleden|/page/|/tag/|/category/|\.(jpg|png|pdf)$)', re.I)


def werk(r):
    uit = {k: r.get(k) for k in ('museum', 'city', 'province', 'adres', 'lat', 'lon', 'precisie', 'museum_id', 'programma')}
    try:
        # dezelfde pagina als in stap 1: die komt uit de cache van de ronde
        _, h, basis = haal.tekst(r['programma'], timeout=18, limiet=1_200_000)
        eigen = urllib.parse.urlparse(basis).netloc
        gevonden, zien = [], set()
        for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\']', h, re.I):
            u = urllib.parse.urljoin(basis, html.unescape(m.group(1)))
            p = urllib.parse.urlparse(u)
            if p.netloc != eigen or not DETAIL.search(p.path) or NIET.search(u):
                continue
            u = p.scheme + '://' + p.netloc + p.path.rstrip('/')
            if u == basis.rstrip('/') or u in zien:
                continue
            zien.add(u); gevonden.append(u)
        uit['links'] = gevonden[:25]
        if gevonden:
            route.onthoud(route.host_van(r['programma']), stap=3)
    except Exception as e:
        uit['fout'] = f'{type(e).__name__}: {str(e)[:60]}'
        uit['links'] = []
    return uit


if __name__ == '__main__':
    doel = json.load(open(pad('zonder-sitemap.json')))
    t0 = time.time(); alles = []
    with cf.ThreadPoolExecutor(max_workers=10) as pool:
        for i, r in enumerate(pool.map(werk, doel), 1):
            alles.append(r)
            if i % 30 == 0: print(f'  {i}/{len(doel)}  {time.time()-t0:.0f}s', flush=True)
    json.dump(alles, open(pad('server-links.json'), 'w'), ensure_ascii=False, indent=1)
    route.bewaar()
    raak = [r for r in alles if r['links']]
    print(f'klaar in {time.time()-t0:.0f}s | {haal.samenvatting()}')
    print(f'instellingen met links : {len(raak)}/{len(alles)}')
    print(f'links totaal           : {sum(len(r["links"]) for r in alles)}')
    print(f'nog echt browser nodig : {len(alles)-len(raak)}')
