"""Footer "Stays in Rishikesh" / "Stays in Haridwar" links on every page.

One wrapped line of links per city (like a travel site's "Hotels in ..." block):
every best-<category>-in-<city> page that exists, as "Best <title> in <City>",
in the order of the category filters (all stays first, then each group by size),
then the search-phrase pages (search_pages.py) in the searcher's own words.
The block sits between <!-- footer-stays --> markers in every root and hotels/
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
