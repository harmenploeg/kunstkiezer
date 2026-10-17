"""Wanneer twee titels dezelfde tentoonstelling zijn.

Eén plek, omdat twee plekken uit elkaar lopen: `ontdubbel.py` beslist hiermee wat al in
de catalogus staat en `maak-lijsten.py` bouwt hiermee de restlijst. Zouden die elk hun
eigen vergelijking hebben, dan zou een kandidaat in de ene stap een duplicaat zijn en in
de andere niet.
"""
import difflib
import re
import unicodedata

DREMPEL = 0.82  # hierboven is het hetzelfde record; gemeten op de rondes van oktober 2026


def norm(s):
    """Kleine letters, geen diakritieken, geen lidwoorden, geen interpunctie."""
    s = unicodedata.normalize('NFKD', (s or '').lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r'\b(de|het|een|the|a|an)\b', ' ', s)
    return re.sub(r'[^a-z0-9 ]', ' ', s).strip()


def kern(s):
    """De vergelijkbare kern van een titel."""
    return ' '.join(norm(s).split())


def beste_treffer(k, bekend):
    """(record, gelijkenis) van de bekende titel die het meest op kern `k` lijkt.

    `bekend` is een lijst van (kern, record). Staat de ene titel heel in de andere, dan
    is dat 0,9 waard: "Angkor" in "Angkor — Het mysterie van Cambodja" is hetzelfde
    record, terwijl de letterverhouding dat niet laat zien.

    De bovengrenzen van difflib (`real_quick_ratio`, `quick_ratio`) slaan vergelijkingen
    over die de beste niet meer kunnen verslaan. Dat verandert de uitkomst niet, want het
    zijn bovengrenzen van `ratio()` en een gelijke score verdringt de beste niet.
    """
    beste, score = None, 0.0
    for bk, br in bekend:
        bevat = bool(k and bk) and (k in bk or bk in k) and min(len(k), len(bk)) > 8
        m = difflib.SequenceMatcher(None, k, bk)
        if not bevat and (m.real_quick_ratio() <= score or m.quick_ratio() <= score):
            continue
        r = max(m.ratio(), 0.9) if bevat else m.ratio()
        if r > score:
            beste, score = br, r
    return beste, score
