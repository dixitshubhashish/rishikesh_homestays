"""Generate the best-<category>-in-rishikesh.html pages and their shared data.

Step 3. Usage: python3 scripts/stays/build_pages.py
Reads .cache/stays.json (from process.py) and .cache/props.jsonl.

Built for search engines and AI crawlers as much as for visitors:
- every list is written into the HTML (no JavaScript needed to see it), in a
  stable order: our own stays pinned first, then a fixed neutral order;
- each page carries original, data-derived copy (counts by area, typical
  prices, pet-friendly / Ganga-facing shares), FAQs and local area notes;
- JSON-LD: BreadcrumbList, ItemList, FAQPage;
- sitemap.xml and llms.txt sections are regenerated between markers.
The filters (stays-index.js) only download the data module on first use.

Every page shares one header/footer (copied from thanks.html at build time so
nav/footer changes carry over), one data module, one script and the same
category strip, so all category pages link to each other. Re-run after a
new crawl.
"""
import datetime
import hashlib
import html
import json
import os
import re
import statistics

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SITE = 'https://rishikeshhomestays.com'
MIN_PAGE = 5          # skip categories too thin to be worth a page
MASTER_SECTION = 20   # rows per section on the master page before "view all"
OG_IMAGE = f'{SITE}/assets/images/rishikesh-homestay-hero.webp'
# Booking.com affiliate ID (Partner Centre). When set, every verified
# Booking.com link gets ?aid=<id> so bookings earn commission.
BOOKING_AID = '7854081'

# Our own properties: pinned on top of every page with a book-direct link
# (instead of the source listing). Matched by exact source URL, so no other
# similarly named stay is caught; kept out of the general lists.
OWN = [
    ('advaitam-ganga-hill-view-homestay-by-the-ganges-ghat', 'Advaitam Ganga & Hill View Luxury 3BHK Homestay', '/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh'),
    ('villa-elysium-the-himalayan-ganges-view-yoga-retreat', 'Elysium – The Himalayan & Ganges View Yoga Retreat Villa', '/contact'),
    ('villa-yoga-retreat-at-the-ganges-in', 'Yoga Retreat at the Ganges', '/contact'),
]

# (slug, title, singular, filter, intro, guide). filter "k:<type>" matches any
# of the stay's types, "t:<tag>" a theme tag from process.py, "all" everything.
# best-hotels-in-rishikesh is the master list: every stay, one section per
# category (the Hotels and Other sections have no separate page).
CATEGORIES = [
    ('hotels', 'Hotels', 'hotel', 'all',
     'Every hotel, homestay, resort, camp, hostel and villa we found listed in Rishikesh, from simple rooms to 5-star stays, grouped by category.',
     'Rishikesh splits into a few very different bases. Tapovan and Laxman Jhula are the walkable cafe-and-yoga side; Swarg Ashram and Muni Ki Reti sit by the ashrams and ghats; Triveni Ghat is the busy town centre; the Neelkanth and Badrinath roads hold the resorts and riverside camps that need a car. Pick the base first, then the type of stay.'),
    ('homestays', 'Homestays', 'homestay', 'k:Homestays',
     'Family-run homes where you stay with locals, often with home-cooked food and a quieter street.',
     'A homestay suits travellers who want home food, local advice and a calmer lane rather than a front desk. Most are small, so ask about hot water, parking and stairs before you book, and agree on meal timings with the family.'),
    ('resorts', 'Resorts', 'resort', 'k:Resorts',
     'Resorts with gardens, pools and river or hill views, mostly along the Neelkanth and Badrinath roads.',
     'Resorts are usually outside the walkable centre, so budget for taxis or a car. In return you get space, pools and views. Check whether the price includes meals, and how far the resort is from the ghats if you plan to see the evening aarti.'),
    ('camps', 'Camps', 'camp', 'k:Camps & tents',
     'Riverside and jungle camps and glamping tents, mostly along the Shivpuri rafting stretch.',
     'Camps cluster upstream around Shivpuri, where most rafting trips start. Rafting usually runs from autumn to early summer and pauses in the monsoon, when many camps close too. Ask whether rafting, meals and a bonfire are included, and whether tents have attached bathrooms.'),
    ('hostels', 'Hostels', 'hostel', 'k:Hostels',
     'Backpacker hostels with dorms and private rooms, most of them in Tapovan and around Laxman Jhula.',
     'Hostels are the easiest way to meet other travellers and find rafting or trek partners. Most sit in Tapovan, close to cafes and yoga schools. Check whether dorms are mixed or female-only, and whether lockers are provided.'),
    ('villas', 'Villas', 'villa', 'k:Villas',
     'Private villas for groups and families, many with a garden, terrace or pool.',
     'A villa gives a group its own kitchen, living space and often a pool, which can cost less per person than several hotel rooms. Confirm how many beds are real beds, whether a caretaker or cook is on site, and the car access to the gate.'),
    ('apartments', 'Apartments', 'apartment', 'k:Apartments',
     'Serviced 1BHK to 4BHK apartments with kitchens, good for long stays and families.',
     'Apartments suit long stays, yoga teacher trainings and families who want a kitchen. Ask about power backup, lifts, parking and weekly or monthly rates, which are often much lower than nightly prices.'),
    ('guest-houses', 'Guest Houses', 'guest house', 'k:Guest houses',
     'Small guest houses with simple rooms, usually close to the ghats and markets.',
     'Guest houses are simple and central, a step up from a hostel without hotel prices. Rooms vary a lot within one building, so ask for photos of the exact room and whether it has a window or balcony.'),
    ('cottages', 'Cottages', 'cottage', 'k:Cottages',
     'Cottages in the hills and gardens around Rishikesh, away from the town crowds.',
     'Cottages are usually on the hillsides or in gardens away from town, so they are quiet but less walkable. Check the road condition for the last stretch, especially in the monsoon.'),
    ('bed-and-breakfasts', 'Bed & Breakfasts', 'bed & breakfast', 'k:B&Bs',
     'Bed & breakfasts where the morning meal comes with the room.',
     'A B&B takes care of breakfast, which helps on early starts for rafting, sunrise at Kunjapuri or a yoga class. Ask what time breakfast is served if you need to leave early.'),
    ('holiday-rentals', 'Holiday Rentals', 'holiday rental', 'k:Holiday rentals',
     'Whole homes and flats to rent for a holiday, booked as one unit.',
     'Holiday rentals are booked as a whole unit, so they suit families and groups who want privacy. Check-in is often self-service, so confirm the key handover and a local contact number.'),
    ('ashram-stays', 'Ashram Stays', 'ashram stay', 'k:Ashrams',
     'Ashrams that take guests, with simple rooms and daily yoga, satsang or aarti.',
     'Ashram stays are simple and follow the ashram routine: early mornings, set meal times and no alcohol or meat. They are a good way to experience Rishikesh as a spiritual town, but ask about curfews and any minimum stay.'),
    ('aparthotels', 'Aparthotels', 'aparthotel', 'k:Aparthotels',
     'Hotel-run apartments: a kitchen and living space with hotel housekeeping and a front desk.',
     'Aparthotels sit between a hotel and a rented flat. They suit longer stays and families who want to cook some meals but still have daily cleaning and someone at reception. Ask whether housekeeping is daily or on request.'),
    ('lodges', 'Lodges', 'lodge', 'k:Lodges',
     'Simple lodges with basic rooms, usually close to the main roads and markets.',
     'Lodges are no-frills rooms for a night or two, often near the bus stand or the highway. Good for an early start towards the Char Dham route; check hot water and noise from the road.'),
    ('pet-friendly-stays', 'Pet-Friendly Stays', 'pet-friendly stay', 't:pet',
     'Stays that list pets as allowed, so you can bring your dog to Rishikesh.',
     'Pet policies change, so confirm by message before you book and ask about size limits and any extra fee. Stays with a garden or ground-floor rooms are easier with a dog, and the quieter areas away from the crowded ghats are calmer for walks.'),
    ('ganga-view-stays', 'Ganga View Stays', 'Ganga view stay', 't:ganga',
     'Stays on or facing the Ganga: river views, private ghats and riverside rooms.',
     'A Ganga view usually costs more, and "view" can mean a full river front or a glimpse from the roof, so ask for a photo from the actual room. Rooms near a ghat also put the evening aarti within walking distance.'),
    ('luxury-stays', 'Luxury Stays', 'luxury stay', 't:luxury',
     '4 and 5-star properties and premium stays from ₹8,000 a night.',
     'The top-end stays in Rishikesh lean towards wellness: spas, Ayurveda and yoga programmes, often outside town with river or forest views. Check what the package includes, as many quote rates with meals and treatments.'),
    ('budget-stays', 'Budget Stays', 'budget stay', 't:budget',
     'Rooms and beds from ₹1,500 a night or less.',
     'Budget stays are mostly hostels and simple guest houses in Tapovan, Laxman Jhula and around the town centre. Prices rise on long weekends and festivals, so book early for those dates.'),
    ('yoga-stays', 'Yoga Stays', 'yoga stay', 't:yoga',
     'Stays with yoga classes on site, from ashram-style retreats to hotels with a daily session.',
     'Rishikesh calls itself the yoga capital of the world, and many stays run their own morning class. A class on site saves the walk to a school at 6 a.m.; for a full course or teacher training, compare the stay with the yoga schools in Tapovan and Laxman Jhula.'),
    ('spa-and-wellness-stays', 'Spa & Wellness Stays', 'spa and wellness stay', 't:spa',
     'Stays with a spa, wellness centre or massage, including Ayurveda-focused retreats.',
     'Wellness is a big part of a Rishikesh trip, from a single Ayurvedic massage to week-long programmes. Ask whether treatments are included or charged separately, and book popular treatments ahead in peak season.'),
    ('family-friendly-stays', 'Family-Friendly Stays', 'family-friendly stay', 't:family',
     'Stays that welcome families, with family rooms and space for children.',
     'With children, look for a stay with a family room or a kitchen, easy road access and a lift if there are many stairs. Areas a short drive from the busiest ghats are calmer, and the river is fast, so keep little ones away from the water\'s edge.'),
    ('long-stays-with-kitchen', 'Long Stays with a Kitchen', 'long stay with a kitchen', 't:kitchen',
     'Stays with a private or shared kitchen, good for weeks-long yoga courses and workations.',
     'For a yoga course, teacher training or remote work, a kitchen saves money and lets you eat simply. Ask about weekly and monthly rates, Wi-Fi speed and power backup, as cuts still happen.'),
    ('stays-with-airport-pickup', 'Stays with Airport Pickup', 'stay with airport pickup', 't:airport',
     'Stays that arrange a transfer from Dehradun\'s Jolly Grant airport, about 35 km from Rishikesh.',
     'Jolly Grant airport in Dehradun is the nearest airport to Rishikesh. A pickup arranged by your stay avoids haggling at the airport; confirm the price and whether it is per car or per person.'),
    ('business-hotels', 'Business Hotels', 'business hotel', 't:business',
     'Hotels with a business centre or meeting and banquet halls, for work trips, retreats and events.',
     'For a work trip, retreat or wedding group, look for meeting space, reliable Wi-Fi and parking. Larger venues are mostly on the highway and the Haridwar road rather than in the walkable centre.'),
    ('boutique-hotels', 'Boutique Hotels', 'boutique hotel', 't:boutique',
     'Small, design-led hotels with a distinct character.',
     'Boutique hotels are small, so the best rooms sell out first; ask which rooms have the view or balcony shown in the photos.'),
    ('stays-with-jacuzzi', 'Stays with a Jacuzzi', 'stay with a jacuzzi', 't:jacuzzi',
     'Stays that list a jacuzzi among their facilities, often in suites and villas.',
     'A jacuzzi is often limited to certain suites or villas, so confirm it comes with the room you book and whether it is indoor or outdoor.'),
    ('stays-with-pool', 'Stays with a Pool', 'stay with a pool', 't:pool',
     'Properties that list a swimming pool among their facilities.',
     'Pools are most useful from April to June, when Rishikesh gets hot. Many are outdoor and some close in winter, so check the pool is open for your dates.'),
]

# Short, general area notes used in each page's "where to stay" copy.
AREA_NOTES = {
    'Tapovan': 'the busy cafe, yoga-school and backpacker hub above Laxman Jhula; walkable and lively',
    'Laxman Jhula': 'around the Laxman Jhula bridge, close to temples, cafes and the river',
    'Nirmal Bagh near Ganges': 'a quieter residential pocket close to the river and ghats',
    'Muni Ki Reti': 'between Ram Jhula and the town, with ashrams, ghats and easy road access',
    'Swarg Ashram': 'the ashram side across the river, near Parmarth Niketan, with mostly pedestrian lanes',
    'Ram Jhula': 'around the Ram Jhula bridge, between Swarg Ashram and Muni Ki Reti',
    'Triveni Ghat': 'the town centre, with the big evening aarti, markets and the bus stand nearby',
    'Neelkanth Road': 'the hilly road towards Neelkanth Mahadev, with resorts and camps; you will need a vehicle',
    'Shivpuri & rafting belt': 'upstream on the Badrinath road where most rafting starts, with riverside camps',
    'AIIMS Rishikesh': 'near the AIIMS hospital on the Haridwar side, practical for hospital visits',
    'Veerbhadra Temple': 'a residential area south of the centre, quieter but a ride from the ghats',
    'Haridwar Road': 'on the road towards Haridwar, handy for road trips',
    'Raiwala & Shyampur': 'on the Haridwar side of Rishikesh, convenient for Haridwar and the highway',
}


def matches(stay, flt):
    if flt == 'all':
        return True
    kind, value = flt.split(':', 1)
    return value in stay['ks'] if kind == 'k' else value in stay['t']


def stable_key(stay):
    # Neutral fixed order: not ranked by stars, rating or price, and identical
    # on every visit and every crawl of the same data.
    return hashlib.sha1(stay['u'].encode()).hexdigest()


def esc(s):
    return html.escape(str(s), quote=True)


def inr(n):
    s = str(int(n))
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    head = re.sub(r'(\d)(?=(\d\d)+$)', r'\1,', head)
    return f'{head},{tail}'


def meta_html(d):
    parts = [f'<span class="sx-stars-ico">{"★" * d["s"]}</span>' if d['s'] else '<span>Unrated</span>',
             f'<span>{esc(d["a"])}</span>', f'<span>{esc(d["k"])}</span>']
    if d.get('g'):
        parts.append(f'<span>Guests {d["g"]}/10{f" · {d["c"]} reviews" if d.get("c") else ""}</span>')
    if d.get('p'):
        parts.append(f'<span>From ₹{inr(d["p"])}</span>')
    return ''.join(parts)


def item_html(d):
    # Must stay in step with itemHtml() in assets/js/modules/stays-index.js.
    return (f'<li class="sx-item"><span class="sx-name">{esc(d["n"])}</span><span class="sx-meta">{meta_html(d)}</span>'
            f'<a class="sx-go" href="/stay?s={esc(d["id"])}" aria-label="View {esc(d["n"])}">View property</a></li>')


def load_ota_links():
    """ota-links.tsv: one booking-site page per stay, found by web search and
    checked on name + area. Only 'verified' rows are used; doubtful/none are
    kept for the record so they aren't searched again."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ota-links.tsv')
    links = {}
    if os.path.exists(path):
        for line in open(path).read().splitlines()[1:]:
            cols = line.split('\t')
            if len(cols) >= 4 and cols[1] == 'verified' and cols[3].startswith('https://'):
                url = cols[3]
                if cols[2] == 'Booking.com' and BOOKING_AID:
                    url += ('&' if '?' in url else '?') + f'aid={BOOKING_AID}'
                links[cols[0]] = {'n': cols[2], 'u': url}
    return links


def own_html(d):
    rating = f'<span>Guests {d["g"]}/10{f" · {d["c"]} reviews" if d.get("c") else ""}</span>' if d.get('g') else ''
    label = 'Enquire' if d['u'] == '/contact' else 'View'
    return (f'<li class="sx-item sx-item-own"><span class="sx-name">{esc(d["n"])}</span><span class="sx-meta"><span>{esc(d["a"])}</span>{rating}<span>Book direct, best price</span></span>'
            f'<a class="sx-go" href="{esc(d["u"])}">{label}</a></li>')


def stats_for(members):
    prices = sorted(d['p'] for d in members if d.get('p'))
    areas = {}
    for d in members:
        areas[d['a']] = areas.get(d['a'], 0) + 1
    top_areas = [(a, c) for a, c in sorted(areas.items(), key=lambda kv: -kv[1]) if a not in ('Elsewhere in Rishikesh', 'Outside Rishikesh')][:3]
    q = lambda p: prices[min(len(prices) - 1, int(len(prices) * p))] if prices else None
    rated = [d for d in members if d.get('g') and (d.get('c') or 0) >= 5]
    return {
        'n': len(members), 'areas': areas, 'top_areas': top_areas,
        'median': statistics.median(prices) if prices else None, 'p25': q(0.25), 'p75': q(0.75), 'priced': len(prices),
        'pet': sum('pet' in d['t'] for d in members), 'ganga': sum('ganga' in d['t'] for d in members),
        'starred': sum(1 for d in members if d['s']), 'five': sum(1 for d in members if d['s'] == 5), 'four': sum(1 for d in members if d['s'] == 4),
        'well_rated': sum(1 for d in rated if d['g'] >= 9), 'rated': len(rated),
    }


def pct(part, whole):
    return f'{round(100 * part / whole)}%' if whole else '0%'


def round_price(p):
    return inr(int(round(p / 100.0) * 100))


def insights(title, plural, st):
    lines = []
    if st['top_areas']:
        a = ', '.join(f'{esc(name)} ({c})' for name, c in st['top_areas'])
        lines.append(f'Most {plural} are in {a}.')
    if st['median']:
        lines.append(f'The typical listed starting price is about ₹{round_price(st["median"])} a night; the middle half of {plural} start between ₹{round_price(st["p25"])} and ₹{round_price(st["p75"])} (based on {st["priced"]} listings with a price).')
    if st['starred']:
        lines.append(f'{st["starred"]} have a star rating, including {st["five"]} five-star and {st["four"]} four-star.')
    lines.append(f'{st["pet"]} ({pct(st["pet"], st["n"])}) allow pets and {st["ganga"]} ({pct(st["ganga"], st["n"])}) are on or facing the Ganga.')
    if st['rated']:
        lines.append(f'Of the {st["rated"]} with at least five guest reviews, {st["well_rated"]} score 9/10 or higher.')
    return lines


def faqs(title, singular, plural, st, date):
    out = []
    areas_txt = ', '.join(f'{name} ({c})' for name, c in st['top_areas']) or 'several areas'
    out.append((f'How many {plural} are there in Rishikesh?',
                f'There are {st["n"]:,} {plural} in Rishikesh on this page, spread across {len(st["areas"])} areas. The biggest clusters are {areas_txt}.'))
    if st['top_areas']:
        notes = '; '.join(f'{name} is {AREA_NOTES[name]}' for name, _ in st['top_areas'] if name in AREA_NOTES)
        out.append((f'Which area of Rishikesh is best for {plural}?',
                    f'It depends on the trip. {notes + ". " if notes else ""}For the evening aarti and ashrams, stay near Swarg Ashram, Muni Ki Reti or Triveni Ghat; for rafting, stay towards Shivpuri.'))
    if st['median']:
        out.append((f'How much does a {singular} in Rishikesh cost per night?',
                    f'Listed starting prices put a typical {singular} at about ₹{round_price(st["median"])} a night, with most between ₹{round_price(st["p25"])} and ₹{round_price(st["p75"])}. Prices rise on weekends, long weekends and festivals, and fall in the monsoon.'))
    out.append((f'Are there pet-friendly {plural} in Rishikesh?',
                f'Yes. {st["pet"]} of the {st["n"]:,} {plural} here list pets as allowed. Confirm the pet policy and any extra fee with the property before booking.'))
    out.append((f'How do I book one of these {plural}?',
                'Press Go to see the listing, or skip the search: send your dates, group size and budget through our contact form or WhatsApp and we will suggest suitable stays, including our own homestays, which you can book direct.'))
    return out


def jsonld(obj):
    return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=2).replace('</', '<\\/') + '\n</script>'


def replace_between(path, start, end, body):
    s = open(path).read()
    if start in s and end in s:
        s = s[:s.index(start) + len(start)] + body + s[s.index(end):]
    else:
        raise SystemExit(f'markers {start!r} missing in {path}')
    open(path, 'w').write(s)


def main(data_path, crawled):
    today = datetime.date.today()
    date = today.strftime('%-d %B %Y')
    stays = json.load(open(data_path))
    own = []
    for key, name, href in OWN:
        hit = next((s for s in stays if key in s['u']), None)
        if hit:
            own.append({**hit, 'n': name, 'u': href})
            stays.remove(hit)
        else:
            print(f'warning: own property not found in crawl: {key}')
    ota = load_ota_links()
    for s in stays:
        if s['id'] in ota:
            s['o'] = ota[s['id']]
    # Verified booking matches first, then the rest; fixed order within each.
    stays.sort(key=lambda s: (0 if 'o' in s else 1, stable_key(s)))
    everyone = stays + own

    counts = {c[0]: sum(matches(s, c[3]) for s in everyone) for c in CATEGORIES}
    live = [c for c in CATEGORIES if counts[c[0]] >= MIN_PAGE]
    sections = ([{'title': 'Hotels', 'filter': 'k:Hotels', 'slug': None}] +
                [{'title': c[1], 'filter': c[3], 'slug': c[0]} for c in live if c[3] != 'all'] +
                [{'title': 'Other stays', 'filter': 'k:Other stays', 'slug': None}])
    meta = {
            'categories': [{'slug': c[0], 'title': c[1], 'filter': c[3], 'count': counts[c[0]]} for c in live],
            'sections': sections}
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    with open(f'{ROOT}/assets/js/modules/stays-index-data.js', 'w') as fh:
        fh.write('// Generated by scripts/stays/build_pages.py. Do not hand-edit.\n')
        fh.write(f'export const STAYS_INDEX_META = {dump(meta)};\n')
        fh.write(f'export const STAYS_OWN = {dump(own)};\n')
        # Public file: drop the source-listing URL (not used by the pages).
        fh.write(f'export const STAYS_INDEX = {dump([{k: v for k, v in s.items() if k != "u"} for s in stays])};\n')

    shell = open(f'{ROOT}/thanks.html').read()
    top, rest = shell.split('<main>', 1)
    bottom = rest.split('</main>', 1)[1].replace(
        '    <script type="module" src="/assets/js/site.js"></script>\n',
        '    <script type="module" src="/assets/js/site.js"></script>\n    <script type="module" src="/assets/js/modules/stays-index.js"></script>\n', 1)

    live_files = {f'best-{c[0]}-in-rishikesh.html' for c in live}
    for f in os.listdir(ROOT):
        if re.fullmatch(r'best-[a-z-]+-in-rishikesh\.html', f) and f not in live_files:
            os.remove(f'{ROOT}/{f}')

    star_counts = {}
    for slug, title, singular, flt, intro, guide in live:
        is_master = flt == 'all'
        url = f'{SITE}/best-{slug}-in-rishikesh'
        members = [s for s in stays if matches(s, flt)]
        st = stats_for(members + [o for o in own if matches(o, flt)])
        n = st['n']
        plural = 'stays' if is_master else title.lower().replace('stays with a pool', 'stays with a pool')
        h1 = 'Best Hotels in Rishikesh' if is_master else f'Best {title} in Rishikesh'
        page_title = (f'Best Hotels in Rishikesh | All {n:,} Stays by Area & Category' if is_master
                      else f'Best {title} in Rishikesh | {n:,} Compared by Area & Price')
        desc = (f'{n:,} Rishikesh stays compared: hotels, homestays, resorts, camps and hostels by area, price and facilities, '
                f'with local tips on where to stay.') if is_master else (
                f'Compare {n:,} {title.lower()} in Rishikesh by area, price and facilities. {intro}')[:300]
        faq = faqs(title, 'stay' if is_master else singular, plural, st, date)

        strip = ''.join(
            f'<a href="/best-{c[0]}-in-rishikesh"{" aria-current=\"page\"" if c[0] == slug else ""}>{"All stays" if c[3] == "all" else esc(c[1])} <small>{counts[c[0]]:,}</small></a>'
            for c in live)
        explore = ''.join(
            f'<li><a href="/best-{c[0]}-in-rishikesh">{"Best hotels in Rishikesh (all stays)" if c[3] == "all" else f"Best {esc(c[1])} in Rishikesh"}</a> <span>{counts[c[0]]:,}</span></li>'
            for c in live if c[0] != slug)

        if is_master:
            blocks = []
            for sec in sections:
                lst = [s for s in stays if matches(s, sec['filter'])]
                if not lst:
                    continue
                more = (f'<a class="sx-open" href="/best-{sec["slug"]}-in-rishikesh">View all {len(lst):,} {esc(sec["title"].lower())}</a>' if sec['slug']
                        else (f'<button type="button" class="sx-more" data-k="c:{esc(sec["title"])}">Show all {len(lst):,}</button>' if len(lst) > MASTER_SECTION else ''))
                blocks.append(f'<section class="sx-group"><h2>{esc(sec["title"])} <span>{len(lst):,}</span></h2>'
                              f'<ul class="sx-list">{"".join(item_html(d) for d in lst[:MASTER_SECTION])}</ul>'
                              f'{f"<div class=\"sx-actions\">{more}</div>" if more else ""}</section>')
            listing = ''.join(blocks)
            list_items = [d for d in stays][:30]
        else:
            listing = (f'<section class="sx-group"><h2>All {esc(title.lower())} <span>{len(members):,}</span></h2>'
                       f'<ul class="sx-list">{"".join(item_html(d) for d in members)}</ul></section>')
            list_items = members[:30]

        ld_breadcrumb = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
            {'@type': 'ListItem', 'position': 2, 'name': h1, 'item': url}]}
        own_here = [o for o in own if matches(o, flt)] or own
        ld_list = {'@context': 'https://schema.org', '@type': 'ItemList', 'name': h1, 'numberOfItems': n,
                   'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'item': {
                       '@type': 'LodgingBusiness', 'name': d['n'],
                       **({'url': SITE + d['u']} if d['u'].startswith('/') else {}),
                       'address': {'@type': 'PostalAddress', 'addressLocality': f'{d["a"]}, Rishikesh', 'addressRegion': 'Uttarakhand', 'addressCountry': 'IN'}}}
                       for i, d in enumerate(own_here + list_items)]}
        ld_faq = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}
        ld_page = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': h1, 'url': url, 'description': desc,
                   'dateModified': today.isoformat(), 'inLanguage': 'en',
                   'isPartOf': {'@type': 'WebSite', 'name': 'Rishikesh Homestays', 'url': f'{SITE}/'}}

        head_extra = '\n    '.join([
            f'<meta name="description" content="{esc(desc)}">',
            f'<meta property="og:title" content="{esc(page_title)}">',
            f'<meta property="og:description" content="{esc(desc)}">',
            f'<meta property="og:image" content="{OG_IMAGE}">',
            '<meta property="og:type" content="website">',
            '<meta property="og:locale" content="en_US">',
            f'<meta property="og:url" content="{url}">',
            '<meta property="og:site_name" content="Rishikesh Homestays">',
            '<meta name="twitter:card" content="summary_large_image">',
        ])
        page_top = (top
            .replace('<title>Thanks | Rishikesh Homestays</title>', f'<title>{esc(page_title)}</title>\n    {head_extra}')
            .replace('<meta name="robots" content="noindex, follow">', '<meta name="robots" content="index, follow, max-image-preview:large">')
            .replace(f'{SITE}/thanks', url)
            .replace('  </head>', '    ' + '\n    '.join(jsonld(o) for o in (ld_page, ld_breadcrumb, ld_list, ld_faq)) + '\n  </head>', 1))

        insight_html = ''.join(f'<li>{line}</li>' for line in insights(title, plural, st))
        faq_html = ''.join(f'<details class="sx-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faq)
        seg = (('<button type="button" data-g="c">Category</button>' if is_master else '<button type="button" data-g="all">All</button>')
               + '<button type="button" data-g="s">Stars</button><button type="button" data-g="a">Area</button>'
               + ('<button type="button" data-g="k">Type</button>' if not flt.startswith('k:') else ''))
        main_html = f'''<main class="sx-page" id="main">
      <section class="section">
        <div class="container" id="sx-root" data-filter="{esc(flt)}" data-all-title="All {esc(title.lower())}">
          <nav class="sx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> <span>{esc(h1)}</span></nav>
          <p class="eyebrow">Where to stay</p>
          <h1 class="sx-title">{esc(h1)}</h1>
          <p class="sx-lede">{esc(intro)}</p>
          <p class="sx-updated">{n:,} {esc(plural)} to compare</p>
          <nav class="sx-cats" aria-label="Browse stays by category">{strip}</nav>
          <section class="sx-guide" aria-labelledby="sx-guide-h">
            <h2 id="sx-guide-h">{'Where to stay in Rishikesh' if is_master else f'Choosing {esc(title.lower())} in Rishikesh'}</h2>
            <p>{esc(guide)}</p>
            <ul class="sx-insights">{insight_html}</ul>
          </section>
          <section class="sx-own" aria-labelledby="sx-own-h">
            <h2 id="sx-own-h">Our homestays <span>Book direct with us</span></h2>
            <ul class="sx-list" id="sx-own">{"".join(own_html(o) for o in own)}</ul>
          </section>
          <div class="sx-controls">
            <div class="sx-row">
              <input type="search" id="sx-q" class="sx-input" placeholder="Search a name, e.g. Zostel, Aloha, Ganga view" aria-label="Search stays">
              <span class="sx-seg" role="group" aria-label="Organise by">{seg}</span>
            </div>
            <div class="sx-row">
              <span class="sx-label">Stars</span><span class="sx-row" id="sx-stars"></span>
              <select id="sx-area" class="sx-input" aria-label="Area"><option value="">All areas</option></select>
              <select id="sx-kind" class="sx-input" aria-label="Type"{' hidden' if flt.startswith('k:') else ''}><option value="">All types</option></select>
            </div>
            <div class="sx-row"><span class="sx-label">Facilities</span><span class="sx-row" id="sx-fac"></span><button type="button" class="sx-clear" id="sx-clear">Clear all</button></div>
          </div>
          <div id="sx-out">{listing}</div>
          <section class="sx-faq" aria-labelledby="sx-faq-h">
            <h2 id="sx-faq-h">{esc(h1)}: questions travellers ask</h2>
            {faq_html}
          </section>
          <section class="sx-explore" aria-labelledby="sx-explore-h">
            <h2 id="sx-explore-h">Explore more stays in Rishikesh</h2>
            <ul>{explore}</ul>
            <p>Want a hand choosing? <a href="/homestays">See our handpicked homestays</a>, read <a href="/about-rishikesh">about Rishikesh's areas</a>, <a href="/places-to-visit">places to visit</a> and <a href="/things-to-do-in-rishikesh">things to do</a>, or <a href="/contact">send us your dates</a> and we'll suggest a stay.</p>
          </section>
          <p class="sx-note">Our area lines are drawn with a local's pencil, not a surveyor's, so a stay near the border might sit one neighbourhood over. Rates rise and fall with rafting season, festivals and the monsoon, so give the property a quick check before you pack.</p>
        </div>
      </section>
    </main>'''
        open(f'{ROOT}/best-{slug}-in-rishikesh.html', 'w').write(page_top + main_html + bottom)

    # sitemap.xml + llms.txt sections (regenerated between markers)
    sm = ''.join(f'''
  <url>
    <loc>{SITE}/best-{c[0]}-in-rishikesh</loc>
    <lastmod>{today.isoformat()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{"0.8" if c[3] == "all" else "0.6"}</priority>
  </url>''' for c in live)
    replace_between(f'{ROOT}/sitemap.xml', '<!-- stays-pages:start -->', '<!-- stays-pages:end -->', sm + '\n  ')
    ll = '\n' + '\n'.join(
        f'- [{"Best Hotels in Rishikesh (all stays)" if c[3] == "all" else f"Best {c[1]} in Rishikesh"}]({SITE}/best-{c[0]}-in-rishikesh): {counts[c[0]]:,} {"stays of every type, grouped by category" if c[3] == "all" else c[1].lower()}. {c[4]}'
        for c in live) + '\n\n'
    replace_between(f'{ROOT}/llms.txt', '<!-- stays-pages:start -->', '<!-- stays-pages:end -->', ll)

    # One shared info page for every stay (/stay?s=<id>), rendered from the
    # data module by stay-page.js. noindex: thin per-stay pages would dilute
    # the category pages, which carry the SEO.
    stay_top = (top.replace('<title>Thanks | Rishikesh Homestays</title>', '<title>Stay details | Rishikesh Homestays</title>')
                   .replace(f'{SITE}/thanks', f'{SITE}/stay'))
    stay_main = '''<main class="sx-page" id="main">
      <section class="section">
        <div class="container" id="sp-root">
          <p class="sx-note">Loading stay details…</p>
          <noscript><p>This page needs JavaScript. <a href="/best-hotels-in-rishikesh">Browse all stays in Rishikesh</a> or <a href="/contact">send us your dates</a>.</p></noscript>
        </div>
      </section>
    </main>'''
    stay_bottom = bottom.replace('/assets/js/modules/stays-index.js', '/assets/js/modules/stay-page.js')
    open(f'{ROOT}/stay.html', 'w').write(stay_top + stay_main + stay_bottom)
    print('verified booking links:', sum('o' in s for s in stays))

    print('pages:', ', '.join(f'{c[0]} ({counts[c[0]]})' for c in live))
    print('skipped:', ', '.join(f'{c[0]} ({counts[c[0]]})' for c in CATEGORIES if c not in live) or 'none')


if __name__ == '__main__':
    cache = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache')
    crawled = sum(1 for _ in open(f'{cache}/props.jsonl'))
    main(f'{cache}/stays.json', crawled)
