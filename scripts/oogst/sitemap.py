"""Trechterstap 2: zoek detailpagina's van tentoonstellingen via de sitemap van de instelling.

Goedkoper dan een browser: de sitemap staat los van JavaScript en noemt vaak elke
afzonderlijke tentoonstellingspagina.
"""
import json, re, urllib.parse, concurrent.futures as cf, time
from werkmap import pad

import haal as net
import route
TENT = re.compile(r'/(tentoonstelling|tentoonstellingen|exposition|expositie|exposities|exhibition|exhibitions|'
                  r'nu-te-zien|nu_te_zien|te-zien|agenda|programma)/[^/]', re.I)
NIET = re.compile(r'(archief|archive|afgelopen|past|verleden|/page/\d|\?|#)', re.I)
INDEX = r'(post|page|tentoonstelling|exhibition|expositie|agenda)'
# Een sitemap in een andere taal bevat dezelfde tentoonstellingen onder /en/, /de/ ... en
# kost evenveel aanroepen. Het Rembrandthuis noemt in robots.txt zes taalindexen; die aten
# het budget van acht documenten op, zodat tentoonstelling-sitemap.xml nooit werd gelezen.
# Alleen een heel padsegment: anders leest `/de-pont/` als Duits en valt een
# Nederlandse sitemap weg. Te veel ophalen kost een aanroep, te weinig kost dekking.
TAAL = re.compile(r'/(en|fr|de|es|it|pt|pl|ru|tr|zh|ja|uk|da|sv|no|fi)/', re.I)
STERK = re.compile(r'(tentoonstelling|exposition|expositie|exhibition|agenda|programma|nu-te-zien)', re.I)


def eigen_taal(urls):
    """Gooi de anderstalige sitemaps weg, tenzij er dan niets overblijft."""
    nl = [u for u in urls if not TAAL.search(urllib.parse.urlparse(u).path)]
    return nl or urls


def haal(url, timeout=15):
    return net.tekst(url, timeout=timeout, limiet=4_000_000, taal='nl', uitpakken=True)[1]


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
    gezien, schoon = set(), []
    for u in eigen_taal(uit):
        if u not in gezien:
            gezien.add(u); schoon.append(u)
    return schoon[:6]


def doorzoek(wachtrij):
    """Volg de wachtrij; geef de tentoonstellings-URL's, het aantal bezochte documenten
    en elke sitemap die URL's gaf, zodat een volgende ronde daar direct kan beginnen.

    Alle gevende documenten, niet alleen het eerste: bij het Rembrandthuis staan de
    tentoonstellingen over `page-sitemap.xml` en `tentoonstelling-sitemap.xml` verdeeld,
    en één onthouden document zou de volgende ronde stil minder URL's geven."""
    urls, bezocht, gebruikt = set(), 0, []
    while wachtrij and bezocht < 8 and len(urls) < 60:
        s = wachtrij.pop(0); bezocht += 1
        try:
            xml = haal(s)
        except Exception:
            continue
        locs = re.findall(r'<loc>\s*([^<\s]+)\s*</loc>', xml)
        if '<sitemapindex' in xml[:900]:
            kinderen = eigen_taal([l for l in locs if re.search(INDEX, l, re.I)])
            # een tentoonstellingssitemap vóór de post- en pagina-sitemaps: het budget is
            # acht documenten, en hierin staan de looptijden
            wachtrij[:0] = [l for l in kinderen if STERK.search(l)][:8]
            for l in kinderen:
                if not STERK.search(l) and len(wachtrij) < 8:
                    wachtrij.append(l)
            if not kinderen:
                wachtrij.extend(eigen_taal(locs)[:4])
            continue
        treffers = {l for l in locs if TENT.search(l) and not NIET.search(l)}
        if treffers and s not in gebruikt:
            gebruikt.append(s)
        urls |= treffers
    return urls, bezocht, gebruikt


def werk(r):
    p = urllib.parse.urlparse(r['programma'])
    basis = f'{p.scheme}://{p.netloc}'
    host = route.host_van(r['programma'])
    uit = {k: r.get(k) for k in ('museum', 'city', 'province', 'adres', 'lat', 'lon', 'precisie', 'museum_id', 'programma')}
    onthouden = route.van(host).get('sitemaps')
    if isinstance(onthouden, str):
        onthouden = [onthouden]
    try:
        # de sitemaps die vorige ronde de URL's gaven, zijn een of twee documenten; zoeken
        # kost robots.txt plus vier gegokte paden plus het aflopen van de index
        urls, bezocht, gebruikt = doorzoek(list(onthouden) if onthouden else sitemaps_van(basis))
        if onthouden and not urls:
            route.vergeet_veld(host, 'sitemaps', 'gaven geen tentoonstelling-URLs meer')
            urls, extra, gebruikt = doorzoek(sitemaps_van(basis))
            bezocht += extra
        uit['kandidaat_urls'] = sorted(urls)[:40]
        uit['sitemaps_bezocht'] = bezocht
        if gebruikt:
            route.onthoud(host, sitemaps=gebruikt, stap=2)
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
    route.bewaar()
    raak = [r for r in alles if r['kandidaat_urls']]
    print(f'klaar in {time.time()-t0:.0f}s | {net.samenvatting()}')
    print(f'instellingen met kandidaat-URLs : {len(raak)}/{len(alles)}')
    print(f'detailpagina-URLs totaal        : {sum(len(r["kandidaat_urls"]) for r in alles)}')
    for r in raak[:10]:
        print(f"  {len(r['kandidaat_urls']):3}  {r['museum'][:28]:30} {r['kandidaat_urls'][0][:66]}")
