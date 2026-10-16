"""Stap 5: haal navigatiekoppen en niet-beeldende evenementen uit de kandidaten."""
import json, re, collections
from werkmap import pad

# koppen die geen tentoonstellingsnaam zijn maar paginastructuur
NAVIGATIE = {'aankomend','aankomende','binnenkort','binnenkort te zien','nu te zien','actueel','agenda',
 'programma','tentoonstelling','tentoonstellingen','exhibition','exhibitions','exposities','expositie',
 'huidige','komende','verwacht','archief','upcoming','current','on view','now on view','te zien',
 'kalender','activiteiten','evenementen','nieuws','meer','overzicht','vaste collectie','collectie',
 'openingstijden','bezoek','tickets','home','agenda october','deze week','highlights'}
# woorden die op een ander soort evenement wijzen dan beeldende kunst
# zinnen die een oproep of een plaatsnaam zijn, geen tentoonstellingstitel
OPROEP = re.compile(r'\b(schrijf je in|nieuwsbrief|welkom|word vriend|doneer|steun ons|open atelier|vacature|museumwinkel|plan je bezoek|koop (?:je )?tickets|entree|openingstijden|contact)\b', re.I)
ANDERS = re.compile(r'\b(concert|marktconcert|lezing|workshop|cursus|rondleiding|wandeling|voorstelling|'
                    r'theater|dans|film|filmhuis|muziek|koor|orkest|jubileum|borrel|vergadering|'
                    r'kerstmarkt|markt|veiling|symposium|congres)\b', re.I)

def oordeel(r):
    t = r['titel'].strip()
    kaal = re.sub(r'[^a-z0-9 ]', '', t.lower()).strip()
    if kaal in NAVIGATIE: return 'navigatie'
    if len(kaal) < 4: return 'te kort'
    cijfers = sum(c.isdigit() for c in t)
    if cijfers > len(t) * 0.4: return 'vooral cijfers'
    if re.match(r'^\d{6}\b', t): return 'datumcode'
    if any(w in kaal for w in ('binnenkort','aankomend','nu te zien','agenda ','programma ')): return 'navigatie'
    if OPROEP.search(t): return 'oproep of praktische tekst'
    if ANDERS.search(t): return 'ander soort evenement'
    # een titel die alleen de instelling herhaalt zegt niets
    inst = re.sub(r'[^a-z0-9 ]','',r['instelling'].lower())
    if kaal and (kaal in inst or inst.startswith(kaal)) and len(kaal) > 5: return 'herhaalt de instelling'
    if kaal in ('thematentoonstelling','wisseltentoonstelling','solotentoonstelling','groepstentoonstelling'): return 'navigatie'
    if r['start'] and r['start'] == r['eind']: return 'eendagsevenement'
    return 'houden'

k = json.load(open(pad('kandidaten.json')))
venster = [r for r in k if r['in_agendavenster']]
geoordeeld = [(oordeel(r), r) for r in venster]
tel = collections.Counter(o for o, _ in geoordeeld)
houden = [r for o, r in geoordeeld if o == 'houden']
compleet = [r for r in houden if r['start']]
json.dump(houden, open(pad('kandidaten-schoon.json'), 'w'), ensure_ascii=False, indent=1)

print('in agendavenster     :', len(venster))
for o, n in tel.most_common(): print(f'   {o:24} {n}')
print()
print(f'OVER: {len(houden)} kandidaten, waarvan {len(compleet)} met volledige looptijd')
print('\n--- dertig met volledige looptijd ---')
for r in sorted(compleet, key=lambda x: x['start'])[:30]:
    print(f"  {r['start']} → {r['eind']}  {r['titel'][:44]:46} {r['instelling'][:28]}")
