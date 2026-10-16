"""Stap 18: spoor op welke nieuwsbriefdienst een instelling gebruikt en of het archief openbaar is.

Een openbaar campagnearchief is goud: dan lees je de nieuwsbrieven zonder je ergens voor
aan te melden. Een aanmeldformulier is alleen een aanwijzing; aanmelden blijft een keuze
van de beheerder, met zijn eigen adres.
"""
import json, re, urllib.request, urllib.parse, ssl, concurrent.futures as cf, time, html
from werkmap import pad

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE

DIENST = [
 ('mailchimp', r'list-manage\.com|mailchi\.mp|chimpstatic|campaign-archive'),
 ('laposta', r'laposta\.nl|laposta\.io'),
 ('spotler', r'spotler|mailplus|maildirect'),
 ('brevo', r'sendinblue|brevo\.com'),
 ('activecampaign', r'activehosted|activecampaign'),
 ('mailerlite', r'mailerlite'),
 ('ymlp', r'ymlp\.com'),
 ('flexmail', r'flexmail'),
 ('enormail', r'enormail'),
 ('klaviyo', r'klaviyo'),
 ('hubspot', r'hs-scripts|hubspot'),
 ('eigen formulier', r'name=["\'][^"\']*(?:email|e-mail)[^"\']*["\'][^>]*>[\s\S]{0,400}?nieuwsbrief|nieuwsbrief[\s\S]{0,400}?type=["\']email'),
]
ARCHIEF = re.compile(r'https?://[^"\'\s]*(?:campaign-archive\.com|us\d+\.campaign-archive|mailchi\.mp/[^"\'\s]+|'
                     r'laposta\.nl/archief|archief[^"\'\s]*nieuwsbrief)[^"\'\s]*', re.I)
PERS = re.compile(r'href=["\']([^"\']*(?:/pers|/press|/newsroom|/nieuws|/news)[^"\']*)["\']', re.I)


def werk(t):
    uit = {'naam': t['name'], 'host': t['host'], 'url': t['website_url']}
    try:
        req = urllib.request.Request(t['website_url'], headers={'User-Agent': UA, 'Accept-Language': 'nl'})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            basis = r.url
            h = r.read(900_000).decode('utf-8', 'replace')
        uit['diensten'] = sorted({n for n, p in DIENST if re.search(p, h, re.I)})
        uit['archieven'] = sorted(set(html.unescape(m) for m in ARCHIEF.findall(h)))[:3]
        pers, zien = [], set()
        for m in PERS.finditer(h):
            u = urllib.parse.urljoin(basis, html.unescape(m.group(1)))
            p = urllib.parse.urlparse(u)
            if p.netloc != urllib.parse.urlparse(basis).netloc: continue
            s = p.scheme + '://' + p.netloc + p.path.rstrip('/')
            if s in zien: continue
            zien.add(s); pers.append(s)
        uit['pers'] = pers[:4]
    except Exception as e:
        uit['fout'] = f'{type(e).__name__}: {str(e)[:50]}'
    return uit


if __name__ == '__main__':
    doel = json.load(open(pad('instellingen.json')))
    t0 = time.time(); alles = []
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        for i, r in enumerate(pool.map(werk, doel), 1):
            alles.append(r)
            if i % 80 == 0: print(f'  {i}/{len(doel)}  {time.time()-t0:.0f}s', flush=True)
    json.dump(alles, open(pad('nieuwsbrieven.json'), 'w'), ensure_ascii=False, indent=1)
    import collections
    c = collections.Counter(d for r in alles for d in r.get('diensten', []))
    print(f'\nklaar in {time.time()-t0:.0f}s over {len(alles)} instellingen')
    print('nieuwsbriefdienst herkend bij :', sum(1 for r in alles if r.get('diensten')))
    print('openbaar archief gevonden bij :', sum(1 for r in alles if r.get('archieven')))
    print('pers-/nieuwspagina gevonden   :', sum(1 for r in alles if r.get('pers')))
    print('\nverdeling diensten:')
    for k, v in c.most_common(): print(f'   {k:18} {v}')
    print('\narchieven:')
    for r in alles:
        for a in r.get('archieven', []): print(f"   {r['naam'][:30]:32} {a[:80]}")
