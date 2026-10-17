"""Nieuwsbrieven, stap 2 van 4: leid uit een Mailchimp-aanmeldformulier het openbare
campagnearchief af.

Een formulier post naar https://<naam>.us7.list-manage.com/subscribe/post?u=<u>&id=<id>.
Met diezelfde u en id is het archief te benaderen op https://us7.campaign-archive.com/home/.
Staat het archief open, dan zijn de nieuwsbrieven te lezen zonder aanmelding.
"""
import json, re, urllib.request, urllib.parse, ssl, concurrent.futures as cf, time
from werkmap import pad

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
MC = re.compile(r'(?:https?:)?//([a-z0-9.-]*?)\.(us\d+|[a-z]{2}\d+)\.list-manage\.com/subscribe(?:/post)?[^"\'\s<>]*', re.I)
UID = re.compile(r'[?&]u=([0-9a-f]{8,})', re.I)
LID = re.compile(r'[?&]id=([0-9a-f]{6,})', re.I)


def haal(u, t=14):
    req = urllib.request.Request(u, headers={'User-Agent': UA, 'Accept-Language': 'nl'})
    with urllib.request.urlopen(req, timeout=t, context=ctx) as r:
        return r.status, r.read(700_000).decode('utf-8', 'replace')


def werk(r):
    uit = {'naam': r['naam'], 'url': r['url']}
    try:
        c, h = haal(r['url'])
    except Exception as e:
        uit['fout'] = type(e).__name__
        return uit
    h = h.replace('&amp;', '&').replace('\\u0026', '&').replace('\\/', '/')
    m = MC.search(h)
    if not m:
        return uit
    post = m.group(0)
    dc = m.group(2)
    u_, i_ = UID.search(post), LID.search(post)
    if not (u_ and i_):
        return uit
    uit['u'], uit['id'], uit['dc'] = u_.group(1), i_.group(1), dc
    for arch in (f'https://{dc}.campaign-archive.com/home/?u={u_.group(1)}&id={i_.group(1)}',
                 f'https://{dc}.campaign-archive.com/?u={u_.group(1)}&id={i_.group(1)}'):
        try:
            c2, b = haal(arch)
            campagnes = re.findall(r'https?://[a-z0-9.-]*campaign-archive\.com/\?[^"\'\s]*e=[^"\'\s]*|'
                                   r'https?://mailchi\.mp/[^"\'\s]+', b)
            titels = re.findall(r'<a[^>]+class="[^"]*campaign[^"]*"[^>]*>([^<]{4,90})</a>', b)
            if c2 == 200 and ('campaign' in b.lower() or titels):
                uit['archief'] = {'url': arch, 'bytes': len(b), 'links': len(set(campagnes)), 'titels': titels[:6]}
                break
        except Exception:
            pass
    return uit


if __name__ == '__main__':
    bron = json.load(open(pad('nieuwsbrieven.json')))
    doel = [r for r in bron if 'mailchimp' in r.get('diensten', [])]
    print('instellingen met Mailchimp:', len(doel))
    t0 = time.time(); alles = []
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        alles = list(pool.map(werk, doel))
    json.dump(alles, open(pad('mailchimp-archieven.json'), 'w'), ensure_ascii=False, indent=1)
    met_id = [r for r in alles if r.get('u')]
    met_arch = [r for r in alles if r.get('archief')]
    print(f'klaar in {time.time()-t0:.0f}s')
    print('formulier met u/id gevonden :', len(met_id))
    print('archief bereikbaar          :', len(met_arch))
    for r in met_arch:
        a = r['archief']
        print(f"\n  {r['naam'][:34]:36} {a['links']:>3} campagnelinks  {a['url'][:66]}")
        for t in a['titels']: print(f"      {t.strip()[:78]}")
