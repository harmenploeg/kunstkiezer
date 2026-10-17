"""Na de trechter: scheid nieuwe vondsten van wat al in de catalogus staat."""
import json, re, unicodedata, datetime, difflib
from werkmap import pad

def norm(s):
    s = unicodedata.normalize('NFKD', (s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'\b(de|het|een|the|a|an)\b', ' ', s)
    return re.sub(r'[^a-z0-9 ]', ' ', s).strip()

def kern(s):
    return ' '.join(norm(s).split())

cat = json.load(open(pad('catalogus.json')))
bekend = [(kern(r['name']), r) for r in cat]

oogst = json.load(open(pad('oogst.json')))
vandaag = datetime.date.today(); grens = vandaag + datetime.timedelta(days=31)

nieuw, al_bekend = [], 0
for inst in oogst:
    for v in inst['vondsten']:
        k = kern(v['titel'])
        if len(k) < 4:
            continue
        beste, score = None, 0.0
        for bk, br in bekend:
            bevat = bool(k and bk) and (k in bk or bk in k) and min(len(k), len(bk)) > 8
            m = difflib.SequenceMatcher(None, k, bk)
            if not bevat and (m.real_quick_ratio() <= score or m.quick_ratio() <= score):
                continue  # bovengrenzen van difflib: deze titel kan de beste niet verslaan
            r = max(m.ratio(), 0.9) if bevat else m.ratio()
            if r > score:
                beste, score = br, r
        rij = {'instelling': inst['naam'], 'categorie': inst['categorie'], 'titel': v['titel'],
               'start': v['start'], 'eind': v['eind'], 'bron': inst['programma'], 'methode': v['methode'],
               'gelijkenis': round(score, 2), 'lijkt_op': beste['name'] if beste else None}
        if score >= 0.82:
            al_bekend += 1
            continue
        try:
            e = datetime.date.fromisoformat(v['eind'])
        except ValueError:
            continue
        s = datetime.date.fromisoformat(v['start']) if v['start'] else None
        rij['in_agendavenster'] = e >= vandaag and (s is None or s <= grens)
        nieuw.append(rij)

# ontdubbel binnen de oogst zelf
gezien, uniek = set(), []
for r in sorted(nieuw, key=lambda x: (x['start'] is None, x['titel'].lower())):
    sl = (kern(r['titel']), r['eind'])
    if sl in gezien:
        continue
    gezien.add(sl); uniek.append(r)

json.dump(uniek, open(pad('kandidaten.json'), 'w'), ensure_ascii=False, indent=1)
venster = [r for r in uniek if r['in_agendavenster']]
compleet = [r for r in venster if r['start']]
print(f'vondsten totaal          : {sum(len(i["vondsten"]) for i in oogst)}')
print(f'al in de catalogus       : {al_bekend}')
print(f'nieuw na ontdubbelen     : {len(uniek)}')
print(f'   binnen agendavenster  : {len(venster)}')
print(f'   met begin en eind     : {len(compleet)}')
import collections
print('per categorie van de instelling:', dict(collections.Counter(r['categorie'] for r in venster)))
print('\n--- twintig kandidaten met volledige looptijd ---')
for r in compleet[:20]:
    print(f"  {r['start']} → {r['eind']}  {r['titel'][:46]:48} {r['instelling'][:30]}")
