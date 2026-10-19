"""Footer "Stays" block on every page: a short teaser (owner, 2026-10-08 — the
old footer dumped every best-<category>-in-<city> link on every page, four
cities deep, and made the footer enormous even on desktop). Now: one line per
city with its top few categories by listing count, plus "Browse all hotels ->"
to /hotels (scripts/stays/build_hotels_hub.py), which has the full depth with a
city filter. Then one section per generated page family (FAMILIES below:
rentals, driving guides), found on disk by file name: a new page of a known
family (a new city, a new vehicle) shows in every footer by itself; a new kind
of family is one more FAMILIES entry. Each group is a <details> (owner, 2026-10-19). The block sits between <!-- footer-stays -->
markers in every root and hotels/ page.
build_pages.py runs this after every build, so a new category shows up in
every footer and in /hotels. Usage: python3 scripts/stays/footer_links.py
"""
import glob
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import CITIES, DEFAULT_CITY  # noqa: E402
import build_hotels_hub  # noqa: E402

# Single source of truth for the "Made with..." footer line (owner, 2026-10-08: stop hand-editing
# this across 538 files for one line of text — change it here, then re-run this script, same as
# every other footer piece). Swept into every root and hotels/ page's existing
# <div class="rhs-footer-made">...</div>, hand-made pages included.
FOOTER_MADE = 'Made with ❤️ (and a little chai) in India, from the \U0001f9d8 yoga capital of the world \U0001f30d'

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
START, END = '<!-- footer-stays -->', '<!-- /footer-stays -->'
TOP_N = 20  # categories shown inline per city in the Stays group
# Generated page families found by file name (root *.html). `files` has named groups; `group` names the one
# that splits the family into sections, `heading`/`label` are formatted from the groups (slugs title-cased),
# `order` lists a group's values in the order they should appear (the rest follow alphabetically).
FAMILIES = [
    dict(key='rentals', group_title='Rentals', files=r'(?P<kind>bike|car|taxi)-rental-in-(?P<place>[a-z-]+)', group='place',
         heading='Rentals in {place}', label='{kind} rental in {place}', order={'kind': ['bike', 'car', 'taxi']}),
    dict(key='drives', group_title='Driving guides', files=r'driving-from-(?P<city>[a-z-]+)-to-(?P<dest>[a-z-]+)', group='dest',
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


def block():
    """Footer link block, organised in collapsible groups (owner, 2026-10-19: organise, never remove).
    Stays (each city's top categories), Rentals and Driving guides (every page found on disk, one
    section per city), then the site links (about, contact, privacy, terms). Groups are <details>, so
    the footer stays short but every link is in the HTML. RH-BUG-13 had cut this to one list; restored."""
    lis = lambda links: ''.join(f'<li><a href="{h}">{html.escape(t)}</a></li>' for h, t in links)
    parts = [START, '    <div class="rhs-footer-stays">']
    teaser_lines = []
    for city in CITIES:
        top = build_hotels_hub.top_categories(city, TOP_N)
        if not top:
            continue
        name = html.escape(CITIES[city]['name'])
        hub_url = '/homestays' if city == DEFAULT_CITY else f'/hotels/{city}-accommodation'
        cats = ', '.join(f'<a href="/hotels/best-{slug}-in-{city}">Best {html.escape(title)} in {name}</a>' for slug, title in top)
        teaser_lines.append(f'<li><a href="{hub_url}"><strong>{name}</strong></a>: {cats}</li>')
    if teaser_lines:
        parts.append('      <details class="rhs-footer-group"><summary>Stays</summary>')
        parts.append(f'      <ul class="rhs-footer-stays-teaser">{"".join(teaser_lines)}</ul>')
        parts.append('      <p class="rhs-footer-stays-all"><a href="/hotels">Browse all hotels by category and city &rarr;</a></p>')
        parts.append('      </details>')
    for fam in FAMILIES:
        secs = family_sections(fam)
        if not secs:
            continue
        parts.append(f'      <details class="rhs-footer-group"><summary>{html.escape(fam["group_title"])}</summary>')
        parts.append('      <div class="rhs-footer-group-grid">')
        for g, heading, links in secs:
            parts.append(f'      <div class="rhs-footer-city-links">\n      <h3>{html.escape(heading)}</h3>')
            parts.append(f'      <ul>{lis(links)}</ul>')
            parts.append('      </div>')
        parts.append('      </div>\n      </details>')
    site = [('/about-us', 'About us'), ('/contact', 'Contact'), ('/privacy-policy', 'Privacy policy'), ('/terms', 'Terms')]
    parts.append(f'      <ul class="rhs-footer-site">{lis(site)}</ul>')
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


MADE_RE = re.compile(r'(<div class="rhs-footer-made">)(.*?)(</div>)', re.S)
FOOTER_RE = re.compile(r'(\s*)<footer class="rhs-footer">.*?</footer>', re.S)


def write_footers():
    new, changed, made_changed = block(), 0, 0
    pages = sorted(glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, 'hotels', '*.html')))
    for path in pages:
        s = open(path, encoding='utf8').read()
        if START in s and END in s:
            out = s[:s.index(START)] + new + s[s.index(END) + len(END):]
        else:
            # first run: drop the old short "Stays in <city>" columns, put the full block under the grid
            s2 = re.sub(r'\s*<div class="rhs-footer-column rhs-footer-city">.*?</div>', '', s, flags=re.S)
            at = grid_end(s2)
            if at < 0:
                continue
            out = s2[:at] + '\n    ' + new + s2[at:]
        out2 = MADE_RE.sub(lambda m: f'{m.group(1)}\n                {html.escape(FOOTER_MADE)}\n            {m.group(3)}', out)
        if out2 != out:
            made_changed += 1
        out = out2
        if out != s:
            open(path, 'w', encoding='utf8', newline='\n').write(out)
            changed += 1
    # The whole <footer>...</footer> is one canonical block from here on (owner, 2026-10-08:
    # "import footer and it have all necessary info always" — stop hand-editing footer HTML on
    # any page; change this file, or thanks.html's footer, then re-run this script). thanks.html's
    # footer (now carrying the up-to-date stays block and "made with" line from the pass above) is
    # the single source; every other root and hotels/ page's footer is swept to match it exactly.
    m = FOOTER_RE.search(open(os.path.join(ROOT, 'thanks.html'), encoding='utf8').read())
    footer_changed = 0
    if m:
        # lstrip() all leading whitespace: group(0) starts with thanks.html's own indentation, and each page's
        # own indentation is kept by mm.group(1) below; keeping both added thanks.html's indent again on every run.
        canon = m.group(0).lstrip()
        for path in pages:
            if path.endswith(f'{os.sep}thanks.html') or path.endswith('/thanks.html'):
                continue
            s = open(path, encoding='utf8').read()
            out = FOOTER_RE.sub(lambda mm: mm.group(1) + canon, s, count=1)
            if out != s:
                open(path, 'w', encoding='utf8', newline='\n').write(out)
                footer_changed += 1
    print(f'footer stays links: {changed} page(s) updated, "made with" line updated on {made_changed}, whole footer synced on {footer_changed}')
    build_hotels_hub.write_hub()


if __name__ == '__main__':
    write_footers()
