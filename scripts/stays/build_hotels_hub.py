"""The /hotels hub: every stays category across every city on one page, with a
filter bar (All Cities, or one city at a time — plain CSS/JS show-hide, every
link stays in the HTML so crawlers see all of it). Built so the footer on
every other page (footer_links.py) can stay short and point here instead of
dumping every category link on every page.

Usage: python3 scripts/stays/build_hotels_hub.py (build_pages.py / footer_links.py
call this after every city build, so it is always in step with the data
modules). Reads the same STAYS_INDEX_META the footer and category pages read;
never hand-edit assets/js/modules/stays-index-data*.js or hotels/index.html.
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import CITIES, DEFAULT_CITY  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
esc = html.escape


def city_data(city):
    """None, or (total_count, [(group_key, group_label, [cat...])], [search...]) for one city."""
    module = 'stays-index-data.js' if city == DEFAULT_CITY else f'stays-index-data-{city}.js'
    path = os.path.join(ROOT, 'assets', 'js', 'modules', module)
    if not os.path.exists(path):
        return None
    meta = json.loads(re.search(r'export const STAYS_INDEX_META = (\{.*?\});\n', open(path, encoding='utf8').read()).group(1))
    cats = [c for c in meta['categories'] if os.path.exists(os.path.join(ROOT, 'hotels', f'best-{c["slug"]}-in-{city}.html'))]
    total = next((c['count'] for c in cats if c['filter'] == 'all'), 0)
    groups = []
    for key, label in meta['groups']:
        mine = sorted((c for c in cats if c['group'] == key), key=lambda c: (-c['count'], c['title']))
        if mine:
            groups.append((key, label, mine))
    searches = [{**x, 'exists': os.path.exists(os.path.join(ROOT, 'hotels', f'{x["stem"]}.html'))} for x in meta.get('searches', [])]
    searches = [x for x in searches if x['exists']]
    return total, groups, searches


def top_categories(city, n=4):
    """[(slug, title)] the n biggest non-"all" categories, for footer teasers.
    Homestays always comes first when the city has one (owner, 2026-10-08),
    then the rest by listing count."""
    data = city_data(city)
    if not data:
        return []
    _total, groups, _searches = data
    all_cats = sorted((c for _k, _l, cats in groups for c in cats), key=lambda c: -c['count'])
    homestays = [c for c in all_cats if c['slug'] == 'homestays']
    rest = [c for c in all_cats if c['slug'] != 'homestays']
    ordered = (homestays + rest)[:n]
    return [(c['slug'], c['title']) for c in ordered]


def city_section(city):
    data = city_data(city)
    if not data:
        return ''
    total, groups, searches = data
    name = esc(CITIES[city]['name'])
    hub_url = '/homestays' if city == DEFAULT_CITY else f'/hotels/{city}-accommodation'
    parts = [f'      <section class="stays-hub-city" data-city="{city}">',
             f'        <h2><a href="{hub_url}">{name}</a> <span class="stays-hub-count">{total:,} stays</span></h2>']
    for key, label, cats in groups:
        if key == 'type':  # homestays first (owner, 2026-10-08), rest by listing count
            cats = [c for c in cats if c['slug'] == 'homestays'] + [c for c in cats if c['slug'] != 'homestays']
        items = ''.join(
            f'<li><a href="/hotels/best-{c["slug"]}-in-{city}">{esc("Hotels" if c["filter"] == "all" else c["title"])} '
            f'<span class="stays-hub-n">({c["count"]:,})</span></a></li>' for c in cats)
        parts.append(f'        <div class="stays-hub-group"><h3>{esc(label)}</h3><ul>{items}</ul></div>')
    if searches:
        items = ''.join(f'<li><a href="/hotels/{x["stem"]}">{esc(x["h1"])}</a></li>' for x in searches)
        parts.append(f'        <div class="stays-hub-group"><h3>Popular searches</h3><ul>{items}</ul></div>')
    parts.append('      </section>')
    return '\n'.join(parts)


def main_html():
    buttons = ['<button type="button" class="stays-hub-tab is-active" data-city="all">All Cities</button>']
    sections = []
    for city in CITIES:
        if not city_data(city):
            continue
        buttons.append(f'<button type="button" class="stays-hub-tab" data-city="{city}">{esc(CITIES[city]["name"])}</button>')
        sections.append(city_section(city))
    return (
        '      <h1>All Hotels</h1>\n'
        '      <p class="stays-hub-intro">Every hotel, homestay and stay category across Rishikesh, Haridwar, '
        'Dehradun and Mussoorie on one page. Browse all of it, or filter to one city.</p>\n'
        f'      <div class="stays-hub-filter" role="tablist" aria-label="Filter by city">{"".join(buttons)}</div>\n'
        '      <div class="stays-hub-cities">\n' + '\n'.join(sections) + '\n      </div>\n'
    )


def write_hub():
    shell = open(f'{ROOT}/thanks.html', encoding='utf8').read()
    top, rest = shell.split('<main>', 1)
    bottom = rest.split('</main>', 1)[1]
    desc = 'Browse every hotel, homestay and stay category across Rishikesh, Haridwar, Dehradun and Mussoorie on one page, filterable by city.'
    top = (top.replace('<meta name="robots" content="noindex, follow">\n    ', '')
              .replace('<title>Thanks | Rishikesh Homestays</title>',
                        f'<title>All Hotels in Rishikesh, Haridwar, Dehradun &amp; Mussoorie</title>\n'
                        f'    <meta name="description" content="{esc(desc)}">')
              .replace('https://rishikeshhomestays.com/thanks', 'https://rishikeshhomestays.com/hotels'))
    bottom = bottom.replace(
        '    <script type="module" src="/assets/js/site.js"></script>\n',
        '    <script type="module" src="/assets/js/site.js"></script>\n'
        '    <script type="module" src="/assets/js/modules/hotels-hub.js"></script>\n', 1)
    out = top + '    <main>\n' + main_html() + '    </main>\n' + bottom
    # a root-level hotels.html, not hotels/index.html: the URL must equal the file path 1:1
    # (cleanUrls maps /hotels -> hotels.html, the same way /homestays -> homestays.html; a
    # directory index broke this convention once before and 404'd in production).
    open(f'{ROOT}/hotels.html', 'w', encoding='utf8', newline='\n').write(out)
    print('stays hub: wrote /hotels (hotels.html)')


if __name__ == '__main__':
    write_hub()
