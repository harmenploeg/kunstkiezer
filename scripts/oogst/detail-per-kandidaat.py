"""Stap 22: zoek voor elke openstaande kandidaat de eigen detailpagina en lees daar de looptijd."""
import json, re, urllib.request, urllib.parse, ssl, unicodedata, difflib, html
import concurrent.futures as cf, time
from werkmap import pad

import extract as ex
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return ' '.join(re.sub(r'[^a-z0-9 ]', ' ', s).split())


def haal(u, t=18):
    req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept-Language': 'nl,en;q=0.8'})
    with urllib.request.urlopen(req, timeout=t, context=ctx) as r:
        return r.read(900_000).decode('utf-8', 'replace'), r.url


def kies_link(h, basis, titel):
    doel = norm(titel); beste = (0.0, None)
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', h, re.S | re.I):
        href, tekst = m.group(1), html.unescape(re.sub(r'<[^>]+>', ' ', m.group(2)))
        t = norm(tekst)
        u = urllib.parse.urljoin(basis, html.unescape(href))
        slug = norm(urllib.parse.unquote(urllib.parse.urlparse(u).path).replace('-', ' ').replace('/', ' '))
        sc = max(difflib.SequenceMatcher(None, doel, t).ratio(),
                 difflib.SequenceMatcher(None, doel, slug).ratio())
        if doel and t and (doel in t or t in doel) and min(len(doel), len(t)) > 8: sc = max(sc, .92)
        if doel and len(doel) > 8 and doel in slug: sc = max(sc, .92)
        if sc > beste[0]: beste = (sc, u)
    return beste


def werk(r):
    uit = dict(r); uit['detail'] = None
    try:
        h, basis = haal(r['bron'])
        sc, u = kies_link(h, basis, r['titel'])
        if not u or sc < 0.5:
            uit['detailfout'] = f'geen link (score {sc:.2f})'
            return uit
        uit['detail'] = u; uit['linkscore'] = round(sc, 2)
        h2, _ = haal(u)
        k = re.findall(r'<h1[^>]*>(.*?)</h1>', h2, re.S | re.I)
        uit['h1'] = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', k[0]))).strip()[:110] if k else ''
        uit['detaildatums'] = [{'start': v['start'], 'eind': v['eind']} for v in ex.extraheer(h2)[:3]]
        t = re.sub(r'<script.*?</script>|<style.*?</style>', '', h2, flags=re.S | re.I)
        for m in re.finditer(r'<p\b[^>]*>(.*?)</p>', t, re.S | re.I):
            p = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1)))).strip()
            if len(p) > 90 and not re.search(r'cookie|nieuwsbrief|privacy|openingstijden|Friday Night', p, re.I):
                uit['alinea'] = p[:600]; break
    except Exception as e:
        uit['detailfout'] = f'{type(e).__name__}: {str(e)[:50]}'
    return uit


if __name__ == '__main__':
    doel = json.load(open(pad('restlijst.json')))
    print('kandidaten:', len(doel))
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        uit = list(pool.map(werk, doel))
    json.dump(uit, open(pad('rest-detail.json'), 'w'), ensure_ascii=False, indent=1)
    met = [r for r in uit if r.get('alinea')]
    bev = [r for r in uit if any(d['start'] == r['start'] and d['eind'] == r['eind'] for d in r.get('detaildatums') or [])]
    print(f'klaar in {time.time()-t0:.0f}s')
    print('detailpagina met tekst :', len(met))
    print('datums bevestigd       :', len(bev))
