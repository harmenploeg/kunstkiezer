"""Candidate inventory; pip install beautifulsoup4 lxml. Factual metadata only."""
import html as html_utils, json, re, csv, time, uuid, hashlib, unicodedata, concurrent.futures, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path('/workspace/musea-onderzoek'); CACHE.mkdir(exist_ok=True)
OUT=ROOT/'data/museums'; OUT.mkdir(parents=True,exist_ok=True)
STAMP=datetime.now(timezone.utc).isoformat()
UA='Mozilla/5.0 Kunstkiezer museuminventaris; factual metadata research'
PROVINCES=['Drenthe','Flevoland','Friesland','Gelderland','Groningen','Limburg','Noord-Brabant','Noord-Holland','Overijssel','Utrecht','Zeeland','Zuid-Holland']
def norm(s):
 s=html_utils.unescape(html_utils.unescape(s or ''))
 s={'sgravenhage':'Den Haag','shertogenbosch':'Den Bosch'}.get(re.sub(r'[^a-z]','',s.lower()),s)
 return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower())
def fetch(url):
 file=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 if file.exists(): return file.read_text()
 time.sleep(.2)
 req=urllib.request.Request(url,headers={'User-Agent':UA})
 with urllib.request.urlopen(req,timeout=20) as r: html=r.read().decode('utf-8',errors='replace')
 file.write_text(html);return html

def clean_website(value):
 if not isinstance(value,str):return ''
 value=html_utils.unescape(value).strip()
 if value and not re.match(r'^https?://',value,re.I) and re.match(r'^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',value):value='https://'+value
 u=urllib.parse.urlparse(value)
 return value if u.scheme in ('http','https') and u.netloc and not u.username and not re.search(r'\s',value) else ''

def official(url):
 try:
  html=fetch(url);s=BeautifulSoup(html,'lxml')
  for node in s.find_all('script'):
   if node.get('type')!='application/ld+json':continue
   try:d=json.loads(node.get_text())
   except (ValueError,TypeError):continue
   if not isinstance(d,dict) or d.get('@type')!='Museum':continue
   a=d.get('address') or {};g=d.get('geo') or {}
   name=html_utils.unescape(html_utils.unescape(d.get('name') or '')) or (s.h1.get_text(' ',strip=True) if s.h1 else '')
   if not name:return None
   if a.get('addressCountry') not in (None,'NL','Nederland'):return None
   return dict(inventory_key='museum-nl:'+url.rsplit('/',1)[-1],name=name,city=html_utils.unescape(html_utils.unescape(a.get('addressLocality') or '')),province='',street_address=a.get('streetAddress') or '',postal_code=a.get('postalCode') or '',country='NL',website_url=clean_website(d.get('sameAs') or ''),latitude=g.get('latitude'),longitude=g.get('longitude'),summary='',operating_status='unknown',publication_status='draft',verification_status='unreviewed',suggested_tags=[],tags=[],sources=[dict(provider='Museum.nl',url=url,retrieved_at=STAMP,external_id=url.rsplit('/',1)[-1],evidence_fields=['name','city','street_address','postal_code','website_url','latitude','longitude'])],review_notes='Bronvermelding is geen controle van actuele opening of toegankelijkheid.')
  return None
 except Exception as e:return {'fetch_error':url,'error':str(e)}

def wikipedia(pair):
 province,url=pair
 try:
  s=BeautifulSoup(fetch(url),'lxml');content=s.select_one('.mw-parser-output') or s;out=[]
  for table in content.select('table.wikitable'):
   heads=[c.get_text(' ',strip=True).lower() for c in table.select('tr')[0].find_all(['th','td'])]
   for row in table.select('tr')[1:]:
    cells=row.find_all(['td','th'],recursive=False)
    if len(cells)<2:continue
    name=cells[0].get_text(' ',strip=True);link=cells[0].find('a',href=True)
    if not name or 'museum' in name.lower() and len(name)>150:continue
    ci=next((i for i,h in enumerate(heads) if h in ('plaats','locatie','vestigingsplaats')),1)
    city=cells[ci].get_text(' ',strip=True) if ci<len(cells) else ''
    source=urllib.parse.urljoin(url,link['href']) if link else url
    notes='; '.join(c.get_text(' ',strip=True) for c in cells[2:])
    closed=bool(re.search(r'\b(gesloten|opgeheven|voormalig)\b',notes,re.I))
    key='wikipedia:'+province+':'+norm(name)+':'+norm(city)
    out.append(dict(inventory_key=key,name=name,city=city,province=province,street_address='',postal_code='',country='NL',website_url='',latitude=None,longitude=None,summary='',operating_status='closed' if closed else 'unknown',publication_status='draft',verification_status='unreviewed',suggested_tags=[],tags=[],sources=[dict(provider='Wikipedia',url=url,retrieved_at=STAMP,external_id=source,evidence_fields=['name','city','province'])],review_notes=('Mogelijk historisch/gesloten. ' if closed else '')+'Provinciale lijst; adres en actuele status nog controleren.'))
  if not content.select('table.wikitable'):
   for item in content.select('li'):
    if item.find_parent('li') or item.find_parent(['table','nav']):continue
    link=item.find('a',href=True); heading=item.find_previous(['h2','h3'])
    if not heading or not link:continue
    city=heading.get_text(' ',strip=True).split('[')[0].strip()
    if heading.name!='h3' and 'Amsterdam' not in url:continue
    if any(word in city.lower() for word in ['zie ook','bron','externe','referentie','literatuur']):continue
    if 'Amsterdam' in url:city='Amsterdam'
    name=link.get_text(' ',strip=True)
    if not name or name.startswith('Lijst van '):continue
    notes=item.get_text(' ',strip=True)
    closed=bool(re.search(r'\b(gesloten|opgeheven|voormalig)\b',notes,re.I))
    source=urllib.parse.urljoin(url,link['href']).split('?')[0]
    out.append(dict(inventory_key='wikipedia:'+province+':'+norm(name)+':'+norm(city),name=name,city=city,province=province,street_address='',postal_code='',country='NL',website_url='',latitude=None,longitude=None,summary='',operating_status='closed' if closed else 'unknown',publication_status='draft',verification_status='unreviewed',suggested_tags=[],tags=[],sources=[dict(provider='Wikipedia',url=url,retrieved_at=STAMP,external_id=source,evidence_fields=['name','city','province'])],review_notes=('Mogelijk historisch/gesloten. ' if closed else '')+'Provinciale lijst; adres en actuele status nog controleren.'))
  return out
 except Exception as e:return [{'fetch_error':url,'error':str(e)}]

s=BeautifulSoup((CACHE/'museum-nl-sitemap.html').read_text(),'xml')
urls=sorted(set(x.text for x in s.find_all('loc') if re.fullmatch(r'https://www.museum.nl/nl/[^/]+',x.text)))
records=[];errors=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,r in enumerate(pool.map(official,urls),1):
  if r and 'fetch_error' in r: errors.append(r)
  elif r:records.append(r)
  if i%75==0:print('Museum.nl',i,'/',len(urls),'musea',len(records),flush=True)
wiki=BeautifulSoup((CACHE/'wiki-musea.html').read_text(),'lxml')
pairs=[]
for a in wiki.select('.mw-parser-output a[title]'):
 title=a.get('title','')
 if not title.startswith('Lijst van musea in '):continue
 p=title.replace('Lijst van musea in ','').split(' (')[0]
 if p in PROVINCES:pairs.append((p,a['href']))
pairs.append(('Noord-Holland','https://nl.wikipedia.org/wiki/Lijst_van_musea_in_Amsterdam'))
wiki_records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for province,result in zip(pairs,pool.map(wikipedia,pairs)):
  print('Wikipedia',province[0],len(result),flush=True)
  for r in result:
   if 'fetch_error' in r:errors.append(r)
   else:wiki_records.append(r)
# Prevent duplicate entries for the same name/locality from one list.
wiki_records=list({r["inventory_key"]:r for r in wiki_records}.values())
# Merge only exact normalized names plus compatible locality. Fuzzy matches are review tasks.
merged=0
for r in wiki_records:
 matches=[m for m in records if norm(m['name'])==norm(r['name']) and (norm(m['city'])==norm(r['city']) or not r['city'])]
 if len(matches)==1:
  m=matches[0];m['sources']+=r['sources'];m['province']=r['province'];merged+=1
  if r['operating_status']=='closed':m['review_notes']+=' Provinciale bron meldt gesloten; controleren.'
 else: records.append(r)
# Infer province only from a locality uniquely assigned across these provincial source lists.
city_provinces={}
for r in wiki_records:city_provinces.setdefault(norm(r["city"]),set()).add(r["province"])
for r in records:
 if not r["province"] and len(city_provinces.get(norm(r["city"]),set()))==1:
  r["province"]=next(iter(city_provinces[norm(r["city"])]))
  r["review_notes"]+=" Provincie afgeleid uit plaatsnaam in provinciale lijst; controleren."
# Conservative title-based editorial proposals; never published/accepted automatically.
rules=[('fotografie',r'foto|photograph','medium'),('moderne kunst',r'moderne kunst|modern art|stedelijk museum amsterdam','periode'),('hedendaagse kunst',r'hedendaags|contemporary','periode'),('beeldhouwkunst',r'beelden|beeldhouw|sculptuur|sculpture','medium'),('kunst',r'kunst|art museum|rijksmuseum amsterdam|van gogh|rembrandt|vermeer|boijmans|kröller|kroller','collectie'),('geschiedenis',r'histor|geschiedenis|oudheid|verzet|oorlog','collectie'),('natuur',r'natuur|nature|naturalis','collectie'),('wetenschap',r'wetenschap|science|universiteits|nemo','collectie'),('maritiem',r'maritiem|scheepvaart|marine','thema'),('vervoer',r'spoor|tram|auto|trein|luchtvaart','thema'),('streekgeschiedenis',r'streek|stadsmuseum|heemkunde','collectie'),('architectuur',r'architectuur|huis sonneveld','medium'),('openlucht',r'openlucht','beleving')]
for r in records:
 r['id']=str(uuid.uuid5(uuid.NAMESPACE_URL,r['inventory_key']))
 r['suggested_tags']=[{'label':label,'dimension':dim,'confidence':'low','evidence':'Naam bevat een trefwoord; redactionele controle vereist.'} for label,regex,dim in rules if re.search(regex,r['name'],re.I)]
 # Weak potential duplicates are marked, never silently merged.
 words=set(re.findall(r'[a-z0-9]+',unicodedata.normalize('NFKD',r['name']).encode('ascii','ignore').decode().lower()))-{'museum','het','de','een','van','in'}
 r['_words']=words
pairs_review=[]
for i,a in enumerate(records):
 for b in records[i+1:]:
  if not a['city'] or norm(a['city'])!=norm(b['city']):continue
  union=a['_words']|b['_words'];score=len(a['_words']&b['_words'])/len(union) if union else 0
  if score>=.6:pairs_review.append({'id_a':a['id'],'id_b':b['id'],'name_a':a['name'],'name_b':b['name'],'city':a['city'],'similarity':round(score,2)})
for r in records:r.pop('_words',None)
records.sort(key=lambda r:(r['province'],r['city'],r['name']))
(OUT/'inventory.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
(OUT/'possible-duplicates.json').write_text(json.dumps(pairs_review,ensure_ascii=False,indent=2))
(OUT/'fetch-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2))
report={'retrieved_at':STAMP,'museum_nl_count':sum(any(s['provider']=='Museum.nl' for s in r['sources']) for r in records),'wikipedia_rows':len(wiki_records),'exact_merges':merged,'candidate_count':len(records),'possible_duplicate_pairs':len(pairs_review),'fetch_errors':len(errors),'province_counts':{p:sum(r['province']==p for r in records) for p in PROVINCES},'province_unknown':sum(not r['province'] for r in records),'complete':False,'scope':'Europees Nederland; museum.nl en twaalf provinciale Wikipedia-lijsten. Kandidaten, geen volledig gecontroleerd register.'}
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
with (OUT/'inventory.csv').open('w',newline='') as f:
 fields=['id','inventory_key','name','city','province','street_address','postal_code','country','website_url','latitude','longitude','operating_status','publication_status','verification_status','review_notes','source_urls','suggested_tags']
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader()
 for r in records:
  w.writerow({**{k:r.get(k,'') for k in fields if k not in ('source_urls','suggested_tags')},'source_urls':' | '.join(s['url'] for s in r['sources']),'suggested_tags':' | '.join(t['label'] for t in r['suggested_tags'])})
print(json.dumps(report,ensure_ascii=False),flush=True)
