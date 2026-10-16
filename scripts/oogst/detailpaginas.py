"""Stap 14: haal elke gevonden detailpagina op en lees titel, looptijd en inleiding."""
import json, re, html, urllib.request, ssl, concurrent.futures as cf, time
from werkmap import pad, arg

import extract as ex
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE


def werk(taak):
    inst, url = taak
    # de locatievelden komen van de instelling en worden alleen doorgegeven; ontbreekt er
    # een, dan gaat deze pagina door en valt de ronde niet om
    r = {'instelling': inst.get('museum'), 'url': url}
    r.update({k: inst.get(k) for k in ('museum_id', 'city', 'province', 'adres', 'lat', 'lon', 'precisie')})
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'nl'})
        with urllib.request.urlopen(req, timeout=18, context=ctx) as resp:
            h = resp.read(700_000).decode('utf-8', 'replace')
        k = re.findall(r'<h1[^>]*>(.*?)</h1>', h, re.S | re.I)
        r['h1'] = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', k[0]))).strip()[:110] if k else ''
        v = ex.extraheer(h)
        r['vondsten'] = [{'start': x['start'], 'eind': x['eind'], 'titel': x['titel'][:70]} for x in v[:3]]
        t = re.sub(r'<script.*?</script>|<style.*?</style>', '', h, flags=re.S | re.I)
        for m in re.finditer(r'<p\b[^>]*>(.*?)</p>', t, re.S | re.I):
            p = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1)))).strip()
            if len(p) > 90 and not re.search(r'cookie|nieuwsbrief|privacy|openingstijden', p, re.I):
                r['alinea'] = p[:600]; break
    except Exception as e:
        r['fout'] = f'{type(e).__name__}: {str(e)[:50]}'
        r['vondsten'] = []
    return r


if __name__ == '__main__':
    bron = json.load(open(arg(1, 'sitemap-urls.json')))
    taken = [(i, u) for i in bron for u in i['kandidaat_urls']]
    print('op te halen:', len(taken))
    t0 = time.time(); uit = []
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        for n, r in enumerate(pool.map(werk, taken), 1):
            uit.append(r)
            if n % 150 == 0: print(f'  {n}/{len(taken)}  {time.time()-t0:.0f}s', flush=True)
    json.dump(uit, open(arg(2, 'sitemap-details.json'), 'w'), ensure_ascii=False, indent=1)
    met = [r for r in uit if r['vondsten']]
    volledig = [r for r in met if r['vondsten'][0]['start']]
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'pagina\'s met een looptijd      : {len(met)}/{len(uit)}')
    print(f'   waarvan met begin en eind   : {len(volledig)}')
    import collections
    print('per instelling:', dict(collections.Counter(r['instelling'] for r in volledig).most_common(12)))
