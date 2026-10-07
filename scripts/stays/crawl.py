"""Step 1: crawl every Rishikesh listing on uttarakhand-hotels.com.

Usage: python3 scripts/stays/crawl.py [--fresh] [--city <key>]   (default city: rishikesh)
Writes .cache/props.jsonl (one JSON record per property). Resumable: re-run
to continue where it stopped; --fresh starts over. Polite by design (4
workers, a pause after each page; robots.txt allows crawling). ~15 minutes.
"""
import re, json, time, os, sys, gzip, urllib.request, concurrent.futures as cf, html as H
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import city_from_argv, cache_dir, listing_url, CITIES
CITY=city_from_argv()   # --city <key>; default rishikesh
S=cache_dir(CITY)
LISTING=listing_url(CITY)
DIRECTORY=CITIES[CITY]['directory']
if '--fresh' in sys.argv:
    import shutil
    for f in ('props.jsonl','all-accommodations.html'):
        if os.path.exists(f'{S}/{f}'): os.remove(f'{S}/{f}')
    shutil.rmtree(f'{S}/official',ignore_errors=True)
if not os.path.exists(f'{S}/all-accommodations.html'):
    req=urllib.request.Request(LISTING,headers={'User-Agent':'Mozilla/5.0','Accept-Encoding':'gzip'})
    with urllib.request.urlopen(req,timeout=60) as r:
        b=r.read(); b=gzip.decompress(b) if r.headers.get('Content-Encoding')=='gzip' else b
    open(f'{S}/all-accommodations.html','w',encoding='utf8',newline='\n').write(b.decode('utf-8','replace'))
src=open(f'{S}/all-accommodations.html',encoding='utf8').read()
# The directory's own type and theme pages (first ~50 members each; the rest
# load by script). process.py uses them as official evidence for categories.
os.makedirs(f'{S}/official',exist_ok=True)
for path in sorted(set(re.findall(r'href="(/en/'+DIRECTORY+r'/(?:type|theme)/[a-z0-9-]+/)"',src))):
    name=path.rstrip('/').split('/')[-2]+'_'+path.rstrip('/').split('/')[-1]+'.html'
    if os.path.exists(f'{S}/official/{name}'): continue
    try:
        req=urllib.request.Request('https://www.uttarakhand-hotels.com'+path,headers={'User-Agent':'Mozilla/5.0','Accept-Encoding':'gzip'})
        with urllib.request.urlopen(req,timeout=60) as r:
            b=r.read(); b=gzip.decompress(b) if r.headers.get('Content-Encoding')=='gzip' else b
        open(f'{S}/official/{name}','w',encoding='utf8',newline='\n').write(b.decode('utf-8','replace')); time.sleep(1)
    except Exception as e:
        print('official page failed',path,e,flush=True)
# property list grouped by <h3> type sections
items=[]; seen=set(); typ='Other'
for m in re.finditer(r'<h3[^>]*>\s*([^<(]+?)\s*<span>|<a href="(https://[a-z0-9-]+\.uttarakhand-hotels\.com/en/)">([^<]+)</a>', src):
    if m.group(1): typ=H.unescape(m.group(1).strip()); continue
    url,name=m.group(2),H.unescape(m.group(3).strip())
    if url in seen: continue
    seen.add(url); items.append({'url':url,'listName':name,'type':typ})
print('properties:',len(items),flush=True)
TOTAL=len(items); json.dump({'total':TOTAL},open(f'{S}/total.json','w',encoding='utf8',newline='\n'))
out=f'{S}/props.jsonl'
done=set()
if os.path.exists(out):
    for l in open(out,encoding='utf8'): done.add(json.loads(l)['url'])
todo=[i for i in items if i['url'] not in done]
UA='Mozilla/5.0 (compatible; research crawl for rishikeshhomestays.com)'
def fetch(it):
    for attempt in range(3):
        try:
            req=urllib.request.Request(it['url'],headers={'User-Agent':UA,'Accept-Encoding':'gzip'})
            with urllib.request.urlopen(req,timeout=30) as r:
                b=r.read(); b=gzip.decompress(b) if r.headers.get('Content-Encoding')=='gzip' else b
            s=b.decode('utf-8','replace'); break
        except Exception as e:
            err=str(e); time.sleep(3)
    else:
        return {**it,'error':err}
    rec={**it}
    m=re.search(r'"@type":\s*"(Hotel|LodgingBusiness|Hostel|Resort|BedAndBreakfast|Campground|Apartment|House|VacationRental|Motel|GuestHouse)".*?(?=<\/script>)',s,re.S)
    blk=m.group(0) if m else s
    def g(k):
        x=re.search(r'"'+k+r'"\s*:\s*"([^"]*)"',blk); return H.unescape(x.group(1)) if x else None
    rec['name']=g('name')
    t=re.search(r'"@type"\s*:\s*"(\w+)"\s*,?[^{}]*?"name"',blk); rec['schemaType']=m.group(1) if m else None
    st=re.search(r'"starRating"\s*:\s*\{[^}]*"ratingValue"\s*:\s*"?([\d.]+)',blk); rec['stars']=float(st.group(1)) if st else None
    ag=re.search(r'"aggregateRating"\s*:\s*\{([^}]*)\}',blk)
    if ag:
        rv=re.search(r'"ratingValue"\s*:\s*"?([\d.]+)',ag.group(1)); rc=re.search(r'"(?:reviewCount|ratingCount)"\s*:\s*"?(\d+)',ag.group(1))
        rec['guestRating']=float(rv.group(1)) if rv else None; rec['reviews']=int(rc.group(1)) if rc else None
    mp=re.search(r'maps/place/(-?[\d.]+),(-?[\d.]+)',s); rec['lat'],rec['lng']=(float(mp.group(1)),float(mp.group(2))) if mp else (None,None)
    sec=s.find('data-current-section="service"'); fac=[]
    if sec>0:
        seg=s[sec:s.find('</section>',sec)]
        seg=seg.split('Most Popular Facilities')[0]
        for li in re.findall(r'<li[^>]*>(.*?)</li>',seg,re.S):
            t=H.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',li))).strip()
            if t and len(t)<60 and t not in fac: fac.append(t)
    rec['facilities']=fac
    rec['address']=g('streetAddress') or g('addressLocality'); rec['price']=g('priceRange')
    time.sleep(0.6)
    return rec
with open(out,'a',encoding='utf8',newline='\n') as f, cf.ThreadPoolExecutor(4) as ex:
    for n,rec in enumerate(ex.map(fetch,todo),1):
        f.write(json.dumps(rec,ensure_ascii=False)+'\n'); f.flush()
        if n%100==0: print(n,'/',len(todo),flush=True)
print('done',flush=True)
