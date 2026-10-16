"""Stap 17: zoek agenda-eindpunten die wel een echte looptijd geven.

Beproefd: de API van de WordPress-plugin The Events Calendar, losse iCal-feeds en de
eigen posttypes die een site via /wp-json/wp/v2/types aankondigt.
"""
import json, re, urllib.request, urllib.parse, ssl, concurrent.futures as cf, time
from werkmap import pad

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
EIGEN = {'post', 'page', 'attachment', 'nav_menu_item', 'wp_block', 'wp_template', 'wp_template_part',
         'wp_global_styles', 'wp_navigation', 'wp_font_family', 'wp_font_face', 'wp_pattern_category'}


def haal(u, t=12):
    req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept': 'application/json, text/calendar, */*'})
    with urllib.request.urlopen(req, timeout=t, context=ctx) as r:
        return r.status, (r.headers.get('content-type') or ''), r.read(500_000).decode('utf-8', 'replace')


def werk(r):
    p = urllib.parse.urlparse(r['programma'])
    basis = f'{p.scheme}://{p.netloc}'
    uit = {'museum': r['museum'], 'basis': basis, 'treffers': []}

    # 1. The Events Calendar
    for u in (basis + '/wp-json/tribe/events/v1/events?per_page=15',
              basis + '/wp-json/wp/v2/tribe_events?per_page=15'):
        try:
            c, s, b = haal(u)
            if c == 200 and b.lstrip().startswith(('{', '[')):
                d = json.loads(b)
                n = len(d.get('events', d) if isinstance(d, dict) else d)
                if n: uit['treffers'].append({'soort': 'events-api', 'url': u, 'aantal': n})
        except Exception:
            pass

    # 2. iCal
    for u in (basis + '/events.ics', basis + '/agenda.ics', basis + '/?ical=1',
              basis + '/events/?ical=1', basis + '/agenda/?ical=1'):
        try:
            c, s, b = haal(u)
            if c == 200 and 'BEGIN:VCALENDAR' in b[:400]:
                n = b.count('BEGIN:VEVENT')
                if n: uit['treffers'].append({'soort': 'ical', 'url': u, 'aantal': n})
        except Exception:
            pass

    # 3. eigen posttypes
    try:
        c, s, b = haal(basis + '/wp-json/wp/v2/types')
        if c == 200:
            t = json.loads(b)
            for k, v in t.items():
                if k in EIGEN:
                    continue
                rb = v.get('rest_base') or k
                try:
                    c2, s2, b2 = haal(f'{basis}/wp-json/wp/v2/{rb}?per_page=10')
                    if c2 == 200 and b2.lstrip().startswith('['):
                        d2 = json.loads(b2)
                        if d2: uit['treffers'].append({'soort': 'posttype:' + k, 'url': f'{basis}/wp-json/wp/v2/{rb}', 'aantal': len(d2)})
                except Exception:
                    pass
    except Exception:
        pass
    return uit


if __name__ == '__main__':
    doel = json.load(open(pad('browser-nodig.json')))
    t0 = time.time(); alles = []
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for i, r in enumerate(pool.map(werk, doel), 1):
            alles.append(r)
            if i % 20 == 0: print(f'  {i}/{len(doel)}  {time.time()-t0:.0f}s', flush=True)
    json.dump(alles, open(pad('ical-endpoints.json'), 'w'), ensure_ascii=False, indent=1)
    raak = [r for r in alles if r['treffers']]
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'instellingen met een agenda-eindpunt: {len(raak)}/{len(alles)}')
    for r in raak:
        for t in r['treffers']:
            print(f"  {r['museum'][:28]:30} {t['soort']:18} {t['aantal']:>4}  {t['url'][:62]}")
