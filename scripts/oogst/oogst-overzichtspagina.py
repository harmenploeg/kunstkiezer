"""Stap 3: haal elke programmapagina op en extraheer de tentoonstellingen."""
import json, urllib.request, ssl, concurrent.futures as cf, time
from werkmap import pad

import extract as ex

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE


def werk(r):
    uit = {'naam': r['naam'], 'host': r['host'], 'categorie': r['categorie'], 'programma': r['programma']}
    try:
        req = urllib.request.Request(r['programma'], headers={'User-Agent': UA, 'Accept-Language': 'nl,en;q=0.8'})
        with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
            uit['http'] = resp.status
            html = resp.read(1_200_000).decode('utf-8', 'replace')
        uit['vondsten'] = ex.extraheer(html)
    except Exception as e:
        uit['fout'] = f'{type(e).__name__}: {str(e)[:80]}'
        uit['vondsten'] = []
    return uit


if __name__ == '__main__':
    bronnen = [r for r in json.load(open(pad('programmapaginas.json'))) if r.get('programma')]
    t0 = time.time(); alles = []
    with cf.ThreadPoolExecutor(max_workers=10) as pool:
        for i, r in enumerate(pool.map(werk, bronnen), 1):
            alles.append(r)
            if i % 60 == 0:
                print(f'  {i}/{len(bronnen)}  {time.time()-t0:.0f}s', flush=True)
    json.dump(alles, open(pad('oogst.json'), 'w'), ensure_ascii=False, indent=1)
    raak = [r for r in alles if r['vondsten']]
    totaal = sum(len(r['vondsten']) for r in alles)
    met_start = sum(1 for r in alles for v in r['vondsten'] if v['start'])
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'instellingen met minstens een vondst : {len(raak)}/{len(alles)}')
    print(f'tentoonstellingen totaal             : {totaal}')
    print(f'   waarvan met begin en eind         : {met_start}')
    print(f'   alleen einddatum                  : {totaal-met_start}')
    import collections
    print('methode:', dict(collections.Counter(v['methode'] for r in alles for v in r['vondsten'])))
    print('fouten :', dict(collections.Counter(r['fout'].split(':')[0] for r in alles if 'fout' in r)))
