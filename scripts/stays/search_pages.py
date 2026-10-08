"""Pages for the searches people type into Google ("cheap homestays in Rishikesh",
"Rishikesh hotels near Ganga", ...), collated from Google's related searches
(owner, 2026-10-04). Each unique phrase gets its own page whose address and
headline are the phrase itself (owner: keep the searcher's wording), for
Rishikesh and, where it makes sense, Haridwar. Exact repeats (same words,
singular/plural, word order) share one page.

A page is one row of search-pages.tsv: the phrase ({City} = the city name), what
it lists (a small rule language, mirrored in assets/js/modules/stays-index.js so
the page's own filters keep working), how the list is grouped, and a one-line
intro. build_pages.py renders them with the category-page template. A phrase
for several cities (cities column: both = every city, or keys joined with a comma)
gets a page in each as soon as any of them has MIN_PAGE stays
for it (owner, 2026-10-05: the city switch always lands on the same page); a
city with fewer lists what it has plus the nearest alternatives. page_content()
adds the page's own guidance, facts and FAQs. Add a phrase: add a row, rebuild.

Rules, joined with " & " (all must hold):
  home | hotel | resort | resortcamp | entire     kind of stay (sets below)
  priced | price<N | price<=N                     starting price per night
  river | gangaview | family | kitchen | pool | luxury | wedding | oyo | linked
  stars=N | stars>=N | area:<Area> | near:<landmark>:<km> | kind:<one kind, e.g. Homestays>
  top10   the 10 best guest scores (TOP_MIN_REVIEWS reviews or more), ranked; a page needs all 10
Group: '' one list | 'a' by area | 's' by stars | 'k' by type | 'pb' by price | 'c' like the main page
"""
import math
import os
import re

HOME = {'Homestays', 'Guest houses', 'B&Bs', 'Holiday rentals', 'Apartments', 'Cottages', 'Villas'}
HOTEL = {'Hotels', 'Resorts', 'Aparthotels', 'Lodges'}
ENTIRE = {'Apartments', 'Holiday rentals', 'Villas', 'Cottages', 'Homestays'}
KINDS = {'home': HOME, 'hotel': HOTEL, 'resort': {'Resorts'}, 'resortcamp': {'Resorts', 'Camps & tents'}, 'entire': ENTIRE,
         'camp': {'Camps & tents'}}  # a kind with " & " in its name needs an alias (rules split on " & ")
# Areas on or next to the Ganga (a stay counts as "near the river" here or with the Ganga-view tag).
RIVER_AREAS = {
    'rishikesh': ['Tapovan', 'Laxman Jhula', 'Ram Jhula', 'Swarg Ashram', 'Muni Ki Reti', 'Triveni Ghat',
                  'Nirmal Bagh near Ganges', 'Shivpuri & rafting belt'],
    'haridwar': ['Har Ki Pauri', 'Bhupatwala', 'Kharkhari', 'Shantikunj & Saptrishi', 'Upper Road & Mayapur', 'Kankhal'],
    'dehradun': [],   # not on the Ganga: the river phrases are not made for the hill-side cities
    'mussoorie': [],
}
OYO = re.compile(r'\b(oyo|townhouse|capital o|collection o|spot on|flagship|silverkey|hotel o)\b', re.I)
PRICE_BANDS = [(1000, 'Under ₹1,000'), (2000, '₹1,000 to ₹2,000'), (3000, '₹2,000 to ₹3,000'), (5000, '₹3,000 to ₹5,000'), (None, '₹5,000 and up')]

# The phrases live in search-pages.tsv (one row each: phrase, rule, group, cities, intro), so adding a
# search is adding a row. {City} is the city's name; a phrase naming a Rishikesh landmark is Rishikesh-only.
from cities import CITIES  # noqa: E402
ALL_CITIES = tuple(CITIES)   # the 'both' value of the cities column means every registered city
TOP_MIN_REVIEWS = 5  # "Top 10": ranked by real guest score among stays with at least this many reviews
_TSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'search-pages.tsv')


def load_pages(path=_TSV):
    """(rows, twins): rows (phrase, rule, group, intro, cities); twins {one-city phrase: other city's phrase}."""
    rows, twins = [], {}
    for line in open(path, encoding='utf8'):
        if line.startswith('#') or line.startswith('phrase\t') or not line.strip():
            continue
        phrase, rule, group, cities, intro, twin = (line.rstrip('\n').split('\t') + [''] * 6)[:6]
        # cities: 'both' (every city), one key, or several keys joined with a comma (e.g. rishikesh,haridwar)
        rows.append((phrase, rule, group, intro, ALL_CITIES if cities == 'both' else tuple(c for c in cities.split(',') if c)))
        for c in rows[-1][4]:
            assert c in CITIES, f'search-pages.tsv: unknown city {c!r} in row {phrase!r}'
        if twin:
            twins[phrase] = twin
    return rows, twins


PAGES, TWINS = load_pages()

SMALL = {'in', 'at', 'near', 'with', 'for', 'and', 'under', 'of', 'the'}


def heading(phrase, city_name):
    return phrase.replace('{City}', city_name)


def path(phrase, city_name):
    return re.sub(r'[^a-z0-9]+', '-', heading(phrase, city_name).lower()).strip('-')


def twin_of(phrase, other_name):
    """The other city's heading for a page: the twin column of a one-city phrase, else the same phrase there."""
    if phrase in TWINS:   # a literal phrase, or a {City} row of the other city
        return heading(TWINS[phrase], other_name)
    return heading(phrase, other_name) if '{City}' in phrase else None


def pages_for(city):
    """[(h1, file stem, rule, group, intro)] for one city."""
    from cities import CITIES
    name = CITIES[city]['name']
    return [(heading(p, name), path(p, name), rule.replace('{city}', city), group, intro.replace('{City}', name))
            for p, rule, group, intro, cities in PAGES if city in cities]


def km(a, b):
    r = math.radians
    d = math.sin(r(b[0] - a[0]) / 2) ** 2 + math.cos(r(a[0])) * math.cos(r(b[0])) * math.sin(r(b[1] - a[1]) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(d))


def rule_matches(stay, rule, city, landmarks):
    """landmarks: {slug: (lat, lng)}. Mirrors ruleMatches() in stays-index.js."""
    for cond in [c.strip() for c in rule.split(' & ')]:
        if cond == 'any':
            continue
        if cond in KINDS:
            if not set(stay['ks']) & KINDS[cond]:
                return False
            continue
        m = re.fullmatch(r'price(<=|<)(\d+)', cond)
        if m:
            p = stay.get('p')
            if not p or not (p <= int(m.group(2)) if m.group(1) == '<=' else p < int(m.group(2))):
                return False
            continue
        m = re.fullmatch(r'stars(>=|=)(\d)', cond)
        if m:
            s = stay.get('s') or 0
            if not (s >= int(m.group(2)) if m.group(1) == '>=' else s == int(m.group(2))):
                return False
            continue
        if cond.startswith('kind:'):
            if cond[5:] not in stay['ks']:
                return False
            continue
        if cond == 'top10':  # the ranking itself is select()
            continue
        if cond.startswith('area:'):
            if stay.get('a') != cond[5:]:
                return False
            continue
        if cond.startswith('near:'):
            _, slug, dist = cond.split(':')
            if not stay.get('ll') or slug not in landmarks or km(stay['ll'], landmarks[slug]) > float(dist):
                return False
            continue
        ok = {
            'priced': lambda: bool(stay.get('p')),
            'river': lambda: 'ganga' in stay['t'] or stay.get('a') in RIVER_AREAS.get(city, []),
            'gangaview': lambda: 'ganga' in stay['t'],
            'family': lambda: 'family' in stay['t'] or 'pool' in stay['t'] or (stay.get('bd') or 0) >= 2
                              or bool(set(stay['ks']) & {'Resorts', 'Villas', 'Holiday rentals'}),
            'kitchen': lambda: 'kitchen' in stay['t'],
            'pool': lambda: 'pool' in stay['t'],
            'luxury': lambda: 'luxury' in stay['t'],
            'wedding': lambda: 'Meeting/ Banquet facilities' in stay.get('f', [])
                               or ('Resorts' in stay['ks'] and 'Garden area' in stay.get('f', [])),
            'oyo': lambda: bool(OYO.search(stay['n'])),
            'linked': lambda: 'o' in stay,
        }.get(cond)
        if ok is None:
            raise ValueError(f'unknown search-page rule: {cond}')
        if not ok():
            return False
    return True


def select(stays, rule):
    """Stays matching a page's rule, in page order; a top-10 page keeps its 10 best guest scores, ranked."""
    if 'top10' not in [c.strip() for c in rule.split(' & ')]:
        return stays
    rated = [d for d in stays if d.get('g') and (d.get('c') or 0) >= TOP_MIN_REVIEWS]
    return sorted(rated, key=lambda d: (-d['g'], -(d.get('c') or 0), d['n']))[:10]


def price_band(p):
    for cap, label in PRICE_BANDS:
        if cap is None or p < cap:
            return label
    return PRICE_BANDS[-1][1]


# ---- page text: practical guidance and facts drawn from the page's own stays -------------------
# Friendly local-guide voice; no dates, no data sources, never "official"; only facts we have.
CITY_NOTES = {
    'rishikesh': {
        'ghat': 'Triveni Ghat', 'aarti': 'the evening Ganga aarti at Triveni Ghat or Parmarth Niketan',
        'river': 'Tapovan, Laxman Jhula, Ram Jhula, Swarg Ashram and Muni Ki Reti',
        'busy': 'Weekends, long weekends and the cooler months from October to March fill up first',
        'transport': 'Rishikesh station and the ISBT bus stand',
    },
    'haridwar': {
        'ghat': 'Har Ki Pauri', 'aarti': 'the evening Ganga aarti at Har Ki Pauri',
        'river': 'Har Ki Pauri, Bhupatwala, Kharkhari and the Shantikunj stretch',
        'busy': 'Festival days, the Kanwar Yatra and big snan days fill the town first',
        'transport': 'Haridwar railway station and the bus stand next to it',
    },
    'dehradun': {
        'ghat': 'the Clock Tower', 'aarti': 'the evening walk on the Rajpur Road', 'river': 'none: Dehradun is not on the Ganga',
        'busy': 'Weekends, long weekends and the summer rush to the hills fill Dehradun first',
        'transport': 'the railway station and the ISBT bus terminal',
        'resort': 'Resorts mostly sit outside the walkable centre, towards Sahastradhara Road, the Mussoorie Road foothills and the Chakrata Road, so budget for a car or cab. Ask whether meals are included and how far it is to the Rajpur Road for dinners out.',
        'camp': 'Camps are few around Dehradun and sit on the outskirts. Ask whether meals and a bonfire are included, whether tents have attached bathrooms, and how the access road is after rain.',
        'own_away': 'about 45 km by road',
    },
    'mussoorie': {
        'ghat': 'the Mall Road', 'aarti': 'the evening walk on the Mall Road', 'river': 'none: Mussoorie is not on the Ganga',
        'busy': 'Weekends, long weekends, school holidays and the summer rush fill Mussoorie first',
        'transport': 'the bus and taxi stands in town',
        'resort': 'Resorts mostly sit away from the Mall Road bustle, on the Kempty Road, the Dhanaulti side or the slopes below, so budget for a cab or your own car on hill roads. Ask whether meals are included and how far it is to the Mall Road.',
        'camp': 'Camps near Mussoorie are on the outskirts, along the Kempty Road and the forest side. Many close in the monsoon, so ask about meals, a bonfire and attached bathrooms.',
        'own_away': 'about 80 km by road',
    },
}
LANDMARK_NOTES = {
    'laxman-jhula': 'The bridge itself is for walkers and two-wheelers only, so a cab drops you at the nearest road and you walk the last bit.',
    'triveni-ghat': 'The ghat is busiest just before the evening aarti; stays within a kilometre let you walk there and back after dark.',
    'har-ki-pauri': 'Lanes around the ghat close to cars on busy days, so expect to walk the last few hundred metres with your bags.',
    'rishikesh-railway-station': 'Yog Nagari Rishikesh, the main station, is on the bypass about 2.5 km west of Triveni Ghat; Tapovan and Laxman Jhula are a 20 to 30 minute ride on.',
    'rishikesh-isbt': 'Buses to the hills leave early in the morning, so a room close to the bus stand saves a dark, rushed ride across town.',
    'aiims-rishikesh': 'AIIMS is on the Rishikesh bypass at Virbhadra, about 3 km south of Triveni Ghat. Many patients and families stay within walking distance for early OPD queues; for a longer treatment, ask for a weekly rate and a room with a kitchen.',
    'himalayan-hospital-jolly-grant': 'The Himalayan Hospital is next to Jolly Grant airport, about 20 km from Rishikesh by road. Stays close by are few, so many families stay in Rishikesh and drive in.',
    'jolly-grant-airport': 'Jolly Grant is the airport for both Rishikesh (about 20 km, 40 minutes by road) and Haridwar (about 35 km). Stays next to it are few: most travellers go straight on to Rishikesh or Haridwar.',
    'neelkanth-mahadev-temple': 'The temple is about 30 km by road from Rishikesh through the hills, or a long day\'s walk on the old trek path from Swarg Ashram. Stays near it are few and simple, and Shravan and Shivratri bring big crowds.',
    'patanjali-yogpeeth': 'Patanjali Yogpeeth is on the Haridwar to Roorkee highway at Bahadrabad, about 17 km from Har Ki Pauri. Most stays nearby are highway hotels; for the ghats and the evening aarti you will need a cab.',
    'shantikunj': 'Shantikunj and Dev Sanskriti Vishwavidyalaya stand side by side on the Rishikesh road, about 4 km north of Har Ki Pauri, with ashram-style hotels and guest houses all along the stretch.',
    'gurukul-kangri-university': 'Gurukul Kangri University is on the main Haridwar to Jwalapur road, about 6 km south of Har Ki Pauri; rooms fill up around admissions and exam days.',
    'bhel-haridwar': 'BHEL\'s factory and Ranipur township are about 6 km west of Har Ki Pauri; stays here suit work visits more than a pilgrimage.',
    'thdc-rishikesh': 'THDC India\'s head office, Ganga Bhawan, is on the Rishikesh bypass beside THDC Colony, about 2 km west of Triveni Ghat; stays here suit work visits and interviews.',
    'iit-roorkee': 'IIT Roorkee is in Roorkee, about 28 km south-west of Har Ki Pauri in a straight line and a little more by the Haridwar to Roorkee highway. Few stays near the campus are listed with us, so the ones here are on the Haridwar side: allow 40 to 60 minutes by road.',
    'cbri-roorkee': 'CSIR-CBRI sits beside the IIT Roorkee campus, about 28 km south-west of Har Ki Pauri. Few stays near it are listed with us, so the ones here are on the Haridwar side: allow 40 to 60 minutes by road.',
    'sidcul-haridwar': 'SIDCUL, Haridwar\'s industrial estate, is about 9 km west of Har Ki Pauri; its hotels mostly serve business travellers on weekdays.',
    'haridwar-railway-station': 'The station is about 2 km from Har Ki Pauri; e-rickshaws run the route all day.',
}


def _fmt_inr(p):
    return f'₹{p:,.0f}'


def page_content(rule, city, members, landmarks, lm_names, area_notes, singular, plural):
    """Extra paragraphs, facts and FAQs for a stays page, from its rule ('' for a category) and its stays."""
    conds = [c.strip() for c in rule.split(' & ')]
    note = CITY_NOTES.get(city, CITY_NOTES['rishikesh'])
    paras, facts, faq = [], [], []
    priced = sorted([d for d in members if d.get('p')], key=lambda d: d['p'])
    rated = sorted([d for d in members if d.get('g') and (d.get('c') or 0) >= 10], key=lambda d: (-d['g'], -(d.get('c') or 0)))
    near = next((c for c in conds if c.startswith('near:')), None)
    lm_slug, lm_km = (near.split(':')[1], float(near.split(':')[2])) if near else (None, None)
    lm_name = lm_names.get(lm_slug, lm_slug.replace('-', ' ').title()) if lm_slug else None

    if 'top10' in conds:
        paras.append(f'How this top 10 works: every {singular} is ranked by its guest score, then by how many reviews it has, and only {plural} with at least {TOP_MIN_REVIEWS} guest reviews count, so one glowing review cannot top the list. Scores move as new reviews come in, so the order can change.')
    if any(c.startswith('price') or c == 'priced' for c in conds):
        paras.append(f'Prices are each stay\'s listed starting price per night, usually for its smallest room. {note["busy"]}, and prices rise then; quieter months cost less. Staying a week or more? Ask for a weekly rate, many small places will agree.')
        if any(c.startswith('price<') for c in conds):
            paras.append('Cheaper rooms are often simpler, so check the basics before you book: hot water, a fan or AC, Wi-Fi if you need it, and whether the room is up several flights of stairs.')
    if 'river' in conds or 'gangaview' in conds:
        paras.append(f'Staying by the Ganga puts the ghats and {note["aarti"]} within reach on foot. The riverside stretches are {note["river"]}. A room that actually faces the river usually costs more than one at the back, so ask which side yours is on.')
    if near:
        paras.append(f'Distances on this page are straight-line from {lm_name}; the way there by road or lane can be longer. {LANDMARK_NOTES.get(lm_slug, "")}'.strip())
    if 'family' in conds:
        paras.append('Travelling as a family? Ask about extra beds or connecting rooms, whether there is a lift or many stairs, meal timings for children, and whether the pool, if there is one, has a shallow end.')
    if 'kitchen' in conds:
        paras.append('A kitchen pays off on longer stays and for special diets. Ask whether gas, utensils and a fridge are included, and whether there is a market or vegetable cart nearby.')
    if 'pool' in conds:
        paras.append('Pools in the hills are often seasonal; ask whether the pool is open, and heated, when you travel.')
    if any(c.startswith('stars') for c in conds):
        paras.append('A star rating is the property\'s own class: it tells you about facilities such as a lift, restaurant and room service more than about the view or the quiet, so read recent reviews as well.')
    if 'wedding' in conds:
        paras.append('Planning a wedding? Ask about lawn and hall capacity, a block of rooms for guests, whether outside caterers and decorators are allowed, and sound limits near ashrams and temples.')
    if 'oyo' in conds:
        paras.append('OYO-branded hotels are independent hotels that run under the OYO name, so standards vary from one to the next. Read the recent reviews of the exact property, and check the address before you go.')
    if 'entire' in conds:
        paras.append('Whole homes suit groups and longer stays. Check how the keys are handed over, whether a caretaker lives on site, and the house rules on visitors and noise.')
    if 'resort' in conds or 'resortcamp' in conds:
        paras.append(note.get('resort') or 'Resorts mostly sit outside the walkable centre, on the Neelkanth and Badrinath roads or by the river upstream, so budget for taxis or a car. Ask whether meals are included and how far it is to the ghats for the evening aarti.')
    if 'camp' in conds or 'resortcamp' in conds:
        paras.append(note.get('camp') or 'Camps cluster upstream around Shivpuri, where most rafting trips start. Many close in the monsoon. Ask whether rafting, meals and a bonfire are included and whether tents have attached bathrooms.')
    if 'linked' in conds:
        paras.append('Every stay here has a booking page we have checked. Press View property, leave your name and number, and we send you straight on to book; or WhatsApp us and we will suggest one of our own homestays at a direct price.')
    paras.append('Prefer to book direct? Our own homestays by the Ganges in Rishikesh are pinned near the top of this page'
                 + ('' if city == 'rishikesh' else ', ' + note.get('own_away', 'about 25 km upriver'))
                 + '. Send us your dates and group size and we will help you choose, wherever you end up staying.')

    linked = sum('o' in d for d in members)
    if members:
        facts.append(f'{linked:,} of these {len(members):,} {plural} can be booked online right away.')
    if priced:
        cheap = ', '.join(f'{d["n"]} ({d["a"]}, from {_fmt_inr(d["p"])})' for d in priced[:3])
        facts.append(f'Lowest starting prices on this page: {cheap}.')
    if rated:
        top = ', '.join(f'{d["n"]} ({d["a"]}, {d["g"]:g}/10 from {d["c"]} reviews)' for d in rated[:3])
        facts.append(f'Best guest scores here: {top}.')
    closest = []
    if near and lm_slug in landmarks:
        closest = sorted([(km(d['ll'], landmarks[lm_slug]), d) for d in members if d.get('ll')], key=lambda t: t[0])[:3]
        if closest:
            facts.append(f'Closest to {lm_name}: ' + ', '.join(f'{d["n"]} ({k:.1f} km)' for k, d in closest) + '.')
    areas = {}
    for d in members:
        areas[d['a']] = areas.get(d['a'], 0) + 1
    top_areas = [a for a, _ in sorted(areas.items(), key=lambda kv: -kv[1])[:2] if a in area_notes]
    if top_areas:
        paras.append('Where these are: ' + ' '.join(f'{a} is {area_notes[a]}.' for a in top_areas))

    if priced:
        d = priced[0]
        faq.append((f'What is the cheapest {singular} on this page?',
                    f'{d["n"]} in {d["a"]} has the lowest listed starting price here, from {_fmt_inr(d["p"])} a night. Prices change with dates, so check the current rate before you book.'))
    if closest:
        k, d = closest[0]
        faq.append((f'Which {singular} is closest to {lm_name}?',
                    f'{d["n"]} is the closest on this page, about {k:.1f} km in a straight line from {lm_name}.'))
    if rated:
        faq.append((f'Which {plural} here have the best guest reviews?',
                    'The best-reviewed are ' + ', '.join(f'{d["n"]} ({d["g"]:g}/10)' for d in rated[:3]) + ', counting only stays with at least ten reviews.'))
    return paras, facts, faq
