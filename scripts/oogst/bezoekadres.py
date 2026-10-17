"""Bij het publiceren: haal uit een detailpagina de werkelijke bezoeklocatie.

Kunstpunt Groningen is een stedelijke agenda: de presentaties staan elders. Zonder
eigen adres mag een record niet op het adres van de agenda worden gezet.
"""
import json, re, urllib.request, ssl, html as htmllib, concurrent.futures as cf
from werkmap import pad

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
POSTCODE = re.compile(r'\b(\d{4}\s?[A-Z]{2})\b')
STRAAT = re.compile(r'\b([A-ZÀ-Ý][\w\'\-\.]*(?:\s+[a-zA-ZÀ-ÿ\'\-\.]+){0,3}(?:straat|weg|laan|plein|kade|dijk|markt|singel|gracht|pad|hof|steeg|wal|baan|park|hoek|diep|brink|esweg))\s+(\d{1,4}\s?[a-zA-Z]?)\b')
LABEL = re.compile(r'(?:locatie|adres|waar|venue|te zien (?:in|bij)|plaats)\s*[:：]\s*([^.\n]{4,90})', re.I)


def werk(r):
    uit = {'titel': r['titel'], 'detail': r['detail'], 'start': r['start'], 'eind': r['eind'],
           'alinea': r.get('alinea', '')}
    try:
        req = urllib.request.Request(r['detail'], headers={'User-Agent': UA, 'Accept-Language': 'nl'})
        with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
            html = resp.read(900_000).decode('utf-8', 'replace')
        t = re.sub(r'<script.*?</script>|<style.*?</style>', '', html, flags=re.S | re.I)
        t = htmllib.unescape(re.sub(r'<[^>]+>', ' ', t))
        t = re.sub(r'\s+', ' ', t)
        uit['postcodes'] = sorted(set(POSTCODE.findall(t)))[:4]
        uit['straten'] = sorted({f'{a} {b}'.strip() for a, b in STRAAT.findall(t)})[:6]
        uit['labels'] = [m.strip() for m in LABEL.findall(t)][:4]
        # zinnen waarin een plaatsnaam waarschijnlijk staat
        zinnen = [z.strip() for z in re.split(r'(?<=[.!?]) ', t) if re.search(r'\b(in|bij|te)\s+[A-ZÀ-Ý]', z)]
        uit['plaatszinnen'] = [z[:150] for z in zinnen[:3]]
    except Exception as e:
        uit['fout'] = f'{type(e).__name__}: {str(e)[:60]}'
    return uit


if __name__ == '__main__':
    alles = json.load(open(pad('bevestigd-rest.json')))
    kp = [r for r in alles if 'Kunstpunt' in r['museum']]
    with cf.ThreadPoolExecutor(max_workers=6) as pool:
        uit = list(pool.map(werk, kp))
    json.dump(uit, open(pad('kunstpunt-locaties.json'), 'w'), ensure_ascii=False, indent=1)
    for r in uit:
        print(f"\n### {r['titel'][:60]}  ({r['start']} → {r['eind']})")
        if 'fout' in r:
            print('   FOUT:', r['fout']); continue
        print('   postcodes:', r['postcodes'] or '-')
        print('   straten  :', r['straten'] or '-')
        print('   labels   :', r['labels'] or '-')
        for z in r['plaatszinnen']: print('   zin:', z)
