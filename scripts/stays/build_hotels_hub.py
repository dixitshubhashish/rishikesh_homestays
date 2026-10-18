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


ABOUT_HTML = (
    '      <section class="stays-hub-about">\n'
    '        <h2>How to use this hotel directory</h2>\n'
    '        <p>This page lists every stay category we cover for Rishikesh, Haridwar, Dehradun and Mussoorie. Each category page, such as homestays, apartments, resorts, guest houses or Ganga view stays, opens a list of places with a short description and a link to a booking page we have checked. The counts next to each name show how many stays sit in that category today.</p>\n'
    '        <p>We run three stays ourselves, and they are shown first on the Rishikesh and Haridwar lists. Advaitam is a three bedroom family stay in Nirmal Bagh near the Ganges, with a balcony, a kitchen, parking and cafes within walking distance. Elysium is a villa in Nirmal Bagh with Himalayan and Ganga views, a kitchen, parking and room for morning yoga. Yoga Retreat at the Ganges is a quiet stay near the Veerbhadra Temple and AIIMS with private rooms, vegetarian meals and spaces for sunrise practice. After our own stays come the other stays that have a verified booking page. The order is not a review ranking, and some booking links earn us a commission at no extra cost to you. You can read how this works on our <a href="/about-us">About us</a> page.</p>\n'
    '        <p>Rishikesh stays on this site cover areas such as Tapovan, Ganga Barrage, Veerbhadra Temple, Nirmal Bagh near the Ganges, AIIMS Rishikesh, Triveni Ghat, Neelkanth Road, Bypass Road, Nepali Farm, Muni Ki Reti and Swarg Ashram, so you can pick the part of town that suits your plans. Haridwar is about 25 km downstream, and many guests combine the two towns.</p>\n'
    '        <p>Not sure which category fits? Tell us your dates, group size and what matters most, whether that is a view, a kitchen, parking or a quiet lane, and we will suggest suitable stays. Use the <a href="/contact">contact page</a> or read our <a href="/places-to-visit">places to visit</a> and <a href="/things-to-do-in-rishikesh">things to do</a> guides first. Our <a href="/privacy-policy">privacy policy</a> and <a href="/terms">terms</a> explain how we handle your details and what we are responsible for.</p>\n'
    '      </section>\n'
)

# Popular searches shown on the hub: only these cities, only these phrase pages (RH-BUG-13)
POPULAR = {'rishikesh': ['{c}-accommodation', 'cheap-homestays-in-{c}', 'luxury-stays-in-{c}', 'place-to-stay-in-{c}'],
           'haridwar': ['{c}-accommodation', 'cheap-homestays-in-{c}', 'luxury-stays-in-{c}', 'place-to-stay-in-{c}']}


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
    want = [w.format(c=city) for w in POPULAR.get(city, [])]
    searches = [x for w in want for x in searches if x['stem'] == w]
    if searches:
        items = ''.join(f'<li><a href="/hotels/{x["stem"]}">{esc(x["h1"])}</a></li>' for x in searches)
        parts.append(f'        <div class="stays-hub-group"><h3>Popular searches</h3><ul>{items}</ul></div>')
    parts.append('      </section>')
    return '\n'.join(parts)


def families_html():
    """Rentals and driving guides found on disk by file name (footer_links.FAMILIES): shown here only."""
    from footer_links import FAMILIES, family_sections
    parts = []
    for fam in FAMILIES:
        for _g, heading, links in family_sections(fam):
            items = ''.join(f'<li><a href="{h}">{esc(t)}</a></li>' for h, t in links)
            parts.append(f'        <div class="stays-hub-group"><h3>{esc(heading)}</h3><ul>{items}</ul></div>')
    if not parts:
        return ''
    return ('      <section class="stays-hub-more">\n        <h2>Getting around</h2>\n'
            + '\n'.join(parts) + '\n      </section>\n')


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
        + ABOUT_HTML +
        f'      <div class="stays-hub-filter" role="tablist" aria-label="Filter by city">{"".join(buttons)}</div>\n'
        '      <div class="stays-hub-cities">\n' + '\n'.join(sections) + '\n      </div>\n'
        + families_html()
    )


def write_hub():
    shell = open(f'{ROOT}/thanks.html', encoding='utf8').read()
    top, rest = shell.split('<main>', 1)
    bottom = rest.split('</main>', 1)[1]
    desc = 'Browse every hotel, homestay and stay category across Rishikesh, Haridwar, Dehradun and Mussoorie on one page, filterable by city.'
    top = (re.sub(r'<meta name="robots" content="noindex,\s*follow">\n\s*', '', top)
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
