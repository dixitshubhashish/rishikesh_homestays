"""Match stays that have no verified booking link against a platform's public
sitemap URL list, offline (no requests), and write candidate URLs to check in
a browser with verify_platform.mjs.

Usage: python3 scripts/stays/sitemap_candidates.py <platform> <urls.txt> [out.tsv]
  platform: booking | easemytrip | agoda   (how to read the property name out of a URL)
STAYS_FILE=<json> matches another list of stays instead of the directory's.
  urls.txt: one property URL per line, from the platform's sitemaps
Writes "key<TAB>doubtful<TAB><Site><TAB>url<TAB>note" rows, at most 2 per stay.
A candidate's URL must contain every distinctive word of the stay's name; when
the name has only one such word, the URL must also name the stay's town.
"""
import glob, json, os, re, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = {'booking': 'Booking.com', 'easemytrip': 'EaseMyTrip', 'agoda': 'Agoda'}
# same generic words as booking-match.mjs: they never identify a stay
STOP = set(('hotel hotels resort resorts rishikesh rishīkesh haridwar hardwar by the a an and of in at near on with stay stays '
            'homestay homestays home house guest guesthouse hostel apartment apartments villa inn lodge cottage cottages '
            'camp camps tapovan laxman jhula ram ganga ganges view river luxury premium boutique bhk 1bhk 2bhk 3bhk room rooms'
            ' bedroom bedrooms bed beds flat flats studio studios peaceful cozy cosy private family deluxe budget spacious modern new entire unit penthouse duplex homely comfortable serene').split())
TOWNS = {'rishikesh': {'rishikesh', 'tapovan', 'laxman', 'lakshman', 'muni', 'shivpuri', 'swarg', 'neelkanth', 'yamkeshwar', 'mohanchatti'},
         'haridwar': {'haridwar', 'hardwar', 'kankhal', 'jwalapur', 'bhupatwala', 'motichur', 'bahadrabad'}}


def words(s):
    return re.sub(r'[^a-z0-9 ]+', ' ', s.lower()).split()


def distinctive(name):
    return [w for w in words(name) if len(w) > 2 and w not in STOP]


def url_words(platform, url):
    if platform == 'booking':  # booking.com/hotel/in/<name-slug>
        m = re.search(r'/hotel/[a-z]{2}/([^/.?]+)', url)
    elif platform == 'easemytrip':  # /hotels/<name-slug>-<id>/
        m = re.search(r'/hotels/(.+?)-\d+/?$', url)
    else:  # agoda: /<name-slug>/hotel/<city>-in.html (city is in the path)
        m = re.search(r'agoda\.com/(?:[a-z]{2}-[a-z]{2}/)?([^/]+)/hotel/([^/]+)\.html', url)
        return (words(m.group(1).replace('-', ' ') + ' ' + m.group(2).replace('-', ' ')) if m else [])
    return words(m.group(1).replace('-', ' ')) if m else []


def main():
    platform, urls_file = sys.argv[1], sys.argv[2]
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, '.cache', f'{platform}-candidates.tsv')
    verified = {l.split('\t')[0] for l in open(os.path.join(HERE, 'ota-links.tsv')).read().splitlines()[1:]
                if l.split('\t')[1] == 'verified'}
    stays = []
    files = [os.environ['STAYS_FILE']] if os.environ.get('STAYS_FILE') else \
        [os.path.join(HERE, '.cache', 'stays.json')] + glob.glob(os.path.join(HERE, '.cache', '*', 'stays.json'))
    for f in files:
        for s in json.load(open(f)):
            if s['id'] not in verified and not s.get('own'):
                stays.append((s['id'], s['n'], s.get('cy') or 'rishikesh'))
    urls = [u.strip() for u in open(urls_file) if u.strip()]
    urls = [u if u.startswith('http') else f'https://www.{u}.html' if platform == 'booking' else u for u in urls]
    uw = [set(url_words(platform, u)) for u in urls]
    index = defaultdict(set)
    for i, ws in enumerate(uw):
        for w in ws:
            index[w].add(i)
    rows, matched = [], 0
    for key, name, city in stays:
        want = distinctive(name)
        if not want:
            continue
        hits = set.intersection(*(index.get(w, set()) for w in want))
        if len(want) == 1 or platform == 'agoda':  # the URL must name our town (Agoda's URLs always carry the city)
            hits = {i for i in hits if uw[i] & TOWNS[city]}
        name_words = set(words(name))
        ranked = sorted(hits, key=lambda i: (-len(uw[i] & TOWNS[city]),
                                             -len(uw[i] & name_words) / max(1, len(uw[i] | name_words))))
        for i in ranked[:2]:
            rows.append(f'{key}\tdoubtful\t{SITE[platform]}\t{urls[i]}\tsitemap name match\n')
        matched += bool(ranked)
    open(out, 'w').write(''.join(rows))
    print(f'{platform}: {len(stays)} stays without a link, {matched} have a sitemap name match, '
          f'{len(rows)} candidate URLs -> {out}')


if __name__ == '__main__':
    main()
