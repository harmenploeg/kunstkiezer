"""Nieuwsbrieven, stap 3 van 4: lees de nieuwsbrieven van een instelling via de RSS van haar
Mailchimp-archief.

Mailchimp biedt elk openbaar campagnearchief ook als feed aan:
https://<dc>.campaign-archive.com/feed?u=<u>&id=<id>
Daarin staan titel, datum en de volledige inhoud van elke verzonden nieuwsbrief.
Geen aanmelding nodig: de instelling publiceert dit archief zelf.
"""
import json, re, urllib.request, ssl, email.utils as eu, datetime, html
import xml.etree.ElementTree as ET, concurrent.futures as cf, time
from werkmap import pad

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE


def plat(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def werk(r):
    uit = {'naam': r['naam'], 'feed': f"https://{r['dc']}.campaign-archive.com/feed?u={r['u']}&id={r['id']}"}
    try:
        req = urllib.request.Request(uit['feed'], headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=20, context=ctx) as x:
            ruw = x.read(25_000_000).decode('utf-8', 'replace')
        ch = ET.fromstring(ruw).find('channel')
        items = ch.findall('item')
        grens = datetime.datetime.now() - datetime.timedelta(days=120)
        nieuw = []
        for it in items:
            pd = it.findtext('pubDate')
            try:
                d = datetime.datetime(*eu.parsedate(pd)[:6]) if pd else None
            except Exception:
                d = None
            if d and d < grens:
                continue
            inhoud = ''
            for tag in it:
                if tag.tag.endswith('encoded') and tag.text:
                    inhoud = plat(tag.text); break
            nieuw.append({'titel': plat(it.findtext('title'))[:120],
                          'datum': d.date().isoformat() if d else None,
                          'link': it.findtext('link'),
                          'tekst': inhoud[:2500]})
        uit.update({'items_totaal': len(items), 'recent': nieuw[:8]})
    except Exception as e:
        uit['fout'] = f'{type(e).__name__}: {str(e)[:50]}'
    return uit


if __name__ == '__main__':
    bron = [r for r in json.load(open(pad('mailchimp-archieven.json'))) if r.get('u')]
    print('archieven met u/id:', len(bron))
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        alles = list(pool.map(werk, bron))
    json.dump(alles, open(pad('nieuwsbrief-feeds.json'), 'w'), ensure_ascii=False, indent=1)
    goed = [r for r in alles if r.get('items_totaal')]
    print(f'klaar in {time.time()-t0:.0f}s')
    print(f'feeds die werken: {len(goed)}/{len(alles)}')
    print(f'nieuwsbrieven van de laatste 120 dagen: {sum(len(r["recent"]) for r in goed)}')
    for r in sorted(goed, key=lambda x: -len(x['recent']))[:12]:
        print(f"\n  {r['naam'][:34]:36} {r['items_totaal']:>3} in archief, {len(r['recent'])} recent")
        for n in r['recent'][:3]:
            print(f"      {n['datum']}  {n['titel'][:72]}")
