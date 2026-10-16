"""Stap 1: vind per instelling de pagina met het tentoonstellingsprogramma.

Leest de homepage en kiest de link die het meest op een agenda- of
tentoonstellingsoverzicht lijkt. Valt terug op een aantal gangbare paden.
"""
import json,re,urllib.request,urllib.parse,ssl,concurrent.futures as cf,time
from werkmap import pad

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE

# hoe sterker het woord, hoe hoger de score
WOORDEN=[('tentoonstelling',10),('tentoonstellingen',10),('exhibition',9),('exhibitions',9),
         ('nu-te-zien',9),('nu te zien',9),('te-zien',7),('agenda',6),('programma',6),
         ('whats-on',6),("what's on",6),('expositie',8),('exposities',8),('activiteiten',4),
         ('kalender',4),('on-view',7),('current',3)]
NEGATIEF=['archief','archive','afgelopen','past','verleden','vacature','nieuwsbrief','shop','winkel','pers']

def ophalen(url,timeout=15):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept-Language':'nl,en;q=0.8'})
    with urllib.request.urlopen(req,timeout=timeout,context=ctx) as r:
        return r.status,r.read(900_000).decode('utf-8','replace'),r.url

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
    return r

if __name__=='__main__':
    doelen=json.load(open(pad('instellingen.json')))
    t0=time.time(); uit=[]
    with cf.ThreadPoolExecutor(max_workers=10) as ex:
        for i,r in enumerate(ex.map(werk,doelen),1):
            uit.append(r)
            if i%80==0: print(f'  {i}/{len(doelen)}  {time.time()-t0:.0f}s',flush=True)
    json.dump(uit,open(pad('programmapaginas.json'),'w'),ensure_ascii=False,indent=1)
    met=sum(1 for r in uit if r.get('programma'))
    print(f'klaar in {time.time()-t0:.0f}s | {met}/{len(uit)} instellingen met een programmapagina')
