"""Step 2: clean the crawl into .cache/stays.json for build_pages.py.

Usage: python3 scripts/stays/process.py [--names]
- Tidies names into readable form (2BHK not "02 Bhk", no slug hyphens,
  "Victoria's" not "Victoria'S", drops the directory's trailing "Rishikesh").
- Area: from a keyword in the name/address first (site AREAS names where they
  exist), else the nearest area centre within 1.2 km by map position (centres
  are the median position of the keyword-matched stays), else
  "Elsewhere in Rishikesh".
- Types (ks): every type with evidence: the directory's own section plus each
  type word found as a whole word in the name. One stay can be in several.
- Theme tags (t): pet, ganga, luxury, budget, pool (see tags()).
- Drops duplicates (same name within 150 m).
--names prints a sample of raw -> cleaned names for eyeballing.
"""
import json, re, math, statistics, os, sys
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'.cache')
rows=[json.loads(l) for l in open(f'{S}/props.jsonl')]
rows=[r for r in rows if not r.get('error')]

SMALL={'in','on','by','the','and','of','at','with','near','to','for','from'}
UPPER={'bhk':'BHK','ac':'AC','ii':'II','iii':'III','iv':'IV','yha':'YHA','gmvn':'GMVN','oyo':'OYO','bnb':'BnB','wifi':'WiFi','tv':'TV','dlx':'Dlx','aiims':'AIIMS','spa':'Spa','nh':'NH','vip':'VIP','b&b':'B&B','bbq':'BBQ'}
def clean(n):
    n=re.sub(r"\s+",' ',n).strip()
    n=re.sub(r"(\w)'S\b",r"\1's",n)
    n=re.sub(r"(?<=\w)(['\")])(?=[A-Z])",r"\1 ",n)          # 'Kedar Residency'Rishikesh -> ' Rishikesh
    n=re.sub(r"\b0?(\d)\s*-?\s*bhk\b",lambda m:m.group(1)+'BHK',n,flags=re.I)
    n=re.sub(r"\s*-\s+|\s+-\s*",' – ',n)                # spaced hyphen -> en dash
    n=re.sub(r"(\w{3,})-(?=[A-Z])",r"\1 – ",n)  # Rishikesh-The -> Rishikesh – The
    n=n.replace('_',' ')
    n=re.sub(r'\bNh\s?(\d+)',r'NH\1',n)
    words=n.split(' '); out=[]
    for i,w in enumerate(words):
        core=w.strip('()\'",.').lower()
        prev=out[-1] if out else ''
        if core in UPPER: w=w.replace(w.strip('()\'",.'),UPPER[core])
        elif i>0 and core in SMALL and prev.isalpha() and prev not in ('–',) and not prev.endswith((',',':')) : w=w.lower()
        out.append(w)
    n=' '.join(out)
    n=re.sub(r"\s*,\s*",', ',n); n=re.sub(r"\s+",' ',n).strip(' ,–-')
    # drop a trailing bare "Rishikesh" the directory appends (keep it when it's most of the name)
    m=re.match(r"^(.*\S)[ ,]+Rishikesh$",n)
    if m and len(m.group(1).split())>=2 and not m.group(1).lower().endswith((' in',' of',' at',' near')): n=m.group(1).rstrip(' ,–')
    return n[0].upper()+n[1:] if n else n

AREAS=[  # (area, keywords) — specific first; names match the site's AREAS where they exist
 ('Tapovan',['tapovan','tapoban']),
 ('Laxman Jhula',['laxman jhula','lakshman jhula','laxmanjhula','lakshmanjhula']),
 ('Swarg Ashram',['swarg ashram','swargashram','swargashram']),
 ('Ram Jhula',['ram jhula','ramjhula']),
 ('Muni Ki Reti',['muni ki reti','munikireti','muni-ki-reti']),
 ('Neelkanth Road',['neelkanth','mohanchatti','mohan chatti','phoolchatti','phool chatti']),
 ('Shivpuri & rafting belt',['shivpuri','byasi','kaudiyala','marine drive','brahmapuri','singtali','ghattu','gular']),
 ('Nirmal Bagh near Ganges',['nirmal bagh']),
 ('Triveni Ghat',['triveni']),
 ('AIIMS Rishikesh',['aiims']),
 ('Veerbhadra Temple',['virbhadra','veerbhadra','virbhadhra']),
 ('Ganga Barrage',['barrage','pashulok']),
 ('Nepali Farm',['nepali farm']),
 ('Raiwala & Shyampur',['raiwala','shyampur','khadri']),
 ('Dehradun Road',['dehradun road','jolly grant','bhaniyawala','doiwala']),
 ('Bypass Road',['bypass','by-pass','by pass']),
 ('Haridwar Road',['haridwar road']),
]
CENTER=(30.103,78.297)
def km(a,b):
    R=6371; p=math.radians
    dlat=p(b[0]-a[0]); dlng=p(b[1]-a[1])
    h=math.sin(dlat/2)**2+math.cos(p(a[0]))*math.cos(p(b[0]))*math.sin(dlng/2)**2
    return 2*R*math.asin(math.sqrt(h))
for r in rows:
    r['clean']=clean(r.get('name') or r['listName'])
    hay=' '.join([r.get('name') or '',r['listName'],r.get('address') or '',r['url']]).lower().replace('-',' ')
    r['area']=next((a for a,kws in AREAS if any(k.replace('-',' ') in hay for k in kws)),None)
    r['how']='text' if r['area'] else None
# area centres from properties whose text names the area
cent={}
for a,_ in AREAS:
    pts=[(r['lat'],r['lng']) for r in rows if r['area']==a and r.get('lat')]
    if len(pts)>=3: cent[a]=(statistics.median(p[0] for p in pts),statistics.median(p[1] for p in pts))
for r in rows:
    if r['area'] or not r.get('lat'): continue
    p=(r['lat'],r['lng'])
    if km(p,CENTER)>30: r['area']='Outside Rishikesh'; r['how']='map'; continue
    best=min(cent.items(),key=lambda kv:km(p,kv[1]),default=None)
    if best and km(p,best[1])<=1.2: r['area']=best[0]; r['how']='map'
for r in rows:
    if not r['area']: r['area']='Elsewhere in Rishikesh'
TYPE_WORDS=[('Camps & tents',['camp','tent','glamp','campsite']),('Hostels',['hostel','zostel','backpacker']),('Resorts',['resort']),('Homestays',['homestay','home stay']),
 ('Guest houses',['guest house','guesthouse']),('Cottages',['cottage','chalet','farm stay','country house']),('Ashrams',['ashram']),('Villas',['villa']),('Aparthotels',['aparthotel']),
 ('Apartments',['apartment','bhk','flat','condo']),('Lodges',['lodge']),('Hotels',['hotel','inn','residency','palace'])]
TYPE_MAP={'Villas':'Villas','Apartments':'Apartments','Hostels':'Hostels','Bed and breakfasts':'B&Bs','Holiday rentals':'Holiday rentals'}
# The directory's own type/theme pages (.cache/official, saved by crawl.py).
OFFICIAL_TYPE={'hotels':'Hotels','apartments':'Apartments','hostels':'Hostels','guest-houses':'Guest houses','homestays':'Homestays','resorts':'Resorts',
 'bed-and-breakfasts':'B&Bs','villas':'Villas','aparthotels':'Aparthotels','holiday-homes':'Holiday rentals','campsites':'Camps & tents','luxury-tents':'Camps & tents',
 'lodges':'Lodges','condos':'Apartments','country-houses':'Cottages','farm-stays':'Cottages','chalets':'Cottages','inns':'Hotels','capsule-hotels':'Hotels','economy-hotels':'Hotels'}
OFFICIAL_THEME={'family-hotels':'family','spa-hotels':'spa','boutique-hotels':'boutique','business-hotels':'business','jacuzzi':'jacuzzi','pets-allowed':'pet',
 'pool-hotels':'pool','luxury-hotels':'luxury','luxury-accommodations':'luxury','small-luxury-hotels':'luxury','cheap-and-budget-hotels':'budget','extended-stay':'kitchen'}
SLUG_TYPE={'resort':'Resorts','hotel':'Hotels','hostel':'Hostels','apt':'Apartments','villa':'Villas','bnb':'B&Bs'}
official_types={}; official_themes={}
odir=f'{S}/official'
if os.path.isdir(odir):
    for fn in os.listdir(odir):
        m=re.match(r'(type|theme)_([a-z-]+?)-\d+\.html$',fn)
        if not m: continue
        key=m.group(2); target=(OFFICIAL_TYPE if m.group(1)=='type' else OFFICIAL_THEME).get(key)
        if not target: continue
        for u in set(re.findall(r'href="(https://[a-z0-9-]+\.uttarakhand-hotels\.com/en/)"',open(f'{odir}/{fn}').read())):
            (official_types if m.group(1)=='type' else official_themes).setdefault(u,set()).add(target)
for r in rows:
    # Every type with evidence: the directory's own section and type pages,
    # the type word it appends to the name / its URL prefix, then each type
    # word found as a whole word in the name. Weak hotel words (inn,
    # residency...) only count when nothing else is known.
    n=r['clean'].lower(); ks=[]
    def add(t):
        if t and t not in ks: ks.append(t)
    if r['type'] in TYPE_MAP: add(TYPE_MAP[r['type']])
    for t in sorted(official_types.get(r['url'],())): add(t)
    add(SLUG_TYPE.get(r['url'].split('//')[1].split('-')[0].split('.')[0]))
    for t,kws in TYPE_WORDS:
        words=['hotel'] if (t=='Hotels' and ks) else kws
        if t not in ks and any(re.search(r'\b'+re.escape(k)+r's?\b',n) for k in words): add(t)
    r['ks']=ks or ['Other stays']; r['kind']=r['ks'][0]
# de-duplicate: same clean name within 150 m
seen=[]; out=[]
for r in sorted(rows,key=lambda r:-(r.get('reviews') or 0)):
    dup=any(s['clean'].lower()==r['clean'].lower() and r.get('lat') and s.get('lat') and km((s['lat'],s['lng']),(r['lat'],r['lng']))<0.15 for s in seen)
    if dup: continue
    seen.append(r); out.append(r)
def tags(r):
    t=[]; n=r['clean'].lower(); f=[x.lower() for x in (r.get('facilities') or [])]
    price=int(re.sub(r'\D','',r['price'])) if r.get('price') and re.search(r'\d',r['price']) else None
    if 'pets allowed' in f: t.append('pet')
    if re.search(r'ganga|ganges|river ?view|riverside|river side|ghat',n): t.append('ganga')
    if (r.get('stars') or 0)>=4 or (price and price>=8000): t.append('luxury')
    if price and price<=1500: t.append('budget')
    if any('pool' in x for x in f): t.append('pool')
    if any(x.startswith('spa') or 'massage' in x for x in f): t.append('spa')
    if 'jacuzzi' in f: t.append('jacuzzi')
    if any('kitchen' in x for x in f): t.append('kitchen')
    if any('business centre' in x or 'meeting' in x for x in f): t.append('business')
    if 'yoga class' in f or re.search(r'\byoga\b',n): t.append('yoga')
    if any('airport shuttle' in x for x in f): t.append('airport')
    if re.search(r'\bfamily\b',n): t.append('family')
    for th in official_themes.get(r['url'],()):
        if th not in t: t.append(th)
    return t
data=[{'id':r['url'].split('//')[1].split('.')[0],'ad':r.get('address') or '','ll':[r['lat'],r['lng']] if r.get('lat') else None,'t':tags(r),'n':r['clean'],'u':r['url'],'s':int(r['stars'] or 0),'a':r['area'],'k':r['kind'],'ks':r['ks'],'g':r.get('guestRating'),'c':r.get('reviews'),'f':r.get('facilities') or [],'p':(int(re.sub(r'\D','',r['price'])) if r.get('price') and re.search(r'\d',r['price']) else None)} for r in out]
data.sort(key=lambda d:d['n'].lower())
json.dump(data,open(f'{S}/stays.json','w'),ensure_ascii=False,separators=(',',':'))
from collections import Counter
print('rows',len(rows),'kept',len(data))
print('stars',sorted(Counter(d['s'] for d in data).items()))
print('areas',Counter(d['a'] for d in data).most_common())
print('kinds',Counter(d['k'] for d in data).most_common())
print('area by text/map/none',Counter(r['how'] for r in rows))
if '--names' in sys.argv:
    for r in rows[:: max(1,len(rows)//40)]: print(f"{r['listName'][:60]:60} -> {r['clean']}")
