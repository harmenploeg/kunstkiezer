"""Gereedschap van stap 1 tot 3: haal tentoonstellingen met looptijd uit een programmapagina.

Eerst gestructureerde data (JSON-LD Event). Lukt dat niet, dan datumbereiken in
de tekst, gekoppeld aan de dichtstbijzijnde kop erboven. De tekst wordt in een
keer opgebouwd met samengevouwen witruimte, zodat opmaak binnen een getal
("3<span>0</span>.10") geen spaties in de datum achterlaat.
"""
import re, json, datetime, html as htmllib

MAAND = {}
for _i, (_nl, _en) in enumerate([
        ('januari', 'january'), ('februari', 'february'), ('maart', 'march'),
        ('april', 'april'), ('mei', 'may'), ('juni', 'june'), ('juli', 'july'),
        ('augustus', 'august'), ('september', 'september'), ('oktober', 'october'),
        ('november', 'november'), ('december', 'december')], 1):
    for _naam in (_nl, _en):
        MAAND[_naam] = _i
        MAAND[_naam[:3]] = _i
MAAND['mrt'] = 3
MAAND['okt'] = 10
MAAND['sept'] = 9

SCHEIDING = r'(?:t/m|tot en met|tot|tm|until|through|–|—|-|/)'
MND = r'(' + '|'.join(sorted(MAAND, key=len, reverse=True)) + r')'

P_ISO = re.compile(r'\b(\d{4})-(\d{2})-(\d{2})\s*' + SCHEIDING + r'\s*(\d{4})-(\d{2})-(\d{2})\b')
P_DAG1 = re.compile(r'\b(\d{1,2})\s+' + MND + r'\.?\s*(\d{4})?\s*' + SCHEIDING + r'\s*(\d{1,2})\s+' + MND + r'\.?\s*(\d{4})', re.I)
P_MND1 = re.compile(r'\b' + MND + r'\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?\s*' + SCHEIDING + r'\s*' + MND + r'\.?\s+(\d{1,2}),?\s*(\d{4})', re.I)
P_NUM = re.compile(r'\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\s*' + SCHEIDING + r'\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b')
P_EIND = re.compile(r'\b(?:t/m|tot en met|until|through)\s+(\d{1,2})\s+' + MND + r'\.?\s*(\d{4})', re.I)
# begin en eind zonder scheidingsteken, zoals "20 sep 2026 28 feb 2027" op een kaart.
# Beide jaartallen zijn verplicht, anders worden losse datums aan elkaar geplakt.
P_NAAST = re.compile(r'\b(\d{1,2})\s+' + MND + r'\.?\s*(20\d\d)\s+(\d{1,2})\s+' + MND + r'\.?\s*(20\d\d)\b', re.I)
P_EIND2 = re.compile(r'\b(?:t/m|tot en met|until|through)\s+(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b')


def _jaar(j):
    j = int(j)
    return j + 2000 if j < 100 else j


def _datum(j, m, d):
    try:
        return datetime.date(_jaar(j), int(m), int(d)).isoformat()
    except (ValueError, TypeError):
        return None


def datumbereiken(tekst):
    """Geeft (positie, begin, eind) terug; begin mag None zijn."""
    uit = []
    for m in P_ISO.finditer(tekst):
        a = _datum(m.group(1), m.group(2), m.group(3))
        b = _datum(m.group(4), m.group(5), m.group(6))
        if a and b:
            uit.append((m.start(), a, b))
    for m in P_DAG1.finditer(tekst):
        d1, m1, j1, d2, m2, j2 = m.groups()
        mm1, mm2 = MAAND.get(m1.lower()), MAAND.get(m2.lower())
        if mm1 and mm2:
            a, b = _datum(j1 or j2, mm1, d1), _datum(j2, mm2, d2)
            if a and b:
                uit.append((m.start(), a, b))
    for m in P_MND1.finditer(tekst):
        m1, d1, j1, m2, d2, j2 = m.groups()
        mm1, mm2 = MAAND.get(m1.lower()), MAAND.get(m2.lower())
        if mm1 and mm2:
            a, b = _datum(j1 or j2, mm1, d1), _datum(j2, mm2, d2)
            if a and b:
                uit.append((m.start(), a, b))
    for m in P_NUM.finditer(tekst):
        d1, m1, j1, d2, m2, j2 = m.groups()
        a, b = _datum(j1, m1, d1), _datum(j2, m2, d2)
        if a and b:
            uit.append((m.start(), a, b))
    for m in P_NAAST.finditer(tekst):
        d1, m1, j1, d2, m2, j2 = m.groups()
        mm1, mm2 = MAAND.get(m1.lower()), MAAND.get(m2.lower())
        if mm1 and mm2:
            a, b = _datum(j1, mm1, d1), _datum(j2, mm2, d2)
            if a and b:
                uit.append((m.start(), a, b))
    for m in P_EIND.finditer(tekst):
        mm = MAAND.get(m.group(2).lower())
        b = _datum(m.group(3), mm, m.group(1)) if mm else None
        if b:
            uit.append((m.start(), None, b))
    for m in P_EIND2.finditer(tekst):
        b = _datum(m.group(3), m.group(2), m.group(1))
        if b:
            uit.append((m.start(), None, b))
    return sorted(uit)


def uit_jsonld(html):
    uit = []
    for blok in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, re.S | re.I):
        try:
            data = json.loads(blok.strip())
        except Exception:
            continue
        stapel = [data]
        while stapel:
            o = stapel.pop()
            if isinstance(o, list):
                stapel.extend(o)
                continue
            if not isinstance(o, dict):
                continue
            stapel.extend(v for v in o.values() if isinstance(v, (list, dict)))
            t = o.get('@type')
            t = t if isinstance(t, str) else (t[0] if isinstance(t, list) and t else '')
            if 'Event' in str(t) and o.get('name'):
                s = str(o.get('startDate') or '')[:10]
                e = str(o.get('endDate') or '')[:10]
                if re.fullmatch(r'\d{4}-\d{2}-\d{2}', e or ''):
                    uit.append({'titel': str(o['name'])[:160].strip(),
                                'start': s if re.fullmatch(r'\d{4}-\d{2}-\d{2}', s) else None,
                                'eind': e, 'methode': 'json-ld'})
    return uit


# tags die midden in een woord of getal kunnen staan en dus geen spatie verdienen
INLINE = ('span', 'b', 'i', 'em', 'strong', 'a', 'sup', 'sub', 'small', 'u', 'font', 'mark', 'wbr')
KOP_OPEN = re.compile(r'<(h[1-4])\b[^>]*>', re.I)
KOP_DICHT = re.compile(r'</(h[1-4])\s*>', re.I)


def schone_tekst_met_koppen(html):
    """Platte tekst met samengevouwen witruimte, plus (positie, koptekst)."""
    html = re.sub(r'<script.*?</script>|<style.*?</style>|<!--.*?-->', '', html, flags=re.S | re.I)
    delen, lengte, koppen, open_kop, laatste = [], 0, [], None, 0
    for m in re.finditer(r'<[^>]+>', html):
        stuk = html[laatste:m.start()]
        laatste = m.end()
        if stuk:
            t = re.sub(r'\s+', ' ', htmllib.unescape(stuk))
            if t.strip():
                delen.append(t)
                lengte += len(t)
        tag = m.group(0)
        naam = re.sub(r'[^a-z0-9]', '', tag.lower().split()[0] if tag.lower().split() else tag.lower())
        if KOP_OPEN.match(tag):
            open_kop = lengte
        elif KOP_DICHT.match(tag) and open_kop is not None:
            tekst = ''.join(delen)[open_kop:].strip()
            if 2 < len(tekst) < 160:
                koppen.append((open_kop, re.sub(r'\s+', ' ', tekst)))
            open_kop = None
        if not any(naam == n or naam == '/' + n for n in INLINE):
            delen.append(' ')
            lengte += 1
    rest = html[laatste:]
    if rest.strip():
        delen.append(re.sub(r'\s+', ' ', htmllib.unescape(rest)))
    return ''.join(delen), koppen


DATUMACHTIG = re.compile(r'\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}|\b\d{1,2}\s+' + MND + r'|\b' + MND + r'\s+\d{1,2}|\d{4}-\d{2}-\d{2}', re.I)


VOORVOEGSEL = re.compile(r'^\s*(tijdelijke |wissel|thema|solo|groeps|huidige |lopende |nieuwe )?'
                         r'(tentoonstelling|expositie|exhibition)\s*[:·|-]?\s*', re.I)


def nette_titel(kop):
    """Knipt de looptijd en generieke voorvoegsels uit een kop."""
    kop = htmllib.unescape(htmllib.unescape(kop))
    m = DATUMACHTIG.search(kop)
    if m:
        kop = kop[:m.start()]
    zonder = VOORVOEGSEL.sub('', kop)
    if len(zonder.strip()) >= 4:          # niet strippen als er niets overblijft
        kop = zonder
    return re.sub(r'\s+', ' ', kop).strip(' -–—:·|,')


def uit_tekst(html):
    tekst, koppen = schone_tekst_met_koppen(html)
    uit = []
    for pos, start, eind in datumbereiken(tekst):
        kop = vorige = None
        for p, k in koppen:
            if p < pos:
                vorige, kop = kop, k
            else:
                break
        if not kop:
            continue
        # een losse staart als "- de tentoonstelling" krijgt de kop ervoor mee
        if vorige and (len(kop) < 8 or not kop[0].isalnum()):
            kop = (vorige + ' ' + kop).strip()
        titel = nette_titel(kop)
        # staat er alleen een datum in de kop, pak dan de kop daarboven
        if len(titel) < 3 and vorige:
            titel = nette_titel(vorige)
        if len(titel) < 3:
            continue
        uit.append({'titel': titel, 'start': start, 'eind': eind, 'methode': 'tekst+kop'})
    return uit


def extraheer(html, vandaag=None):
    """Alleen lopende of komende presentaties, ontdubbeld en op geldigheid getoetst."""
    vandaag = vandaag or datetime.date.today()
    rauw = uit_jsonld(html) or uit_tekst(html)
    gezien, net = set(), []
    for r in rauw:
        if not r['eind']:
            continue
        try:
            e = datetime.date.fromisoformat(r['eind'])
        except ValueError:
            continue
        if e < vandaag or e > vandaag + datetime.timedelta(days=900):
            continue
        if r['start']:
            try:
                if datetime.date.fromisoformat(r['start']) > e:
                    r['start'] = None
            except ValueError:
                r['start'] = None
        titel = re.sub(r'\s+', ' ', r['titel']).strip(' -–—:·|')
        if len(titel) < 3:
            continue
        sleutel = (titel.lower(), r['start'], r['eind'])
        if sleutel in gezien:
            continue
        gezien.add(sleutel)
        net.append({**r, 'titel': titel})
    # dezelfde titel met en zonder begindatum: houd de versie mét
    met_start = {r['titel'].lower() for r in net if r['start']}
    net = [r for r in net if r['start'] or r['titel'].lower() not in met_start]
    return net
