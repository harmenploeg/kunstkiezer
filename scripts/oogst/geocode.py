"""Stap 10: zoek coordinaten bij een adres via Nominatim (OpenStreetMap).

Beleefd gebruik: een eigen User-Agent en hoogstens een verzoek per seconde.
"""
import json, time, urllib.parse, urllib.request
from werkmap import pad

UA = 'Kunstkiezer-redactie/1.0 (eenmalige locatiecontrole; contact via loci-amsterdam.nl)'

def zoek(vraag):
    q = urllib.parse.urlencode({'q': vraag, 'format': 'jsonv2', 'limit': 2,
                                'countrycodes': 'nl', 'addressdetails': 1})
    req = urllib.request.Request('https://nominatim.openstreetmap.org/search?' + q,
                                 headers={'User-Agent': UA, 'Accept-Language': 'nl'})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)

ADRESSEN = [
 ("herman de vries: natural-relations", "Westerhavenstraat 14, Groningen"),
 ("Before it had a name", "Haddingestraat 26, Groningen"),
 ("De Stadsgalerie Groningen brengt: Schilderkunst van formaat in Martiniplaza", "Leonard Springerlaan 2, Groningen"),
 ("Schatten in Drenthe - Museum van papierknipkunst", "Burgemeester G. van Weezelplein 10, Westerbork"),
 ("Hybride Fotografie", "Kijk in 't Jatstraat 36, Groningen"),
 ("Monniken en Langemannen", "De Schuit 11, Zoutkamp"),
 ("Walter's Showcase: Hanneke Woudenberg", "Kijk in 't Jatstraat 10, Groningen"),
 ("Het Witte Vlag Project", "Kerklaan 30, Haren, Groningen"),
 ("Beyond Reality", "Forma Aktua Pinakotheek, Groningen"),
 ("PINK PILLOW", "9711 JP Groningen"),
 ("Otto Krol - Gevels, daken en luchten", "Kunsthandel Peter ter Braak, Groningen"),
]

uit = {}
for titel, adres in ADRESSEN:
    try:
        r = zoek(adres)
        if r:
            a = r[0]
            uit[titel] = {'adres_gevraagd': adres, 'lat': float(a['lat']), 'lon': float(a['lon']),
                          'naam': a.get('display_name', '')[:110], 'type': a.get('type'),
                          'plaats': (a.get('address') or {}).get('city') or (a.get('address') or {}).get('town') or (a.get('address') or {}).get('village'),
                          'provincie': (a.get('address') or {}).get('state'),
                          'huisnummer': (a.get('address') or {}).get('house_number')}
        else:
            uit[titel] = {'adres_gevraagd': adres, 'fout': 'niets gevonden'}
    except Exception as e:
        uit[titel] = {'adres_gevraagd': adres, 'fout': f'{type(e).__name__}: {str(e)[:60]}'}
    time.sleep(1.1)

json.dump(uit, open(pad('kunstpunt-coords.json'), 'w'), ensure_ascii=False, indent=1)
for t, v in uit.items():
    if 'fout' in v:
        print(f"  -- {t[:46]:48} {v['adres_gevraagd'][:36]:38} {v['fout']}")
    else:
        hn = 'huisnr ja' if v['huisnummer'] else 'huisnr NEE'
        print(f"  OK {t[:46]:48} {v['lat']:.5f},{v['lon']:.5f}  {v['plaats']} ({v['provincie']})  {hn}")
