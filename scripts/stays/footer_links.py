"""Footer "Stays in Rishikesh" / "Stays in Haridwar" links on every page.

One wrapped line of links per city (like a travel site's "Hotels in ..." block):
every best-<category>-in-<city> page that exists, as "Best <title> in <City>",
in the order of the category filters (all stays first, then each group by size),
then the search-phrase pages (search_pages.py) in the searcher's own words.
Then one section per generated page family (FAMILIES below: rentals, driving guides), found on disk by file
name: a new page of a known family (a new city, a new vehicle) shows in every footer by itself; a new kind of
family is one more FAMILIES entry. A section longer than FOLD_AFTER links folds its tail behind a "More" toggle
(the same CSS-only toggle as the stays searches, so phones stay short and crawlers still see every link). The block sits between <!-- footer-stays --> markers in every root and hotels/
page; the first run replaces the old short "Stays in <city>" footer columns.
build_pages.py runs this after every build, so a new category shows up in every
footer. Usage: python3 scripts/stays/footer_links.py
"""
import glob
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import CITIES, DEFAULT_CITY  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
START, END = '<!-- footer-stays -->', '<!-- /footer-stays -->'
FOLD_AFTER = 12  # links a section shows before "More"
# Generated page families found by file name (root *.html). `files` has named groups; `group` names the one
# that splits the family into sections, `heading`/`label` are formatted from the groups (slugs title-cased),
# `order` lists a group's values in the order they should appear (the rest follow alphabetically).
FAMILIES = [
    dict(key='rentals', files=r'(?P<kind>bike|car|taxi)-rental-in-(?P<place>[a-z-]+)', group='place',
         heading='Rentals in {place}', label='{kind} rental in {place}', order={'kind': ['bike', 'car', 'taxi']}),
    dict(key='drives', files=r'driving-from-(?P<city>[a-z-]+)-to-(?P<dest>[a-z-]+)', group='dest',
         heading='Driving to {dest}', label='{city} to {dest}', order={'city': ['delhi']}),
]


def pretty(slug):
    return ' '.join(w.capitalize() for w in slug.split('-'))


def family_sections(fam):
    """[(group value, heading, [(href, label)])] for one family, from the pages that exist."""
    rx = re.compile(fam['files'] + r'\.html$')
    pages = []
    for path in glob.glob(os.path.join(ROOT, '*.html')):
        m = rx.match(os.path.basename(path))
        if m:
            pages.append(m.groupdict() | {'stem': os.path.basename(path)[:-5]})
    rank = lambda key, v: (fam['order'][key].index(v) if v in fam.get('order', {}).get(key, []) else 99, v)
    place_order = list(CITIES) + sorted({p[fam['group']] for p in pages} - set(CITIES))
    out = []
    for g in [g for g in place_order if any(p[fam['group']] == g for p in pages)]:
        mine = [p for p in pages if p[fam['group']] == g]
        mine.sort(key=lambda p: tuple(rank(k, p[k]) for k in fam.get('order', {}) if k in p) + (p['stem'],))
        pretty_vals = lambda p: {k: pretty(v) for k, v in p.items() if k != 'stem'}
        out.append((g, fam['heading'].format(**pretty_vals(mine[0])), [(f'/{p["stem"]}', fam['label'].format(**pretty_vals(p))) for p in mine]))
    return out


def city_pages(city):
    """([(href, text)] category pages in filter order, [(href, text)] search-phrase pages)."""
    module = 'stays-index-data.js' if city == DEFAULT_CITY else f'stays-index-data-{city}.js'
    path = os.path.join(ROOT, 'assets', 'js', 'modules', module)
    if not os.path.exists(path):
        return [], []
    meta = json.loads(re.search(r'export const STAYS_INDEX_META = (\{.*?\});\n', open(path).read()).group(1))
    cats = [c for c in meta['categories'] if os.path.exists(os.path.join(ROOT, 'hotels', f'best-{c["slug"]}-in-{city}.html'))]
    order = [c for c in cats if c['filter'] == 'all']
    for key, _label in meta['groups']:
        order += sorted((c for c in cats if c['group'] == key and c['filter'] != 'all'), key=lambda c: (-c['count'], c['title']))
    order += [c for c in cats if c not in order]
    name = CITIES[city]['name']
    links = [(f'/hotels/best-{c["slug"]}-in-{city}', f'Best {"Hotels" if c["filter"] == "all" else c["title"]} in {name}') for c in order]
    # then the pages for phrases people search (search_pages.py), in the searcher's own words
    searches = [(f'/hotels/{x["stem"]}', x['h1']) for x in meta.get('searches', [])
                if os.path.exists(os.path.join(ROOT, 'hotels', f'{x["stem"]}.html'))]
    return links, searches


def block():
    parts = [START, '    <div class="rhs-footer-stays">']
    lis = lambda links: ''.join(f'<li><a href="{h}">{html.escape(t)}</a></li>' for h, t in links)
    for city in CITIES:
        links, searches = city_pages(city)
        if not links:
            continue
        name = html.escape(CITIES[city]['name'])
        parts.append(f'      <div class="rhs-footer-city-links">\n      <h3>Stays in {name}</h3>')
        parts.append(f'      <ul>{lis(links)}</ul>')
        if searches:
            # phones: the search-phrase pages fold behind "More ... searches" (a CSS-only toggle, so the
            # links stay in the HTML for crawlers); wider screens always show them
            parts.append(f'      <input type="checkbox" id="rhs-more-{city}" class="rhs-more-toggle">'
                         f'<label for="rhs-more-{city}" class="rhs-more-label">More {name} searches ({len(searches)})</label>')
            parts.append(f'      <ul class="rhs-more">{lis(searches)}</ul>')
        parts.append('      </div>')
    # then every page family found on disk (rentals, driving guides): one section per group
    for fam in FAMILIES:
        for g, heading, links in family_sections(fam):
            parts.append(f'      <div class="rhs-footer-city-links">\n      <h3>{html.escape(heading)}</h3>')
            shown, more = links[:FOLD_AFTER], links[FOLD_AFTER:]
            parts.append(f'      <ul>{lis(shown)}</ul>')
            if more:
                tid = f'rhs-more-{fam["key"]}-{g}'
                parts.append(f'      <input type="checkbox" id="{tid}" class="rhs-more-toggle">'
                             f'<label for="{tid}" class="rhs-more-label">More ({len(more)})</label>')
                parts.append(f'      <ul class="rhs-more">{lis(more)}</ul>')
            parts.append('      </div>')
    parts += ['    </div>', '    ' + END]
    return '\n'.join(parts)


def grid_end(s):
    """Index just after the </div> that closes <div class="rhs-footer-grid">."""
    i = s.find('<div class="rhs-footer-grid">')
    if i < 0:
        return -1
    depth, pos = 0, i
    for m in re.finditer(r'<div\b|</div>', s[i:]):
        depth += 1 if m.group(0) == '<div' else -1
        if depth == 0:
            return i + m.end()
    return -1


def write_footers():
    new, changed = block(), 0
    for path in sorted(glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, 'hotels', '*.html'))):
        s = open(path).read()
        if START in s and END in s:
            out = s[:s.index(START)] + new + s[s.index(END) + len(END):]
        else:
            # first run: drop the old short "Stays in <city>" columns, put the full block under the grid
            s2 = re.sub(r'\s*<div class="rhs-footer-column rhs-footer-city">.*?</div>', '', s, flags=re.S)
            at = grid_end(s2)
            if at < 0:
                continue
            out = s2[:at] + '\n    ' + new + s2[at:]
        if out != s:
            open(path, 'w').write(out)
            changed += 1
    print(f'footer stays links: {changed} page(s) updated')


if __name__ == '__main__':
    write_footers()
