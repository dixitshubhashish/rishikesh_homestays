"""sitemap-stays.xml / sitemap.xml: one entry per listed stay, kept current by every stays build.

Every third-party stay in the built data modules (assets/js/modules/stays-index-data*.js,
one per city) has its own page, /hotels/stay?s=<slug>[&c=<city>] (hotels/stay.html, filled
in by stay-page.js). This script keeps that entry current, so a stay that is added, changed
or dropped is added, re-dated or removed by the same `npm run build:stays` that rebuilds the
pages. Nothing is edited by hand.

Owner decision 2026-10-17 ("as long as URL is finalised it should move in main sitemap"): a
stay with a real, verified booking link (field `o`) counts as finalised and its URL lives in
the MAIN sitemap.xml instead, inside the `<!-- listing-sitemap --> ... <!-- /listing-sitemap -->`
marker block this script owns there (the rest of sitemap.xml -- category/landmark/search-phrase
pages -- is build_pages.py's, untouched). A stay with no verified link yet (still thin, nothing
to show but the bare listing) stays in sitemap-stays.xml, separate on purpose: if Google or
AdSense ever flags these pages as low-value again, that file alone can be throttled or
noindexed without touching the main sitemap's established pages (see docs/ARCHITECTURE.md
"Listing sitemap"). A stay's own `<lastmod>` and which file it's in both move together the
moment its booking-link status changes -- re-run this script, nothing else.

<lastmod> is honest, like page_dates.py: listing-dates.tsv (committed) keeps, per
<city>/<slug>, a fingerprint of the stay's record (name, area, type, rating, price,
facilities, booking links, ...) and the date that fingerprint first appeared. The date moves
only when the record changes, never because the pages were rebuilt, so search engines keep
trusting it and IndexNow (scripts/indexnow.mjs) pings only the stays that really changed.
The registry covers every stay regardless of which sitemap file currently lists it.

Our own stays (STAYS_OWN) are not listed by this script at all: they have their own hand-made
pages, already in sitemap.xml outside this marker block.

Usage: node scripts/py.mjs scripts/stays/listing_sitemap.py [--check]
  --check   write nothing; exit 1 when either sitemap, or listing-dates.tsv, is out of date.
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
MAIN_SITEMAP = os.path.join(ROOT, 'sitemap.xml')
# Same `<!-- name:start/end -->` convention build_pages.py's own per-city sitemap.xml markers use
# (ensure_markers/replace_between there); this one is script-wide, not per-city, and owned here.
MARKER_START = '  <!-- finalised-stays:start -->'
MARKER_END = '  <!-- finalised-stays:end -->'
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


def _urlset(rows):
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, date in rows:
        xml.append(f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{date}</lastmod>\n  </url>')
    xml.append('</urlset>')
    return '\n'.join(xml) + '\n'


def build():
    """-> (thin-stays sitemap text, finalised-stays marker block text, registry text) for today's data modules.

    A stay with a verified booking link (`o`, non-empty) is "finalised" -> its <url> goes into the
    marker block merged into the main sitemap.xml; everything else -> sitemap-stays.xml, same as before."""
    old = load_registry()
    thin_rows, final_rows, reg = [], [], []
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
            row = (url_for(city, slug), date)
            (final_rows if s.get('o') else thin_rows).append(row)
    total = len(thin_rows) + len(final_rows)
    if total > LIMIT:
        raise SystemExit(f'{total} stays: over the {LIMIT} URLs one sitemap file may hold; split it into a sitemap index')
    thin_rows.sort()
    final_rows.sort()
    reg.sort()
    registry = 'key\tdigest\tlastmod\n' + ''.join(f'{k}\t{d}\t{dt}\n' for k, d, dt in reg)
    return _urlset(thin_rows), final_rows, registry


def _merge_main_sitemap(final_rows):
    """Replaces this script's own <!-- finalised-stays:start/end --> block inside sitemap.xml (adding
    it right before </urlset> the first time, same as build_pages.py's per-city markers there) with
    today's finalised-stay <url>s. Everything else in the file -- category/landmark/search-phrase
    pages, each city's own marker block -- is build_pages.py's and untouched."""
    cur = open(MAIN_SITEMAP, encoding='utf-8').read() if os.path.exists(MAIN_SITEMAP) else None
    if cur is None:
        raise SystemExit('sitemap.xml does not exist: run build_pages.py first (it owns the rest of the file)')
    if MARKER_START not in cur:
        cur = cur.replace('</urlset>', f'{MARKER_START}\n{MARKER_END}\n</urlset>', 1)
    block = '\n'.join(f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>{date}</lastmod>\n  </url>' for loc, date in final_rows)
    before_text = open(MAIN_SITEMAP, encoding='utf-8').read() if os.path.exists(MAIN_SITEMAP) else ''
    before = cur[:cur.index(MARKER_START)]
    after = cur[cur.index(MARKER_END) + len(MARKER_END):]
    new = f'{before}{MARKER_START}\n{block}\n{MARKER_END}{after}'
    return before_text, new


def main():
    check = '--check' in sys.argv
    thin_xml, final_rows, registry = build()
    cur_thin = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
    cur_reg = open(REGISTRY, encoding='utf-8').read() if os.path.exists(REGISTRY) else ''
    cur_main, new_main = _merge_main_sitemap(final_rows)
    n_thin, n_final = thin_xml.count('<url>'), len(final_rows)
    if check:
        if cur_thin != thin_xml or cur_reg != registry or cur_main != new_main:
            print(f'sitemap-stays.xml / sitemap.xml / listing-dates.tsv are out of date ({n_thin} thin, {n_final} finalised): run node scripts/py.mjs scripts/stays/listing_sitemap.py')
            sys.exit(1)
        print(f'sitemap-stays.xml and sitemap.xml are current ({n_thin} thin, {n_final} finalised)')
        return
    old = load_registry()
    new = {line.split('\t')[0]: line.split('\t')[1:] for line in registry.splitlines()[1:]}
    added = sum(k not in old for k in new)
    removed = sum(k not in new for k in old)
    changed = sum(k in old and old[k][0] != v[0] for k, v in new.items())
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(thin_xml)
    with open(MAIN_SITEMAP, 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_main)
    with open(REGISTRY, 'w', encoding='utf-8', newline='\n') as f:
        f.write(registry)
    print(f'sitemap-stays.xml: {n_thin} thin stays. sitemap.xml: {n_final} finalised stays (verified booking link). ({added} new, {changed} changed, {removed} removed, registry-wide)')


if __name__ == '__main__':
    main()
