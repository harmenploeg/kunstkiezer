"""Stap 13: zoek detailpagina's van tentoonstellingen via de sitemap van de instelling.

Goedkoper dan een browser: de sitemap staat los van JavaScript en noemt vaak elke
afzonderlijke tentoonstellingspagina.
"""
import json, re, gzip, io, urllib.request, urllib.parse, ssl, concurrent.futures as cf, time
from werkmap import pad

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
TENT = re.compile(r'/(tentoonstelling|tentoonstellingen|exposition|expositie|exposities|exhibition|exhibitions|'
                  r'nu-te-zien|nu_te_zien|te-zien|agenda|programma)/[^/]', re.I)
NIET = re.compile(r'(archief|archive|afgelopen|past|verleden|/page/\d|\?|#)', re.I)


def haal(url, timeout=15):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'nl'})
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        ruw = r.read(4_000_000)
    if url.endswith('.gz') or ruw[:2] == b'\x1f\x8b':
        ruw = gzip.decompress(ruw)
    return ruw.decode('utf-8', 'replace')


def sitemaps_van(basis):
    """Kandidaat-sitemaps: uit robots.txt en de gangbare paden."""
    uit = []
    try:
        rb = haal(urllib.parse.urljoin(basis, '/robots.txt'), 10)
        uit += re.findall(r'(?im)^\s*sitemap:\s*(\S+)', rb)
    except Exception:
        pass
    for pad in ('/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/wp-sitemap.xml'):
        uit.append(urllib.parse.urljoin(basis, pad))
    gezien, net = set(), []
    for u in uit:
        if u not in gezien:
            gezien.add(u); net.append(u)
    return net[:6]


def werk(r):
    basis = f"{urllib.parse.urlparse(r['programma']).scheme}://{urllib.parse.urlparse(r['programma']).netloc}"
    uit = {k: r.get(k) for k in ('museum', 'city', 'province', 'adres', 'lat', 'lon', 'precisie', 'museum_id', 'programma')}
    urls, bezocht = set(), 0
    try:
        wachtrij = sitemaps_van(basis)
        while wachtrij and bezocht < 8 and len(urls) < 60:
            s = wachtrij.pop(0); bezocht += 1
            try:
                xml = haal(s)
            except Exception:
                continue
            locs = re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', xml)
            if '<sitemapindex' in xml[:900]:
                for l in locs:
                    if len(wachtrij) < 8 and re.search(r'(post|page|tentoonstelling|exhibition|expositie|agenda)', l, re.I):
                        wachtrij.append(l)
                if not any(re.search(r'(post|page|tentoonstelling|exhibition|expositie|agenda)', l, re.I) for l in locs):
                    wachtrij.extend(locs[:4])
                continue
            for l in locs:
                if TENT.search(l) and not NIET.search(l):
                    urls.add(l)
        uit['kandidaat_urls'] = sorted(urls)[:40]
        uit['sitemaps_bezocht'] = bezocht
    except Exception as e:
        uit['fout'] = f'{type(e).__name__}: {str(e)[:60]}'
        uit['kandidaat_urls'] = []
    return uit


if __name__ == '__main__':
    doel = json.load(open(pad('js-paginas.json')))
    t0 = time.time(); alles = []
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for i, r in enumerate(pool.map(werk, doel), 1):
            alles.append(r)
            if i % 30 == 0: print(f'  {i}/{len(doel)}  {time.time()-t0:.0f}s', flush=True)
    json.dump(alles, open(pad('sitemap-urls.json'), 'w'), ensure_ascii=False, indent=1)
    raak = [r for r in alles if r['kandidaat_urls']]
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'instellingen met kandidaat-URLs : {len(raak)}/{len(alles)}')
    print(f'detailpagina-URLs totaal        : {sum(len(r["kandidaat_urls"]) for r in alles)}')
    for r in raak[:10]:
        print(f"  {len(r['kandidaat_urls']):3}  {r['museum'][:28]:30} {r['kandidaat_urls'][0][:66]}")
