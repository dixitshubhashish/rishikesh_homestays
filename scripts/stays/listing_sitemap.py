"""sitemap-stays.xml: one entry per listed stay, kept current by every stays build.

Every third-party stay in the built data modules (assets/js/modules/stays-index-data*.js,
one per city) has its own page, /hotels/stay?s=<slug>[&c=<city>] (hotels/stay.html, filled
in by stay-page.js). This script writes sitemap-stays.xml from those modules, so a stay that
is added, changed or dropped is added, re-dated or removed from the sitemap by the same
`npm run build:stays` that rebuilds the pages. Nothing is edited by hand.

<lastmod> is honest, like page_dates.py: listing-dates.tsv (committed) keeps, per
<city>/<slug>, a fingerprint of the stay's record (name, area, type, rating, price,
facilities, booking links, ...) and the date that fingerprint first appeared. The date moves
only when the record changes, never because the pages were rebuilt, so search engines keep
trusting it and IndexNow (scripts/indexnow.mjs) pings only the stays that really changed.

Our own stays (STAYS_OWN) are not listed here: they have their own pages, which are already
in sitemap.xml. The booking-link side is read from the same modules (field `o`), so a newly
verified booking page counts as an update to that stay.

Usage: node scripts/py.mjs scripts/stays/listing_sitemap.py [--check]
  --check   write nothing; exit 1 when sitemap-stays.xml or listing-dates.tsv is out of date.
"""
import datetime
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
MODULES = os.path.join(ROOT, 'assets', 'js', 'modules')
REGISTRY = os.path.join(HERE, 'listing-dates.tsv')
OUT = os.path.join(ROOT, 'sitemap-stays.xml')
SITE = 'https://rishikeshhomestays.com'
LIMIT = 50000   # the sitemap protocol's cap per file
TODAY = datetime.date.today().isoformat()
MODULE = re.compile(r'^stays-index-data(?:-([a-z]+))?\.js$')


def city_modules():
    """(city, path) for every built data module: stays-index-data.js is Rishikesh."""
    out = []
    for f in sorted(os.listdir(MODULES)):
        m = MODULE.match(f)
        if m:
            out.append((m.group(1) or 'rishikesh', os.path.join(MODULES, f)))
    return out


def read_stays(path):
    """STAYS_INDEX of one data module (a JSON array after `export const STAYS_INDEX =`)."""
    s = open(path, encoding='utf-8').read()
    m = re.search(r'export const STAYS_INDEX\s*=\s*', s)
    arr, _ = json.JSONDecoder().raw_decode(s[m.end():])
    return arr


def url_for(city, slug):
    q = re.sub(r'[^A-Za-z0-9._~-]', lambda c: ''.join(f'%{b:02X}' for b in c.group(0).encode('utf-8')), slug)
    return f'{SITE}/hotels/stay?s={q}' + ('' if city == 'rishikesh' else f'&amp;c={city}')


def fingerprint(record):
    return hashlib.sha1(json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()[:16]


def load_registry():
    out = {}
    if os.path.exists(REGISTRY):
        for line in open(REGISTRY, encoding='utf-8').read().splitlines()[1:]:
            key, digest, date = (line.split('\t') + ['', ''])[:3]
            if key:
                out[key] = (digest, date)
    return out


def build():
    """-> (sitemap text, registry text) for today's data modules."""
    old = load_registry()
    rows, reg = [], []
    seen = set()
    for city, path in city_modules():
        for s in read_stays(path):
            slug = s.get('id')
            key = f'{city}/{slug}'
            if not slug or key in seen:
                continue
            seen.add(key)
            digest = fingerprint(s)
            was = old.get(key)
            date = was[1] if was and was[0] == digest and was[1] else TODAY
            reg.append((key, digest, date))
            rows.append((url_for(city, slug), date))
    if len(rows) > LIMIT:
        raise SystemExit(f'{len(rows)} stays: over the {LIMIT} URLs one sitemap file may hold; split it into a sitemap index')
    rows.sort()
    reg.sort()
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, date in rows:
        xml.append(f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{date}</lastmod>\n  </url>')
    xml.append('</urlset>')
    registry = 'key\tdigest\tlastmod\n' + ''.join(f'{k}\t{d}\t{dt}\n' for k, d, dt in reg)
    return '\n'.join(xml) + '\n', registry


def main():
    check = '--check' in sys.argv
    xml, registry = build()
    cur = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    cur_reg = open(REGISTRY, encoding='utf-8').read() if os.path.exists(REGISTRY) else ''
    n = xml.count('<url>')
    if check:
        if cur != xml or cur_reg != registry:
            print(f'sitemap-stays.xml / listing-dates.tsv are out of date ({n} stays): run node scripts/py.mjs scripts/stays/listing_sitemap.py')
            sys.exit(1)
        print(f'sitemap-stays.xml is current ({n} stays)')
        return
    old = load_registry()
    new = {line.split('\t')[0]: line.split('\t')[1:] for line in registry.splitlines()[1:]}
    added = sum(k not in old for k in new)
    removed = sum(k not in new for k in old)
    changed = sum(k in old and old[k][0] != v[0] for k, v in new.items())
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(xml)
    with open(REGISTRY, 'w', encoding='utf-8', newline='\n') as f:
        f.write(registry)
    print(f'sitemap-stays.xml: {n} stays ({added} new, {changed} changed, {removed} removed)')


if __name__ == '__main__':
    main()
