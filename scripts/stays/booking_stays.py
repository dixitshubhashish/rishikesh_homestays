"""Shared library for the booking-found stays (owner, 2026-10-07: "no listing in Rishikesh or Haridwar should be missed").

A page the search harvested for a property we do not list is AUTO-LISTED as a new stay (import_new_stays.py): its identity
lives in the committed, append-only registry scripts/stays/booking-stays.tsv; process.py reads it (registry_rows) like
google-extra.jsonl, so the stay gets a listing_id, an area, types and tags from the normal pipeline. No side effects on
import. Everything here is plain functions so the importer, process.py, map_seen_pages.py, import_google_stays.py,
coverage_report.py and the tests share one set of rules.

Cross-platform: all file I/O is UTF-8 with newline='\\n'; paths use os.path.
"""
import csv
import datetime
import html
import math
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import organise_found as of  # noqa: E402
import prune_unfound as pu  # noqa: E402
from cities import CITIES  # noqa: E402

HERE = of.HERE
ROOT = of.ROOT
BL = of.BL
REGISTRY = os.path.join(HERE, 'booking-stays.tsv')
COLS = ['slug', 'name', 'city', 'lat', 'lng', 'type', 'type_word', 'platform', 'url', 'extra_links', 'state', 'first_listed',
        'checked', 'seen_for', 'note']
DECISION_COLS = ['url', 'platform', 'name', 'decision', 'why', 'slug', 'decided']
SCOPE_KM = 25
# process.py's OWN_KEYS: our own 3 stays; a slug may never contain one (build_pages.prepared_stays drops such urls)
OWN_KEYS = ['advaitam-ganga-hill-view-homestay-by-the-ganges-ghat', 'villa-elysium-the-himalayan-ganges-view-yoga-retreat',
            'villa-yoga-retreat-at-the-ganges-in']
# JSON-LD @type (verify_seen.mjs extract) -> process.py's crawl "type" hint and the type word its name matching reads
LTYPE_TYPE = {'Hostel': ('Hostels', ''), 'BedAndBreakfast': ('Bed and breakfasts', ''), 'Apartment': ('Apartments', ''),
              'VacationRental': ('Holiday rentals', ''), 'House': ('Holiday rentals', ''), 'Resort': ('', 'Resort'),
              'Campground': ('', 'Camp'), 'Hotel': ('', ''), 'LodgingBusiness': ('', ''), 'Accommodation': ('', '')}


def set_root(root):
    """Points this module, organise_found and prune_unfound at another tree (tests: --root DIR with scripts/stays/,
    docs/booking-links/ and assets/js/modules/ under it)."""
    global HERE, ROOT, BL, REGISTRY
    root = os.path.abspath(root)
    ROOT, HERE, BL = root, os.path.join(root, 'scripts', 'stays'), os.path.join(root, 'docs', 'booking-links')
    REGISTRY = os.path.join(HERE, 'booking-stays.tsv')
    of.ROOT, of.HERE, of.BL = ROOT, HERE, BL
    pu.HERE, pu.BL = HERE, BL
    # the fixture needs no copy of the shared priority list or city file
    # (ota-priority.tsv falls back to the real one: see _priority_path)


def _priority_path():
    p = os.path.join(HERE, 'ota-priority.tsv')
    return p if os.path.exists(p) else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ota-priority.tsv')


# ---------------------------------------------------------------------------------------------------- files

def render(cols, rows):
    clean = lambda v: re.sub(r'[\t\r\n]+', ' ', str(v if v is not None else ''))
    return '\t'.join(cols) + '\n' + ''.join('\t'.join(clean(r.get(c, '')) for c in cols) + '\n' for r in rows)


def write_if_changed(path, cols, rows):
    """Atomic write (pu.write: temp file, rename with the Windows retry); the bytes are left alone when nothing changed.
    True when it wrote."""
    if not rows and not os.path.exists(path):
        return False   # no header-only files: the first real listing creates the registry
    new = render(cols, rows)
    old = None
    if os.path.exists(path):
        with open(path, encoding='utf8', newline='') as f:
            old = f.read().replace('\r\n', '\n')
    if old == new:
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pu.write(path, cols, rows)
    return True


def load_registry():
    rows = of.tsv(REGISTRY)
    return [{c: (r.get(c) or '') for c in COLS} for r in rows if r.get('slug')]


def save_registry(rows):
    return write_if_changed(REGISTRY, COLS, rows)


def extra_pairs(row):
    """The extra_links column as [(platform, url)]."""
    out = []
    for part in (row.get('extra_links') or '').split(';'):
        if '|' in part:
            p, u = part.split('|', 1)
            out.append((p.strip(), u.strip()))
    return out


def registry_urls(rows=None):
    """canon_url -> slug for every page of every registry stay (primary and extra)."""
    out = {}
    for r in (load_registry() if rows is None else rows):
        out[canon_url(r['url'])] = r['slug']
        for _, u in extra_pairs(r):
            out[canon_url(u)] = r['slug']
    return out


def registry_rows(city):
    """The crawl-shaped rows process.py appends for one city (listed and closed stays: a closed page never drops a stay)."""
    return [process_row(r) for r in load_registry() if r['city'] == city and r['state'] in ('listed', 'closed')]


def process_row(r):
    """Same shape as import_google_stays.py's rows, with no gm: the stay is an ordinary one (OSM map, landmark pages),
    its pin is the booking page's own."""
    return {'url': f"https://{r['slug']}.booking/en/", 'listName': r['name'], 'name': r['name'], 'type': r['type'],
            'gtype_word': r['type_word'] or None, 'schemaType': 'Hotel', 'stars': 0, 'lat': float(r['lat']), 'lng': float(r['lng']),
            'facilities': [], 'address': '', 'price': None}


# ---------------------------------------------------------------------------------------------------- places

def km_between(a, b):
    """The same flat-earth distance verify_seen.mjs uses (so scope agrees in both languages)."""
    return math.hypot((a[0] - b[0]) * 111.32, (a[1] - b[1]) * 111.32 * 0.87)


def metres(a, b):
    return (((a[0] - b[0]) * 111320) ** 2 + ((a[1] - b[1]) * 111320 * 0.87) ** 2) ** 0.5


def city_of(lat, lng):
    """The nearer cities.py centre when the pin is within 25 km of it, else None (a stay's city is the nearer centre)."""
    best = min(CITIES, key=lambda k: km_between((lat, lng), CITIES[k]['center']))
    return best if km_between((lat, lng), CITIES[best]['center']) <= SCOPE_KM else None


# ---------------------------------------------------------------------------------------------------- urls

def canon_url(u):
    """The identity of a booking page: no scheme, www, query, fragment, trailing slash, language variant (.en-gb.html) or
    Agoda /xx-xx/ prefix; lower case."""
    u = (u or '').strip().split('#')[0].split('?')[0]
    u = re.sub(r'^https?://(www\.)?', '', u).rstrip('/').lower()
    u = re.sub(r'(\.[a-z]{2}(?:-[a-z]{2})?)?\.html$', '.html', u)
    return re.sub(r'^(agoda\.com)/[a-z]{2}-[a-z]{2}/', r'\1/', u)


def clean_url(u, platform):
    """The URL as it is stored: no tracking, no language variant; Booking.com on its main host (the CJ link is added at build time)."""
    u = u.strip().split('#')[0].split('?')[0]
    if platform == 'Booking.com':
        u = re.sub(r'(\.[a-z]{2}(?:-[a-z]{2})?)?\.html$', '.html', u)
        u = re.sub(r'^https?://[^/]*booking\.com/', 'https://www.booking.com/', u)
    elif platform == 'Agoda':
        u = re.sub(r'^(https?://[^/]*agoda\.com)/[a-z]{2}-[a-z]{2}/', r'\1/', u)
    return u


def url_words(u):
    """Words of a booking page's path: Booking, Agoda, MakeMyTrip and Goibibo slugs are name-based."""
    path = re.sub(r'^https?://[^/]+', '', u.split('?')[0].split('#')[0]).lower()
    path = re.sub(r'\.html$', '', path)
    stop = {'hotel', 'hotels', 'in', 'details', 'all', 'en', 'html', 'www', 'com', 'rooms', 'india', 'uttarakhand'}
    return [w for w in re.findall(r'[a-z]+', path) if w not in stop and len(w) > 1]


# ---------------------------------------------------------------------------------------------------- names

_LATIN = re.compile(r'[A-Za-zÀ-ɏ]')
_CUT = re.compile(r'[!#|]|[\U0001F000-\U0001FFFF☀-➿⬀-⯿️]')
_LISTY = re.compile(r'\b(best|top \d+|hotels? in|properties in|reviews?|deals?)\b', re.I)


def display_name(raw):
    """A page's name as a stay name: cut at `!`, `#`, `|`, an emoji and a tagline after ` - `, ALL CAPS title-cased.
    process.py's clean() tidies the rest."""
    n = html.unescape(raw or '')
    n = unicodedata.normalize('NFC', n)
    n = _CUT.split(n)[0]
    m = re.search(r'\s[-–—]\s', n)
    if m and len(n[:m.start()].strip()) >= 3:
        n = n[:m.start()]
    n = re.sub(r'\s+', ' ', n).strip(' ,;:–—-')
    letters = [c for c in n if c.isalpha()]
    if len(letters) >= 4 and all(c.isupper() for c in letters):
        n = ' '.join(w[:1].upper() + w[1:].lower() for w in n.split(' '))
    return n


def latin_share(name):
    letters = [c for c in name if c.isalpha()]
    return (sum(1 for c in letters if _LATIN.match(c)) / len(letters)) if letters else 0


def name_problem(raw, url):
    """Why a page's name is not a property's name, or ''. The name must read as one place, in Latin script, share a word
    with the URL slug (name-based on Booking, Agoda, MakeMyTrip and Goibibo: a mismatch is a renamed or redirected page)."""
    dn = display_name(raw)
    words = dn.split()
    if not (2 <= len(words) <= 8):
        return f'name has {len(words)} word(s): "{dn[:40]}"'
    if latin_share(dn) < 0.8:
        return 'name is not in Latin script'
    if _LISTY.search(dn):
        return f'name reads like a list or a title: "{dn[:40]}"'
    tok = of.tokens(dn)
    if not tok:
        return 'name has no distinctive word'
    slug_words = set(url_words(url))
    if not fuzzy_shared(tok, slug_words, strict=False):
        return f'name "{dn[:40]}" shares no word with the page address'
    return ''


def lev(a, b):
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i] + [0] * len(b)
        for j in range(1, len(b) + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1]))
        prev = cur
    return prev[len(b)]


def like(w, t):
    """Port of ota-evidence.mjs like(): equal, a prefix of 4+ letters, 1 slip for 4+ letters, 2 for 5+."""
    return (t == w or (len(w) >= 4 and (t.startswith(w) or (w.startswith(t) and len(t) >= 4)))
            or (len(w) >= 5 and len(t) >= 5 and lev(w, t) <= 2)
            or (len(w) >= 4 and len(t) >= 4 and abs(len(w) - len(t)) <= 1 and lev(w, t) <= 1))


# Words too common around here to tell two places apart on their own (ota-evidence.mjs COMMON and PLACE_WORDS).
COMMON = set(('ganga ganges view river shiva shiv yoga divine om shanti krishna ram hari himalaya himalayan grand royal palace residency inn '
              'heritage paradise valley hills hill comfort golden sun sunshine green blue white new city holy pure luxury cafe stays stay '
              'homestay home house rooms room camp camps resort double single deluxe suite village retreat cottage cottages villa villas '
              'guest hostel lodge dharamshala ashram rishikesh haridwar hardwar tapovan laxman lakshman jhula swarg ghat ghats triveni '
              'parmarth niketan pauri kankhal jwalapur near opposite behind beside upper lower highway bypass').split())


def fuzzy_shared(a, b, strict=True):
    """The tokens of `a` that some token of `b` is like() (a spelling slip, a prefix). strict: common words and place words
    never count on their own (two stays that share only "ganga" are not alike); the URL-slug check of a name is not strict."""
    return sorted(w for w in a if (not strict or w not in COMMON) and any(like(w, t) for t in b))


# ---------------------------------------------------------------------------------------------------- ranking

_prio = None


def _priority():
    global _prio
    key = _priority_path()
    if _prio is None or _prio[0] != key:
        rows = of.tsv(key)
        _prio = (key, {r['ota']: (int(r['rank']), (r.get('autolist') or ('n' if r['ota'] in ('Airbnb', 'Trivago') else 'y')).strip() == 'y')
                       for r in rows})
    return _prio[1]


def rank_of(platform):
    return _priority().get(platform, (99, False))[0]


def autolist(platform):
    return _priority().get(platform, (99, False))[1]


# ---------------------------------------------------------------------------------------------------- stays we already have

def own_stays():
    """STAYS_OWN of the data module: our own stays (key -> {n, ll})."""
    out = {}
    p = os.path.join(ROOT, 'assets', 'js', 'modules', 'stays-index-data.js')
    if os.path.exists(p):
        import json
        m = re.search(r'^export const STAYS_OWN = (\[.*\]);$', open(p, encoding='utf8').read(), re.M)
        if m:
            for s in json.loads(m.group(1)):
                out[s['id']] = s
    return out


def known_stays(registry=None):
    """Every stay we already have, one dict each: key, name, ll, tok, unit, src. The site's data modules, our own stays,
    the processed crawl (it still has stays the site dropped, and our own 3), ALL Google places (also the unlinked ones),
    and the registry."""
    import json
    pool = {}
    reg = load_registry() if registry is None else registry
    reg_slugs = {r['slug'] for r in reg}   # the site and the crawl carry registry stays once built: they are the registry's, not "others"

    def add(key, name, ll, src):
        if not ll or ll[0] in ('', None) or ll[1] in ('', None):
            return
        if key in pool or (src != 'registry' and key in reg_slugs):
            return
        if key in OWN_KEYS:
            src = 'own'
        pool[key] = dict(key=key, name=name or '', ll=(float(ll[0]), float(ll[1])), tok=of.tokens(name or ''), unit=of.unit(name or ''), src=src)

    for k, s in of.stays_index().items():
        add(k, s.get('n'), s.get('ll'), 'site')
    for k, s in own_stays().items():
        add(k, s.get('n'), s.get('ll'), 'own')
    for k, s in of.processed_stays().items():
        add(k, s.get('n'), s.get('ll'), 'crawl')
    pl = os.path.join(HERE, '.cache', 'places', 'all-stays.json')
    if os.path.exists(pl):
        for s in json.load(open(pl, encoding='utf8')):
            add(s['id'], s.get('n'), s.get('ll'), 'google')
    for r in reg:
        add(r['slug'], r['name'], (r['lat'], r['lng']), 'registry')
    return pool


def taken_slugs(registry=None):
    """Every slug a new stay must not use: listing-ids.tsv (active or not), the registry, the crawl's ids, the Google rows'
    ids and the organised found list."""
    import json
    taken = set()
    for r in of.tsv(os.path.join(HERE, 'listing-ids.tsv')):
        taken.add(r['slug'])
    taken |= {r['slug'] for r in (load_registry() if registry is None else registry)}
    taken |= set(of.processed_stays())
    for city in CITIES:
        d = os.path.join(HERE, '.cache') if city == 'rishikesh' else os.path.join(HERE, '.cache', city)
        f = os.path.join(d, 'google-extra.jsonl')
        if os.path.exists(f):
            for line in open(f, encoding='utf8'):
                if line.strip():
                    taken.add(json.loads(line)['url'].split('//')[1].split('.')[0])
    for r in of.tsv(os.path.join(BL, 'found-by-property.tsv')):
        taken.add(r.get('slug', ''))
        taken.add(r.get('key', ''))
    taken.discard('')
    return taken


def today():
    return datetime.date.today().isoformat()
