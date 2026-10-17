"""Instagram via de Graph API: bijschriften lezen zonder browserrobot.

De anonieme route (profielen openen in een browser) loopt na ongeveer honderd profielen
tegen een snelheidslimiet aan en staat op gespannen voet met de voorwaarden van Meta, dat
geautomatiseerd verzamelen zonder schriftelijke toestemming verbiedt. `business_discovery`
is de weg die Meta er zelf voor heeft: je eigen app vraagt publieke gegevens op van een
ander zakelijk account, met een token dat de beheerder één keer aanmaakt.

    python3 scripts/oogst/instagram-graph.py              # een partij volgens de rotatie
    python3 scripts/oogst/instagram-graph.py 40           # een grotere partij
    python3 scripts/oogst/instagram-graph.py --droogproef # alleen tonen wie aan de beurt is

Zonder token doet het script niets en legt het uit wat de beheerder moet aanmaken; zie
`docs/instagram-bronnen.md`. Het token staat in `~/.config/kunstkiezer/instagram-token`
(of in de omgevingsvariabele `INSTAGRAM_TOKEN`), het eigen account-id in
`~/.config/kunstkiezer/instagram-account` (of `INSTAGRAM_ACCOUNT_ID`). Het token komt niet
in de uitvoer en niet in een bestand in de werkmap terecht.

Twee dingen die de opbrengst bepalen en die je vooraf moet weten:

- `business_discovery` geeft alleen gegevens van zakelijke accounts en creator-accounts.
  Een persoonlijk account levert `error 110`; dat is geen storing, en het is ook geen reden
  om die bron uit te zetten. De browserroute blijft voor die accounts de enige weg.
- Een bijschrift noemt zelden een volledige looptijd. Wat hier uitkomt is een tip: de titel
  en de instelling, waarmee je op de eigen website de looptijd gaat bevestigen. Zonder
  begin- én einddatum mag er niets gepubliceerd worden.
"""
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import extract as ex
from werkmap import pad

API = 'https://graph.facebook.com/v21.0'
CONFIG = os.path.expanduser('~/.config/kunstkiezer')
# De rotatie staat buiten de werkmap: een ronde begint met een lege werkmap, maar wie er
# vorige week aan de beurt was moet je dan nog weten.
ROTATIE = os.path.join(CONFIG, 'instagram-rotatie.json')
VENSTER_DAGEN = 28
PARTIJ = 25

UITLEG = """Geen Instagram-token gevonden, dus deze stap is overgeslagen.

Wat de beheerder één keer moet doen (alles bij Meta zelf, niet hier):
 1. Zorg dat zijn eigen Instagram-account een zakelijk account of creator-account is en
    gekoppeld is aan een Facebook-pagina.
 2. Maak op developers.facebook.com een app van het type Business en voeg het product
    Instagram Graph API toe.
 3. Haal in de Graph API Explorer een token op met de rechten instagram_basic en
    pages_show_list, en wissel dat in voor een langlopend token (60 dagen).
 4. Zoek het id van het eigen Instagram-account op (het veld instagram_business_account
    bij de gekoppelde pagina).
 5. Zet beide neer, met rechten 600:
       ~/.config/kunstkiezer/instagram-token     het langlopende token
       ~/.config/kunstkiezer/instagram-account   het eigen account-id

Daarna leest dit script de accounts uit kk_update_sources en hoeft er geen browser meer aan
te pas te komen. Het token verloopt; vernieuw het voordat het afloopt, anders slaat deze
stap zichzelf weer over."""


def geheim(bestand, omgeving):
    uit = os.environ.get(omgeving)
    if uit:
        return uit.strip()
    try:
        with open(os.path.join(CONFIG, bestand), encoding='utf-8') as f:
            return f.read().strip()
    except OSError:
        return ''


def bronnen():
    """De ingeschakelde Instagramaccounts uit kk_update_sources."""
    sleutel = geheim('service-role', 'KK_SERVICE_ROLE')
    if not sleutel:
        raise SystemExit('Geen secret key in ~/.config/kunstkiezer/service-role; zonder die '
                         'sleutel is de bronnenlijst niet te lezen.')
    u = ('https://qrlfywcqkkzmerglmsbj.supabase.co/rest/v1/kk_update_sources'
         '?select=id,name,url,enabled&order=id')
    req = urllib.request.Request(u, headers={'apikey': sleutel, 'Authorization': 'Bearer ' + sleutel})
    with urllib.request.urlopen(req, timeout=30) as r:
        rijen = json.load(r)
    uit = []
    for rij in rijen:
        if not rij['enabled']:
            continue
        m = re.search(r'instagram\.com/([A-Za-z0-9_.]+)', rij.get('url') or '')
        if m:
            uit.append({'id': rij['id'], 'naam': rij['name'], 'account': m.group(1)})
    return uit


def volgorde(accounts):
    """Wie het langst niet is gelezen, gaat voor."""
    try:
        with open(ROTATIE, encoding='utf-8') as f:
            gezien = json.load(f)
    except (OSError, ValueError):
        gezien = {}
    return sorted(accounts, key=lambda a: gezien.get(a['account'], '')), gezien


def bewaar_rotatie(gezien):
    os.makedirs(CONFIG, exist_ok=True)
    with open(ROTATIE, 'w', encoding='utf-8') as f:
        json.dump(gezien, f, ensure_ascii=False, indent=1, sort_keys=True)
    os.chmod(ROTATIE, 0o600)


def bevraag(eigen_id, token, account, aantal=12):
    velden = (f'business_discovery.username({account})'
              '{username,followers_count,media.limit(%d){caption,permalink,timestamp}}' % aantal)
    u = f'{API}/{eigen_id}?' + urllib.parse.urlencode({'fields': velden, 'access_token': token})
    try:
        with urllib.request.urlopen(urllib.request.Request(u), timeout=30) as r:
            return json.load(r).get('business_discovery') or {}, ''
    except urllib.error.HTTPError as e:
        try:
            fout = json.load(e).get('error', {})
        except Exception:
            fout = {}
        code = fout.get('code')
        boodschap = fout.get('message', '')[:120]
        if code == 110:
            return {}, 'geen zakelijk account; alleen via de browserroute te lezen'
        if code in (4, 17, 32, 613):
            return {}, 'SNELHEIDSLIMIET: ' + boodschap
        if code == 190:
            return {}, 'TOKEN: ' + boodschap
        return {}, f'{code}: {boodschap}'
    except Exception as e:  # netwerkfout
        return {}, f'{type(e).__name__}: {str(e)[:70]}'


TITEL = re.compile(r'[“"‘\']([^”"’\']{3,70})[”"’\']')


def kandidaten(media, vanaf):
    """Bijschriften met een datum of een titel tussen aanhalingstekens, binnen het venster."""
    uit = []
    for m in media or []:
        stempel = (m.get('timestamp') or '')[:10]
        if stempel and stempel < vanaf:
            continue
        tekst = re.sub(r'\s+', ' ', m.get('caption') or '')
        if not tekst:
            continue
        bereiken = [(a, b) for _, a, b in ex.datumbereiken(tekst)]
        titels = TITEL.findall(tekst)
        if not bereiken and not titels:
            continue
        uit.append({'datum': stempel, 'permalink': m.get('permalink'),
                    'bereiken': bereiken[:2], 'titels': titels[:3], 'tekst': tekst[:400]})
    return uit


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    droog = '--droogproef' in sys.argv
    partij = int(args[0]) if args else PARTIJ

    token = geheim('instagram-token', 'INSTAGRAM_TOKEN')
    eigen = geheim('instagram-account', 'INSTAGRAM_ACCOUNT_ID')
    accounts = bronnen()
    aan_de_beurt, gezien = volgorde(accounts)
    aan_de_beurt = aan_de_beurt[:partij]
    print(f'Instagramaccounts in de bronnenpool: {len(accounts)} | deze partij: {len(aan_de_beurt)}')

    if droog or not (token and eigen):
        for a in aan_de_beurt:
            print(f"  {a['account'][:34]:36} laatst gelezen: {gezien.get(a['account'], 'nooit')}")
        if not (token and eigen):
            print('\n' + UITLEG)
        raise SystemExit(0)

    vanaf = (datetime.date.today() - datetime.timedelta(days=VENSTER_DAGEN)).isoformat()
    oogst, fouten, nu = [], [], datetime.datetime.now(datetime.timezone.utc).isoformat()
    for a in aan_de_beurt:
        gegevens, fout = bevraag(eigen, token, a['account'])
        if fout:
            fouten.append({**a, 'fout': fout})
            print(f"  {a['account'][:30]:32} — {fout}")
            if fout.startswith('SNELHEIDSLIMIET') or fout.startswith('TOKEN'):
                print('  Gestopt: de rest van de partij blijft voor de volgende ronde staan.')
                break
            continue
        gevonden = kandidaten(gegevens.get('media', {}).get('data'), vanaf)
        gezien[a['account']] = nu
        oogst.append({**a, 'volgers': gegevens.get('followers_count'), 'kandidaten': gevonden})
        print(f"  {a['account'][:30]:32} {len(gevonden)} bericht(en) met een titel of datum")
        time.sleep(0.6)

    bewaar_rotatie(gezien)
    json.dump({'oogst': oogst, 'fouten': fouten, 'venster_vanaf': vanaf},
              open(pad('instagram-graph.json'), 'w'), ensure_ascii=False, indent=1)
    met = [o for o in oogst if o['kandidaten']]
    print(f"\ngelezen: {len(oogst)} | met kandidaten: {len(met)} | niet gelukt: {len(fouten)}")
    print('Elke kandidaat is een tip: bevestig titel en volledige looptijd op de eigen '
          'website van de instelling voordat je iets publiceert.')
