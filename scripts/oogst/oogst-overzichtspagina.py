"""Trechterstap 1, tweede helft: haal elke programmapagina op en extraheer de tentoonstellingen."""
import json, concurrent.futures as cf, time
from werkmap import pad

import extract as ex
import haal
import route


def werk(r):
    uit = {'naam': r['naam'], 'host': r['host'], 'categorie': r['categorie'], 'programma': r['programma']}
    try:
        uit['http'], html, _ = haal.tekst(r['programma'], timeout=20, limiet=1_200_000)
        uit['vondsten'] = ex.extraheer(html)
    except Exception as e:
        uit['fout'] = f'{type(e).__name__}: {str(e)[:80]}'
        uit['vondsten'] = []
        # hier blijkt of een onthouden route nog bestaat; zo niet, zoekt stap 1 opnieuw
        route.vergeet(route.host_van(r['programma']), uit['fout'])
    if uit['vondsten']:
        route.onthoud(route.host_van(r['programma']), stap=1)
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
    route.bewaar()
    raak = [r for r in alles if r['vondsten']]
    totaal = sum(len(r['vondsten']) for r in alles)
    met_start = sum(1 for r in alles for v in r['vondsten'] if v['start'])
    print(f'klaar in {time.time()-t0:.0f}s | {haal.samenvatting()}')
    print(f'instellingen met minstens een vondst : {len(raak)}/{len(alles)}')
    print(f'tentoonstellingen totaal             : {totaal}')
    print(f'   waarvan met begin en eind         : {met_start}')
    print(f'   alleen einddatum                  : {totaal-met_start}')
    import collections
    print('methode:', dict(collections.Counter(v['methode'] for r in alles for v in r['vondsten'])))
    print('fouten :', dict(collections.Counter(r['fout'].split(':')[0] for r in alles if 'fout' in r)))
