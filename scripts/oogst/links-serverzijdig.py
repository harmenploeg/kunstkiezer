"""Stap 15: verzamel serverzijdig de links naar afzonderlijke tentoonstellingen.

Veel overzichtspagina's renderen hun links wel in de HTML, ook als de looptijden pas
door JavaScript verschijnen. Dan is de browser niet nodig om de detailpagina's te vinden.
"""
import json, re, urllib.request, urllib.parse, ssl, html, concurrent.futures as cf, time
from werkmap import pad

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
DETAIL = re.compile(r'/(tentoonstelling|tentoonstellingen|expositie|exposities|exhibition|exhibitions|'
                    r'programma|agenda|project|projects|nu-te-zien|activiteit|activiteiten|event)/[^/?#]{3,}', re.I)
NIET = re.compile(r'(archief|archive|afgelopen|past|verleden|/page/|/tag/|/category/|\.(jpg|png|pdf)$)', re.I)


def werk(r):
    uit = {k: r.get(k) for k in ('museum', 'city', 'province', 'adres', 'lat', 'lon', 'precisie', 'museum_id', 'programma')}
    try:
        req = urllib.request.Request(r['programma'], headers={'User-Agent': UA, 'Accept-Language': 'nl,en;q=0.8'})
        with urllib.request.urlopen(req, timeout=18, context=ctx) as resp:
            basis = resp.url
            h = resp.read(1_200_000).decode('utf-8', 'replace')
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
    raak = [r for r in alles if r['links']]
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'instellingen met links : {len(raak)}/{len(alles)}')
    print(f'links totaal           : {sum(len(r["links"]) for r in alles)}')
    print(f'nog echt browser nodig : {len(alles)-len(raak)}')
