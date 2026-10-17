"""Welke Instagramaccounts voegen nog iets toe, en welke niet meer?

Van de 227 Instagramaccounts in `kk_update_sources` horen er bijna tweehonderd bij een
instelling waarvan we de eigen website al oogsten. Daar is Instagram de slechtste van de
twee bronnen: een bijschrift noemt een titel, de detailpagina noemt de volledige looptijd.
Wat overblijft zijn de accounts zónder zo'n instelling erachter — recensenten,
kunstbloggers, een tijdschrift en een handvol zalen zonder bruikbare site. Dat zijn er
weinig genoeg om ze wekelijks te lezen zonder tegen een snelheidslimiet aan te lopen.

    python3 scripts/oogst/instagram.py            # de telling en de lijst
    python3 scripts/oogst/instagram.py --alles    # ook wie is overgeslagen, met reden

De uitkomst gaat naar `instagram-selectie.json` in de werkmap en wordt elke ronde opnieuw
berekend: krijgt een instelling later een werkende website, dan valt haar account vanzelf
af; verdwijnt die website, dan komt het account vanzelf terug.

De koppeling is bewust streng. Een account geldt alleen als gedekt bij een genormaliseerde
naamtreffer van 0,92 of hoger met een instelling die een `website_url` heeft, en de
gevonden instelling staat in de uitvoer. Zo is per account na te lezen waaróm hij is
overgeslagen, en is een verkeerde koppeling te zien in plaats van stilletjes te gebeuren.
Twijfel je, draai dan `--alles` en kijk de lijst na.
"""
import difflib
import json
import os
import re
import unicodedata
import urllib.request

from werkmap import pad

REST = 'https://qrlfywcqkkzmerglmsbj.supabase.co/rest/v1'
DREMPEL = 0.92


def sleutel():
    uit = os.environ.get('KK_SERVICE_ROLE')
    if uit:
        return uit.strip()
    with open(os.path.expanduser('~/.config/kunstkiezer/service-role'), encoding='utf-8') as f:
        return f.read().strip()


def api(pad_, k, limiet=1000):
    uit, van = [], 0
    while True:
        req = urllib.request.Request(REST + pad_, headers={
            'apikey': k, 'Authorization': 'Bearer ' + k, 'Range': f'{van}-{van + limiet - 1}'})
        with urllib.request.urlopen(req, timeout=40) as r:
            deel = json.load(r)
        uit += deel
        van += limiet
        if len(deel) < limiet:
            return uit


def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return ' '.join(re.sub(r'[^a-z0-9 ]', ' ', s).split())


def instellingsnaam(bronnaam):
    """`Instagram · Anton Pieck Museum (@antonpieckmuseum)` -> `anton pieck museum`."""
    n = re.sub(r'^Instagram\s*[·•]\s*', '', bronnaam)
    n = re.sub(r'\s*\(@[^)]*\)?\s*$', '', n)
    n = re.sub(r'\s*[·|]\s*.*$', '', n)
    return norm(n)


def selectie(k=None):
    k = k or sleutel()
    bronnen = [b for b in api('/kk_update_sources?select=id,name,url,enabled&order=id', k)
               if 'instagram.com' in (b['url'] or '') and b['enabled']]
    musea = api('/kk_museums?select=name,website_url', k)
    ontdek = api('/kk_discoveries?select=name,website_url', k)
    met_site = {}
    for rij in musea + ontdek:
        if rij.get('website_url') and len(norm(rij['name'])) > 3:
            met_site.setdefault(norm(rij['name']), rij['website_url'])
    namen = list(met_site)

    uniek, gedekt = [], []
    for b in bronnen:
        n = instellingsnaam(b['name'])
        treffer = n if n in met_site else None
        if not treffer and n:
            kandidaat = difflib.get_close_matches(n, namen, n=1, cutoff=DREMPEL)
            treffer = kandidaat[0] if kandidaat else None
        rij = {'id': b['id'], 'naam': b['name'], 'url': b['url']}
        if treffer:
            gedekt.append({**rij, 'instelling': treffer, 'website': met_site[treffer],
                           'gelijkenis': round(difflib.SequenceMatcher(None, n, treffer).ratio(), 2)})
        else:
            uniek.append(rij)
    return uniek, gedekt


if __name__ == '__main__':
    import sys
    uniek, gedekt = selectie()
    json.dump({'uniek': uniek, 'gedekt': gedekt, 'drempel': DREMPEL},
              open(pad('instagram-selectie.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'Instagrambronnen (ingeschakeld): {len(uniek) + len(gedekt)}')
    print(f'  wekelijks lezen              : {len(uniek)}')
    print(f'  overgeslagen, eigen website   : {len(gedekt)}')
    print('\nWekelijks lezen:')
    for b in uniek:
        print('  ', re.sub(r'^Instagram\s*[·•]\s*', '', b['naam'])[:64])
    if '--alles' in sys.argv:
        print('\nOvergeslagen, want de eigen website wordt al geoogst:')
        for b in sorted(gedekt, key=lambda x: x['gelijkenis']):
            print(f"   {b['gelijkenis']:.2f}  {re.sub(r'^Instagram\\s*[·•]\\s*', '', b['naam'])[:46]:48} ~ {b['instelling'][:40]}")
    print('\nNoteer in het ronde-verslag dat de overgeslagen accounts niet afzonderlijk op '
          'Instagram zijn gelezen; hun tentoonstellingen komen van hun eigen website.')
