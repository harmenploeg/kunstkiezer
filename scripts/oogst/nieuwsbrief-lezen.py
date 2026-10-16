"""Stap 21: lees de volledige tekst van elke nieuwsbrief en haal er tentoonstellingen uit.

Een Mailchimp-campagnepagina begint met een lange taalkiezer die eindigt op "Tiếng Việt";
alles daarvoor is sjabloon. Daarna volgt de echte inhoud, vaak met meerdere
tentoonstellingen en hun looptijd.
"""
import json, re, html, urllib.request, ssl, concurrent.futures as cf, time
from werkmap import pad, arg

import extract as ex
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
ONZICHTBAAR = re.compile(r'[͏​-‍­ ⁠﻿]+')


def schoon(h):
    t = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', h, flags=re.S | re.I)
    t = html.unescape(re.sub(r'<[^>]+>', '\n', t))
    t = ONZICHTBAAR.sub('', t)
    regels = [re.sub(r'\s+', ' ', r).strip() for r in t.split('\n')]
    return [r for r in regels if r]


def werk(taak):
    naam, n = taak
    uit = {'instelling': naam, 'datum': n['datum'], 'onderwerp': n['titel'], 'link': n['link']}
    try:
        req = urllib.request.Request(n['link'], headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
            h = r.read(1_200_000).decode('utf-8', 'replace')
        regels = schoon(h)
        # alles voor de taalkiezer is sjabloon
        for i, r in enumerate(regels):
            if 'Tiếng Việt' in r:
                regels = regels[i + 1:]; break
        uit['tekst'] = ' '.join(regels)[:9000]
        # links naar de eigen site van de instelling
        eigen = re.findall(r'https?://[^"\'\s<>]+', h)
        uit['sitelinks'] = sorted({u.split('?')[0] for u in eigen
                                   if re.search(r'/(tentoonstelling|exposit|exhibition|agenda|activiteit)', u, re.I)
                                   and 'campaign-archive' not in u and 'list-manage' not in u})[:8]
        # datumbereiken uit de platte tekst
        v = []
        for pos, s, e in ex.datumbereiken(uit['tekst']):
            if not s or not e:
                continue
            kop = uit['tekst'][max(0, pos - 110):pos].strip()
            v.append({'start': s, 'eind': e, 'voor': kop[-90:]})
        uit['bereiken'] = v[:12]
    except Exception as err:
        uit['fout'] = f'{type(err).__name__}: {str(err)[:50]}'
    return uit


if __name__ == '__main__':
    feeds = json.load(open(arg(1, 'nieuwsbrief-feeds.json')))
    taken = [(r['naam'], n) for r in feeds for n in r.get('recent', [])]
    print('nieuwsbrieven op te halen:', len(taken))
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        alles = list(pool.map(werk, taken))
    json.dump(alles, open(arg(2, 'brieven.json'), 'w'), ensure_ascii=False, indent=1)
    met = [r for r in alles if r.get('bereiken')]
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'brieven met minstens een looptijd: {len(met)}/{len(alles)}')
    print(f'looptijden totaal: {sum(len(r["bereiken"]) for r in met)}')
