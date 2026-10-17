"""Trechterstap 1, eerste helft: vind per instelling de pagina met het
tentoonstellingsprogramma.

Leest de homepage en kiest de link die het meest op een agenda- of
tentoonstellingsoverzicht lijkt. Valt terug op een aantal gangbare paden.
"""
import json,re,urllib.parse,concurrent.futures as cf,time
from werkmap import pad

import haal
import route

# hoe sterker het woord, hoe hoger de score
WOORDEN=[('tentoonstelling',10),('tentoonstellingen',10),('exhibition',9),('exhibitions',9),
         ('nu-te-zien',9),('nu te zien',9),('te-zien',7),('agenda',6),('programma',6),
         ('whats-on',6),("what's on",6),('expositie',8),('exposities',8),('activiteiten',4),
         ('kalender',4),('on-view',7),('current',3)]
NEGATIEF=['archief','archive','afgelopen','past','verleden','vacature','nieuwsbrief','shop','winkel','pers']

def ophalen(url,timeout=15):
    return haal.tekst(url,timeout=timeout,limiet=900_000)

def kies(basis,html):
    gevonden={}
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>',html,re.S|re.I):
        href,tekst=m.group(1),re.sub(r'<[^>]+>',' ',m.group(2))
        tekst=re.sub(r'\s+',' ',tekst).strip().lower()
        url=urllib.parse.urljoin(basis,href)
        if urllib.parse.urlparse(url).netloc!=urllib.parse.urlparse(basis).netloc: continue
        hooi=(url.lower()+' '+tekst)
        if any(n in hooi for n in NEGATIEF): continue
        score=max((p for w,p in WOORDEN if w in hooi),default=0)
        if score and score>gevonden.get(url,(0,''))[0]: gevonden[url]=(score,tekst[:60])
    if not gevonden: return None
    url,(score,tekst)=max(gevonden.items(),key=lambda kv:(kv[1][0],-len(kv[0])))
    return {'url':url,'score':score,'linktekst':tekst}

def werk(t):
    r={'naam':t['name'],'host':t['host'],'start':t['website_url'],'categorie':t['category']}
    # Deze keuze is deterministisch: op 16 en 17 oktober 2026 gaf zij bij 264 van de 264
    # instellingen dezelfde URL. Is zij al bekend, dan hoeft de homepage er niet voor op.
    onthouden=route.van(t['host'])
    if onthouden.get('programma'):
        r.update(programma=onthouden['programma'],score=onthouden.get('score',5),
                 linktekst=onthouden.get('linktekst',''),via='onthouden')
        return r
    try:
        code,html,eind=ophalen(t['website_url'])
        r['http']=code
        keuze=kies(eind,html)
        if keuze: r.update(programma=keuze['url'],score=keuze['score'],linktekst=keuze['linktekst'],via='homepage-link')
        else:
            for pad in ('/tentoonstellingen','/exhibitions','/agenda','/nu-te-zien','/programma'):
                probeer=urllib.parse.urljoin(eind,pad)
                try:
                    c,_,e2=ophalen(probeer,10)
                    if c==200: r.update(programma=e2,score=5,linktekst=pad,via='gegokt-pad'); break
                except Exception: continue
    except Exception as e:
        r['fout']=f'{type(e).__name__}: {str(e)[:70]}'
    if r.get('programma'):
        route.onthoud(t['host'],programma=r['programma'],score=r.get('score'),
                      linktekst=r.get('linktekst'),via=r.get('via'))
    return r

if __name__=='__main__':
    doelen=json.load(open(pad('instellingen.json')))
    t0=time.time(); uit=[]
    with cf.ThreadPoolExecutor(max_workers=10) as ex:
        for i,r in enumerate(ex.map(werk,doelen),1):
            uit.append(r)
            if i%80==0: print(f'  {i}/{len(doelen)}  {time.time()-t0:.0f}s',flush=True)
    json.dump(uit,open(pad('programmapaginas.json'),'w'),ensure_ascii=False,indent=1)
    route.bewaar()
    met=sum(1 for r in uit if r.get('programma'))
    onthouden=sum(1 for r in uit if r.get('via')=='onthouden')
    print(f'klaar in {time.time()-t0:.0f}s | {met}/{len(uit)} instellingen met een programmapagina')
    print(f'  uit het routegeheugen : {onthouden} (geen homepage opgehaald)')
    print(f'  netwerk               : {haal.samenvatting()}')
    print(f'  geheugen              : {route.samenvatting()}')
