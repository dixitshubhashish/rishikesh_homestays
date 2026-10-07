"""Feed Google Maps places that are new to us and have a confirmed booking link
(.cache/places/new-with-link.json, written by push_places.mjs) into the
stays pipeline, so they're listed on the site like directory stays.

Usage: python3 scripts/stays/import_google_stays.py
Then:  process.py (both cities) → build_pages.py (both cities).

Writes, per city, <cache>/google-extra.jsonl in the crawl's row shape, which
process.py appends to its rows: the area, types, tags and listing_id come
from our own logic. Each row's id is a slug of the name (plus a short place-id
suffix if the name is taken), stable across runs. Google's terms: we keep the
name, our own area/type, the place's Google Maps link (shown as "View on
Google Maps") and its position only to work out the area and distances; it is
never drawn on our OpenStreetMap maps and Google's address isn't shown. The
booking link is added to ota-links.tsv as verified (browser-confirmed match or
the owner's own booking-site page on Google).
"""
import json, os, re, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import cache_dir, CITIES
import booking_stays

HERE = os.path.dirname(os.path.abspath(__file__))
places = json.load(open(os.path.join(HERE, '.cache', 'places', 'new-with-link.json'), encoding='utf8'))
# Google's primary type → the crawl's "type" field process.py understands
GOOGLE_TYPE = {'hostel': 'Hostels', 'bed_and_breakfast': 'Bed and breakfasts', 'extended_stay_hotel': 'Apartments',
               'private_guest_room': 'Holiday rentals'}
# extra type words for process.py's name matching, from Google's type
GOOGLE_WORD = {'resort_hotel': 'Resort', 'guest_house': 'Guest House', 'campground': 'Camp', 'cottage': 'Cottage',
               'farmstay': 'Cottage', 'hotel': 'Hotel', 'motel': 'Hotel', 'inn': 'Hotel'}


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:70] or 'stay'


taken = set()
for city in CITIES:
    f = os.path.join(cache_dir(city), 'stays.json')
    if os.path.exists(f):
        taken |= {s['id'] for s in json.load(open(f, encoding='utf8')) if not s.get('gm')}
# a Google place never reuses the slug of a booking-found stay (import_new_stays.py's registry), so one listing_id never maps
# to two stays. (Not every slug of listing-ids.tsv: the Google stays' own slugs are in it, and taking them would rename
# every Google stay on the next run.)
taken |= {r['slug'] for r in booking_stays.load_registry()}
ota_rows, per_city = [], {}
for p in sorted(places, key=lambda p: p['place_id']):
    slug = slugify(p['name'])
    if slug in taken:
        slug = f"{slug}-{p['place_id'][-5:].lower()}"
    taken.add(slug)
    name = p['name']
    word = GOOGLE_WORD.get(p.get('type'))
    row = {'url': f'https://{slug}.gmaps/en/', 'gm': p['maps'], 'listName': name, 'name': name,
           'type': GOOGLE_TYPE.get(p.get('type'), ''), 'gtype_word': word, 'schemaType': 'Hotel', 'stars': 0,
           'lat': p['lat'], 'lng': p['lng'], 'facilities': [], 'address': '', 'price': None}
    per_city.setdefault(p['city'], []).append(row)
    note = 'Google Maps place: owner\'s own booking page' if p['source'] == 'google_website' else 'Google Maps place, browser-confirmed match'
    ota_rows.append(f"{slug}\tverified\t{p['site']}\t{p['url']}\t{note}\n")
for city in CITIES:
    with open(os.path.join(cache_dir(city), 'google-extra.jsonl'), 'w', encoding='utf8', newline='\n') as fh:
        fh.writelines(json.dumps(r, ensure_ascii=False) + '\n' for r in per_city.get(city, []))
tsv = os.path.join(HERE, '.cache', 'places', 'google-stays-ota.tsv')
open(tsv, 'w', encoding='utf8', newline='\n').writelines(ota_rows)
subprocess.run([sys.executable, os.path.join(HERE, 'merge_ota.py'), tsv], check=True)
print({c: len(v) for c, v in per_city.items()}, 'Google places prepared for process.py')
