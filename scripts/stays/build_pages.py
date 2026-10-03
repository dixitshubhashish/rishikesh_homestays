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
sys_path_added = __import__('sys').path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cities import CITIES, DEFAULT_CITY, city_from_argv, cache_dir  # noqa: E402

# Current city (set in __main__ from --city; Rishikesh by default). Rishikesh
# keeps its data file and slugs (hotels/best-*-in-rishikesh, /hotels/stay?s=<slug>);
# other cities get best-*-in-<city>, /hotels/stay?s=<slug>&c=<city> and
# stays-index-data-<city>.js.
CITY = DEFAULT_CITY
CN = CITIES[DEFAULT_CITY]['name']


# Generated pages live under hotels/ (URL /hotels/<file>); root-level copies
# from before the move are deleted on build and 301-redirected in vercel.json,
# _redirects and server.js.
STAYS_DIR = os.path.join(ROOT, 'hotels')  # shared with hand-made listing pages; only generated files are ever removed


def city_qs():
    return '' if CITY == DEFAULT_CITY else f'&c={CITY}'


def data_module_name(city=None):
    city = city or CITY
    return 'stays-index-data.js' if city == DEFAULT_CITY else f'stays-index-data-{city}.js'


def marker(city=None):
    city = city or CITY
    return 'stays-pages' if city == DEFAULT_CITY else f'stays-pages-{city}'
SITE = 'https://rishikeshhomestays.com'
MIN_PAGE = 5          # skip categories too thin to be worth a page
MASTER_SECTION = 20   # rows per section on the master page before "view all"
OG_IMAGE = f'{SITE}/assets/images/rishikesh-homestay-hero.webp'
# Booking.com affiliate ID (Partner Centre). When set, every verified
# Booking.com links go through our CJ affiliate deep link. The IDs live in one
# place, assets/js/modules/affiliate-links.js (read here, imported by the JS).
_AFF = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'js', 'modules', 'affiliate-links.js')).read()
CJ_PID, CJ_BOOKING_LINK, CJ_CLICK_HOST = (re.search(rf"export const {k} = '([^']+)'", _AFF).group(1)
                                          for k in ('CJ_PID', 'CJ_BOOKING_LINK_ID', 'CJ_CLICK_HOST'))


def booking_affiliate(url):
    from urllib.parse import quote
    return f'{CJ_CLICK_HOST}/click-{CJ_PID}-{CJ_BOOKING_LINK}?url={quote(url.split("?")[0], safe="")}'

# Our own properties: pinned on top of every page with a book-direct link
# (instead of the source listing). Matched by exact source URL, so no other
# similarly named stay is caught; kept out of the general lists.
OWN = [
    ('advaitam-ganga-hill-view-homestay-by-the-ganges-ghat', 'Advaitam Ganga & Hill View Luxury 3BHK Homestay', '/hotels/advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh'),
    ('villa-elysium-the-himalayan-ganges-view-yoga-retreat', 'Elysium – The Himalayan & Ganges View Yoga Retreat Villa', '/contact'),
    ('villa-yoga-retreat-at-the-ganges-in', 'Yoga Retreat at the Ganges', '/contact'),
]

# How category links are grouped (and each group sorted by count, biggest
# first) everywhere they're listed: the strip, "Explore more" and the stay
# page's "More stays in …" box.
CAT_GROUPS = [('type', 'Accommodation type'), ('size', 'By size'), ('theme', 'Themes & facilities')]


def cat_group(flt):
    if flt == 'all':
        return None
    if flt.startswith('k:') or flt == 't:backpacker':
        return 'type'
    return 'size' if flt.startswith('b:') else 'theme'


def grouped(cats, count):
    """[(label, [categories sorted by count desc])] for the non-empty groups."""
    out = []
    for key, label in CAT_GROUPS:
        members = sorted((c for c in cats if cat_group(c[3]) == key), key=lambda c: (-count(c), c[1]))
        if members:
            out.append((label, members))
    return out


# Other directory listings of our own properties (same place, older name):
# never shown as a third-party stay next to the real one.
OWN_ALIASES = {
    'homestay-luxury-3-bhk-ganges-hill-view-by-the-ghats',  # Advaitam, ~10 m apart, same 3BHK
}

# (slug, title, singular, filter, intro, guide). filter "k:<type>" matches any
# of the stay's types, "t:<tag>" a theme tag from process.py, "b:<min>-<max>"
# the bedroom count bd from process.py (0 = studio, 9 = 8+; stays whose size
# is unknown match no b: filter), "all" everything.
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
    ('studio-and-1-bhk-stays', 'Studio & 1 BHK Stays', 'studio or 1 BHK stay', 'b:0-1',
     'Studios and one-bedroom (1 BHK) flats and suites for couples, solo travellers and long yoga stays, often with a kitchen or kitchenette.',
     'A studio or 1 BHK gives you your own front door and somewhere to cook for less than most hotel suites, which is why yoga students and remote workers settle into them for weeks. Most are in apartment blocks, so ask which floor it is on and whether there is a lift, whether the kitchen has a proper stove or just a kettle, how long the power backup lasts, and whether there is parking if you are driving up. Weekly and monthly rates are usually far below the nightly price, so always ask.'),
    ('2-bhk-stays', '2 BHK Stays', '2 BHK stay', 'b:2-2',
     'Two-bedroom flats, apartments and villas: room for a family with kids or two couples, with a living room and often a kitchen to share.',
     'A 2 BHK is the sweet spot for a family of four or two couples travelling together: two real bedrooms, a shared living room and usually a kitchen, often for about the price of two hotel rooms. Before you book, check that both bedrooms have proper beds rather than a sofa-cum-bed, how many bathrooms there are, whether there is a lift and parking for your car, and what the power backup runs, as short cuts still happen.'),
    ('3-bhk-and-bigger-stays', '3 BHK and Bigger Stays', '3 BHK or bigger stay', 'b:3-9',
     'Three-bedroom and bigger homes, apartments and villas for families and groups, led by our own Advaitam, a luxury 3 BHK homestay with Ganga and hill views in Nirmal Bagh that you can book direct with us.',
     'For a big family or a group of friends, one 3 BHK or larger home usually beats juggling several hotel rooms: everyone stays under one roof, shares a kitchen and living room, and the cost per person drops. Our own Advaitam is exactly that, a luxury 3 BHK by the Ganges ghat in quiet Nirmal Bagh, close to the river without the crowds; message us for direct rates. Wherever you book, ask how many bathrooms there are, whether the bedrooms are on one floor or up several flights of stairs (and if there is a lift), whether there is parking for more than one car, whether a caretaker or cook is on hand, and what the power backup covers.'),
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
    ('backpacker-hostels', 'Backpacker Hostels', 'backpacker hostel', 't:backpacker',
     'Hostels, dorm beds and backpacker chains such as Zostel, The Hosteller and goSTOPS, mostly in Tapovan and around Laxman Jhula.',
     'Backpacker hostels are where solo travellers find rafting buddies, trek partners and the best cafe tips. Most sit in Tapovan, walkable to Laxman Jhula and the yoga schools. Compare mixed and female-only dorms, check for lockers and hot water, and book ahead for long weekends and the New Year rush.'),
    ('dharamshalas', 'Dharamshalas', 'dharamshala', 'k:Dharamshalas',
     'Dharamshalas: simple, low-cost pilgrim lodges run by trusts and communities, usually close to the ghats.',
     'Dharamshalas are built for pilgrims: clean, basic rooms at low prices, often with a canteen and set timings. Many ask for ID and prefer families or groups, and some only confirm bookings in person or by phone. They fill fast around big snan days and festivals, so book early.'),
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
# Copy for cities other than Rishikesh (the CATEGORIES intro/guide text is
# written for Rishikesh). Data-driven insights and FAQs are generated per city.
CITY_COPY = {
    'haridwar': {
        'master_intro': 'Every hotel, dharamshala, homestay, guest house and apartment we found listed in Haridwar, from simple pilgrim rooms to riverside hotels, grouped by category.',
        'intro': '{title} across Haridwar, from the ghats around Har Ki Pauri to calmer Kankhal and the road towards Rishikesh.',
        'guide': 'Haridwar is built around its ghats. Har Ki Pauri and the Upper Road are the walkable pilgrim centre, closest to the evening Ganga aarti and the busiest at festivals; Kankhal and Bhupatwala are calmer, ashram-lined neighbourhoods; Shantikunj and Saptrishi sit along the river towards Rishikesh; Jwalapur, Ranipur and the Delhi Road are practical bases with easier parking. For big snan days, stay within walking distance of the ghat you plan to bathe at.',
        'area_tip': 'For the evening aarti and the main snans, stay near Har Ki Pauri or the Upper Road; for a calmer base, Kankhal, Bhupatwala or Shantikunj; for driving in and out, the Delhi Road or Rishikesh Road.',
        'note': 'Our area lines are drawn with a local\'s pencil, not a surveyor\'s, so a stay near the border might sit one neighbourhood over. Rates jump around the Kumbh, Kanwar Yatra, Ganga Dussehra and big snan days, so give the property a quick check before you pack.',
        'kumbh': True,
    },
}
AREA_TIP_RISHIKESH = 'For the evening aarti and ashrams, stay near Swarg Ashram, Muni Ki Reti or Triveni Ghat; for rafting, stay towards Shivpuri.'
NOTE_RISHIKESH = "Our area lines are drawn with a local's pencil, not a surveyor's, so a stay near the border might sit one neighbourhood over. Rates rise and fall with rafting season, festivals and the monsoon, so give the property a quick check before you pack."
KUMBH_FAQ = ('Where should I stay in Haridwar for the Kumbh 2027?',
             'Stay within walking distance of the ghat you plan to bathe at: Har Ki Pauri and the Upper Road for the main snans, or Kankhal, Bhupatwala and Shantikunj for calmer bases a short walk or ride away. Roads close to vehicles around the big bathing days, so a walkable stay matters more than a fancy one. Book as early as you can; for a quieter base, Rishikesh is about 25 km upriver. Our Haridwar Kumbh 2027 guide covers the reported dates and planning.')


def city_copy(slug, title, intro, guide):
    c = CITY_COPY.get(CITY)
    if not c:
        return intro, guide
    if slug == 'hotels':
        return c['master_intro'], c['guide']
    if slug == 'dharamshalas':
        return intro, guide  # already city-neutral
    return c['intro'].format(title=title), c['guide']


AREA_NOTES = {
    'Har Ki Pauri': 'the main ghat and pilgrim centre, closest to the evening Ganga aarti',
    'Upper Road & Mayapur': 'the bazaar strip behind the ghats, walkable to Har Ki Pauri',
    'Kankhal': 'an older, quieter neighbourhood of ashrams and temples south of the centre',
    'Bhupatwala': 'an ashram-lined stretch on the way towards Rishikesh, calmer than the centre',
    'Shantikunj & Saptrishi': 'the riverside stretch towards Rishikesh around Shantikunj and Saptrishi',
    'Kharkhari': 'close to the river between the centre and Bhupatwala',
    'Railway Station': 'handy for trains, a short ride from the ghats',
    'Jwalapur': 'a busy residential town area, practical rather than scenic',
    'Ranipur & BHEL': 'the BHEL township side, quieter and good for driving in',
    'SIDCUL': 'the industrial-park side, mostly business hotels',
    'Delhi Road': 'on the highway towards Delhi and Roorkee, easy for road trips',
    'Rishikesh Road & Motichur': 'on the road towards Rishikesh, near Motichur and Chandi Devi',
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
    if kind == 'b':
        lo, hi = (int(x) for x in value.split('-'))
        return stay.get('bd') is not None and lo <= stay['bd'] <= hi
    return value in stay['ks'] if kind == 'k' else value in stay['t']


# Extra words for a category's <h1> and <title> only (kept out of the short
# title used in strips, lists and FAQs).
TITLE_SUFFIX = {'3-bhk-and-bigger-stays': ' for Families & Groups'}


def lc(title):
    """Lower-case a category title for running text, keeping "BHK"."""
    return re.sub(r'\bbhk\b', 'BHK', title.lower())


# Running-text plural where a count comes first ("58 two-bedroom (2 BHK)
# stays", not "58 2 BHK stays"); every other category uses lc(title).
PLURAL = {'2-bhk-stays': 'two-bedroom (2 BHK) stays', '3-bhk-and-bigger-stays': 'stays with 3 or more bedrooms'}


def plural_of(slug, title):
    return PLURAL.get(slug) or lc(title)


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
        parts.append(f'<span>Guests {d["g"]:g}/10{f" · {d["c"]} reviews" if d.get("c") else ""}</span>')
    if d.get('p'):
        parts.append(f'<span>Starting ₹{inr(d["p"])} onwards</span>')
    return ''.join(parts)


def item_html(d):
    # Must stay in step with itemHtml() in assets/js/modules/stays-index.js.
    return (f'<li class="sx-item"><span class="sx-name">{esc(d["n"])}</span><span class="sx-meta">{meta_html(d)}</span>'
            f'<a class="sx-go" href="/hotels/stay?s={esc(d["id"])}{city_qs()}" aria-label="View {esc(d["n"])}">View property</a></li>')


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
                if cols[2] == 'Booking.com':
                    url = booking_affiliate(url)
                links[cols[0]] = {'n': cols[2], 'u': url}
    return links


# Our own stays are also mixed INTO every list (not only pinned on top):
# after the 3rd row, then after every 7th, rotating through OWN. In hostel
# lists they're pitched as the private (not shared) alternative to a dorm.
MIX_FIRST, MIX_EVERY = 3, 7
# Lists where our stays are offered as the private (not shared) alternative.
PRIVATE_ALT = ('k:Hostels', 't:backpacker')


def own_mix_html(o, private):
    # Same look as every other row (no badge or border). In hostel lists the
    # type reads "Private stay" (the not-shared alternative to a dorm). The
    # rating shown is the stay's real guest score, and only when it's 9+.
    parts = ['<span>Unrated</span>', f'<span>{esc(o["a"])}</span>', f'<span>{"Private stay" if private else esc(o["k"])}</span>']
    if o.get('g') and o['g'] >= 9:
        parts.append(f'<span>Guests {o["g"]:g}/10{f" · {o["c"]} reviews" if o.get("c") else ""}</span>')
    if o.get('p'):
        parts.append(f'<span>Starting ₹{inr(o["p"])} onwards</span>')
    return (f'<li class="sx-item"><span class="sx-name">{esc(o["n"])}</span><span class="sx-meta">{"".join(parts)}</span>'
            f'<a class="sx-go" href="{esc(o["u"])}">View property</a></li>')


def mix_html(items, own, private=False):
    """items: list of stays -> <li> html with our stays interleaved."""
    out, k = [], 0
    for i, d in enumerate(items, 1):
        out.append(item_html(d))
        if own and (i == MIX_FIRST or (i > MIX_FIRST and (i - MIX_FIRST) % MIX_EVERY == 0)) and i < len(items):
            out.append(own_mix_html(own[k % len(own)], private)); k += 1
    return ''.join(out)


def own_html(d):
    rating = f'<span>Guests {d["g"]:g}/10{f" · {d["c"]} reviews" if d.get("c") else ""}</span>' if d.get('g') else ''
    label = 'Enquire' if d['u'] == '/contact' else 'View'
    return (f'<li class="sx-item sx-item-own"><span class="sx-name">{esc(d["n"])}</span><span class="sx-meta"><span>{esc(d["a"])}</span>{rating}<span>Book direct, best price</span></span>'
            f'<a class="sx-go" href="{esc(d["u"])}">{label}</a></li>')


def stats_for(members):
    prices = sorted(d['p'] for d in members if d.get('p'))
    areas = {}
    for d in members:
        areas[d['a']] = areas.get(d['a'], 0) + 1
    top_areas = [(a, c) for a, c in sorted(areas.items(), key=lambda kv: -kv[1]) if a not in (f'Elsewhere in {CN}', f'Outside {CN}')][:3]
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
    out.append((f'How many {plural} are there in {CN}?',
                f'There are {st["n"]:,} {plural} in {CN} on this page, spread across {len(st["areas"])} areas. The biggest clusters are {areas_txt}.'))
    if st['top_areas']:
        notes = '; '.join(f'{name} is {AREA_NOTES[name]}' for name, _ in st['top_areas'] if name in AREA_NOTES)
        tip = CITY_COPY.get(CITY, {}).get('area_tip', AREA_TIP_RISHIKESH)
        out.append((f'Which area of {CN} is best for {plural}?',
                    f'It depends on the trip. {notes + ". " if notes else ""}{tip}'))
    if st['median']:
        out.append((f'How much does a {singular} in {CN} cost per night?',
                    f'Listed starting prices put a typical {singular} at about ₹{round_price(st["median"])} a night, with most between ₹{round_price(st["p25"])} and ₹{round_price(st["p75"])}. Prices rise on weekends, long weekends and festivals, and fall in the monsoon.'))
    out.append((f'Are there pet-friendly {plural} in {CN}?',
                f'Yes. {st["pet"]} of the {st["n"]:,} {plural} here list pets as allowed. Confirm the pet policy and any extra fee with the property before booking.'))
    out.append((f'How do I book one of these {plural}?',
                'Press View property to see the listing, or skip the search: send your dates, group size and budget through our contact form or WhatsApp and we will suggest suitable stays, including our own homestays, which you can book direct.'))
    if CITY_COPY.get(CITY, {}).get('kumbh'):
        out.insert(1, KUMBH_FAQ)
    return out


# ---------- landmark pages: hotels/best-stays-near-<landmark>.html ----------
LANDMARK_RADIUS_KM = 2.0      # widened to 3 km where fewer than 10 stays are that close
LANDMARK_MAX_ROWS = 100


def load_landmarks(city):
    import csv
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'landmarks.tsv')
    return [r for r in csv.DictReader(open(path), delimiter='\t') if r['city'] == city]


def km_between(a, b):
    import math
    p = math.radians
    dl, dg = p(b[0] - a[0]), p(b[1] - a[1])
    h = math.sin(dl / 2) ** 2 + math.cos(p(a[0])) * math.cos(p(b[0])) * math.sin(dg / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def dist_label(k):
    if k < 0.05:
        return 'right next to it'
    return f'{int(round(k * 1000 / 50.0) * 50)} m' if k < 1 else f'{k:.1f} km'


def drive_minutes(k):
    """Rough drive for a straight-line distance: roads ~1.35x longer; ~20 km/h
    in town, ~35 km/h on the highway; rounded to 5 minutes."""
    road = k * 1.35
    speed = 20 if road < 10 else 35
    return max(5, int(round(road / speed * 60 / 5.0) * 5))


def with_dist(row_html, label):
    return row_html.replace('<span class="sx-meta">', f'<span class="sx-meta"><span class="sx-dist">{label}</span>', 1)


def build_landmark_pages(stays, own, landmarks, top, bottom, today):
    """One page per landmark in this city: stays by real distance in bands,
    plus our own homestays pitched as the calmer base with an honest distance
    and rough drive time (they also appear in the bands when genuinely close,
    e.g. near AIIMS)."""
    made = []
    # Google Maps places (gm) stay off the landmark pages: they're map-based
    pool = [s for s in stays if s.get('ll') and not s.get('gm')]
    home_city = CITIES[DEFAULT_CITY]['name']
    others_all = landmarks
    for lm in landmarks:
        here = (float(lm['lat']), float(lm['lng']))
        name, slug = lm['name'], lm['slug']
        dist = sorted(((km_between(here, s['ll']), s) for s in pool), key=lambda t: (t[0], t[1]['id']))
        radius = LANDMARK_RADIUS_KM if sum(1 for k, _ in dist if k <= LANDMARK_RADIUS_KM) >= 10 else 3.0
        near = [(k, s) for k, s in dist if k <= radius]
        if len(near) < 5:
            continue
        own_d = sorted(((km_between(here, o['ll']), o) for o in own if o.get('ll')), key=lambda t: t[0])
        own_ids = {id(o) for _, o in own_d}
        rows = sorted(near[:LANDMARK_MAX_ROWS] + [(k, o) for k, o in own_d if k <= radius], key=lambda t: t[0])
        band_html = ''
        for label, lo, hi in [('A short walk (under 500 m)', -1, 0.5), ('Within 1 km', 0.5, 1.0), (f'1–{radius:g} km', 1.0, radius)]:
            grp = [(k, s) for k, s in rows if lo < k <= hi]
            if not grp:
                continue
            items = ''.join(with_dist(own_html(s) if id(s) in own_ids else item_html(s), (dist_label(k) if k < 0.05 else f'{dist_label(k)} away')) for k, s in grp)
            band_html += f'<section class="sx-group"><h2>{esc(label)} <span>{len(grp):,}</span></h2><ul class="sx-list">{items}</ul></section>'
        within1 = sum(1 for k, _ in near if k <= 1)
        prices = sorted(s['p'] for k, s in near if k <= 1 and s.get('p'))
        closest_k, closest = near[0]
        base_line, own_block = '', ''
        if own_d:
            ok, oo = own_d[0]
            if ok <= radius:
                base_line = f'Our own homestays are genuinely close: {oo["n"]} is about {dist_label(ok)} away, roughly {drive_minutes(ok)} minutes by car or auto.'
            elif CITY == DEFAULT_CITY:
                base_line = (f"Prefer quiet nights over walking distance? Our Ganga-view homestays in {home_city}'s Nirmal Bagh are about {ok:.0f} km away, "
                             f'roughly {drive_minutes(ok)} minutes by car or auto. Come in for {name} and go home to the river.')
            else:
                base_line = (f'Coming for {name} but want calm nights? Base yourself at our homestays in {home_city}, about {ok:.0f} km upriver '
                             f'(roughly {drive_minutes(ok)} minutes by car), and skip the crowds after dark.')
            own_rows = ''.join(with_dist(own_html(o), f'{dist_label(k)} from {esc(name)} · ~{drive_minutes(k)} min drive') for k, o in own_d)
            own_block = ('<section class="sx-own" aria-labelledby="sx-own-h"><h2 id="sx-own-h">A calmer base <span>Book direct with us</span></h2>'
                         f'<p class="sx-base">{esc(base_line)}</p><ul class="sx-list">{own_rows}</ul></section>')
        url = f'{SITE}/hotels/best-stays-near-{slug}'
        h1 = f'Best Stays near {name}'
        title = f'Stays near {name}, {CN} | {within1:,} within 1 km, by Distance'
        closest_txt = (', one right next to it' if closest_k < 0.05 else f', the closest {dist_label(closest_k)} away') if closest_k < 1 else ''
        desc = f'{len(near):,} stays within {radius:g} km of {name} in {CN}, sorted by real distance: {within1:,} within 1 km{closest_txt}. Map, prices and tips.'
        faq = [(f'How many stays are near {name}?',
                f'We count {within1:,} stays within 1 km of {name} and {len(near):,} within {radius:g} km. The closest, {closest["n"]}, is {"right next to it" if closest_k < 0.05 else f"about {dist_label(closest_k)} away"}.')]
        if prices:
            faq.append((f'What does a stay near {name} cost?',
                        f'Listed starting prices within 1 km run from about ₹{round_price(prices[0])} to ₹{round_price(prices[-1])} a night, with a typical stay around ₹{round_price(statistics.median(prices))}. Expect more on weekends and festival days.'))
        faq.append((f'Is it better to stay right next to {name}?',
                    'Walking distance is handy for early mornings and evening aartis, but the busiest lanes are noisy and hard to drive into on festival days. '
                    + (base_line or 'A stay 1–2 km away is often quieter and easier to reach by car.')))
        if slug == 'har-ki-pauri':
            faq.insert(1, KUMBH_FAQ)
        guide = f'<a href="{lm["guide"]}">Read our {esc(name)} guide</a> · ' if lm.get('guide') else ''
        mapdata = {'center': here, 'name': name, 'cq': city_qs(),
                   'stays': [[s['ll'][0], s['ll'][1], s['n'], s['id'], dist_label(k)] for k, s in near[:120]],
                   'own': [[o['ll'][0], o['ll'][1], o['n'], o['u']] for o in own if o.get('ll')]}
        ld = [
            {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': h1, 'url': url, 'description': desc, 'dateModified': today.isoformat(),
             'about': {'@type': 'TouristAttraction', 'name': name, 'geo': {'@type': 'GeoCoordinates', 'latitude': here[0], 'longitude': here[1]},
                       'address': {'@type': 'PostalAddress', 'addressLocality': CN, 'addressRegion': 'Uttarakhand', 'addressCountry': 'IN'}},
             'isPartOf': {'@type': 'WebSite', 'name': 'Rishikesh Homestays', 'url': f'{SITE}/'}},
            {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
                {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
                {'@type': 'ListItem', 'position': 2, 'name': f'Best Hotels in {CN}', 'item': f'{SITE}/hotels/best-hotels-in-{CITY}'},
                {'@type': 'ListItem', 'position': 3, 'name': h1, 'item': url}]},
            {'@context': 'https://schema.org', '@type': 'ItemList', 'name': h1, 'numberOfItems': len(near), 'itemListElement': [
                {'@type': 'ListItem', 'position': i + 1, 'item': {'@type': 'LodgingBusiness', 'name': s['n'],
                 'geo': {'@type': 'GeoCoordinates', 'latitude': s['ll'][0], 'longitude': s['ll'][1]},
                 'address': {'@type': 'PostalAddress', 'addressLocality': f'{s["a"]}, {CN}', 'addressRegion': 'Uttarakhand', 'addressCountry': 'IN'}}}
                for i, (k, s) in enumerate(near[:30])]},
            {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
                {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]},
        ]
        head_extra = '\n    '.join([
            f'<meta name="description" content="{esc(desc)}">', f'<meta property="og:title" content="{esc(title)}">',
            f'<meta property="og:description" content="{esc(desc)}">', f'<meta property="og:image" content="{OG_IMAGE}">',
            '<meta property="og:type" content="website">', '<meta property="og:locale" content="en_US">',
            f'<meta property="og:url" content="{url}">', '<meta property="og:site_name" content="Rishikesh Homestays">',
            '<meta name="twitter:card" content="summary_large_image">'])
        page_top = (top.replace('<title>Thanks | Rishikesh Homestays</title>', f'<title>{esc(title)}</title>\n    {head_extra}')
                    .replace('<meta name="robots" content="noindex, follow">', '<meta name="robots" content="index, follow, max-image-preview:large">')
                    .replace(f'{SITE}/thanks', url)
                    .replace('  </head>', '    ' + '\n    '.join(jsonld(o) for o in ld) + '\n  </head>', 1))
        others_near = ', '.join(f'<a href="/hotels/best-stays-near-{l["slug"]}">{esc(l["name"])}</a>' for l in others_all if l['slug'] != slug)
        faq_html = ''.join(f'<details class="sx-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faq)
        lede_closest = ('; one is right next to it' if closest_k < 0.05 else f'; the closest is {dist_label(closest_k)} away') if closest_k < 1 else ''
        mapjson = json.dumps(mapdata, ensure_ascii=False).replace('</', '<\\/')
        note = esc(CITY_COPY.get(CITY, {}).get('note', NOTE_RISHIKESH))
        main_html = (
            f'<main class="sx-page" id="main" data-city="{CITY}" data-landmark="{slug}">\n'
            '      <section class="section">\n        <div class="container">\n'
            f'          <nav class="sx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> <a href="/hotels/best-hotels-in-{CITY}">Best Hotels in {CN}</a> <span aria-hidden="true">›</span> <span>{esc(h1)}</span></nav>\n'
            f'          <p class="eyebrow">Where to stay · {esc(CN)}</p>\n'
            f'          <h1 class="sx-title">{esc(h1)}</h1>\n'
            f'          <p class="sx-lede">Every stay within {radius:g} km of {esc(name)}, sorted by real distance. {within1:,} are within 1 km{lede_closest}.</p>\n'
            f'          <p class="sx-cities">{guide}<a href="/hotels/best-hotels-in-{CITY}">All stays in {CN}</a></p>\n'
            f'          {own_block}\n'
            '          <section class="sp-map" aria-labelledby="lm-map-h">\n            <h2 id="lm-map-h">On the map</h2>\n'
            f'            <div class="sp-map-slot" id="lm-map"><a href="https://www.google.com/maps?q={here[0]},{here[1]}" target="_blank" rel="noopener">Open {esc(name)} in Google Maps</a></div>\n'
            f'            <ul class="sp-map-key" aria-hidden="true"><li><i class="k-this"></i>{esc(name)}</li><li><i class="k-own"></i>Our homestays</li><li><i class="k-near"></i>Stays nearby</li></ul>\n'
            '          </section>\n'
            f'          <script type="application/json" id="lm-data">{mapjson}</script>\n'
            f'          <div id="sx-out">{band_html}</div>\n'
            '          <section class="sx-faq" aria-labelledby="sx-faq-h">\n'
            f'            <h2 id="sx-faq-h">Staying near {esc(name)}: questions travellers ask</h2>\n            {faq_html}\n          </section>\n'
            '          <section class="sx-explore" aria-labelledby="sx-explore-h">\n'
            f'            <h2 id="sx-explore-h">Stay near other places in {CN}</h2>\n            <p>{others_near}</p>\n'
            f'            <p>Or browse <a href="/hotels/best-hotels-in-{CITY}">all stays in {CN}</a>, or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>\n'
            '          </section>\n'
            f'          <p class="sx-note">Distances are straight-line from {esc(name)}; walking and driving routes are longer, and drive times are rough. {note}</p>\n'
            '        </div>\n      </section>\n    </main>')
        page_bottom = bottom.replace('/assets/js/modules/stays-index.js', '/assets/js/modules/landmark-map.js')
        open(f'{STAYS_DIR}/best-stays-near-{slug}.html', 'w').write(page_top + main_html + page_bottom)
        made.append({'slug': slug, 'name': name, 'near': len(near), 'radius': radius})
    print('landmark pages:', ', '.join(f"{m['slug']} ({m['near']})" for m in made) or 'none')
    return made


def jsonld(obj):
    return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=2).replace('</', '<\\/') + '\n</script>'


def ensure_markers(path, before, indent, heading=''):
    """Add this city's start/end markers ahead of `before` the first time."""
    s = open(path).read()
    if f'<!-- {marker()}:start -->' in s:
        return
    block = f'{heading}{indent}<!-- {marker()}:start -->\n{indent}<!-- {marker()}:end -->\n'
    s = s.replace(before, block + before, 1)
    open(path, 'w').write(s)


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
    # Our stays are in Rishikesh; other cities borrow them from Rishikesh's data
    # (labelled with the town) so every city's pages still pin and mix them in.
    home = stays if CITY == DEFAULT_CITY else json.load(open(os.path.join(cache_dir(DEFAULT_CITY), 'stays.json')))
    for key, name, href in OWN:
        hit = next((s for s in home if key in s['u']), None)
        if hit:
            o = {**hit, 'n': name, 'u': href}
            if CITY != DEFAULT_CITY:
                o['a'] = f'{CITIES[DEFAULT_CITY]["name"]} · {hit["a"]}'
            own.append(o)
            if CITY == DEFAULT_CITY:
                stays.remove(hit)
        else:
            print(f'warning: own property not found in crawl: {key}')
    stays = [s for s in stays if s['id'] not in OWN_ALIASES]
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
                [{'title': c[1], 'filter': c[3], 'slug': c[0], **({'plural': PLURAL[c[0]]} if c[0] in PLURAL else {})} for c in live if c[3] != 'all'] +
                [{'title': 'Other stays', 'filter': 'k:Other stays', 'slug': None}])
    meta = {
            'categories': [{'slug': c[0], 'title': c[1], 'filter': c[3], 'count': counts[c[0]], 'group': cat_group(c[3])} for c in live],
            'groups': [[key, label] for key, label in CAT_GROUPS],
            'sections': sections}
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    with open(f'{ROOT}/assets/js/modules/{data_module_name()}', 'w') as fh:
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

    os.makedirs(STAYS_DIR, exist_ok=True)
    live_files = {f'best-{c[0]}-in-{CITY}.html' for c in live}
    for f in os.listdir(STAYS_DIR):
        if re.fullmatch(r'best-[a-z-]+-in-' + CITY + r'\.html', f) and f not in live_files:
            os.remove(f'{STAYS_DIR}/{f}')
    for f in os.listdir(ROOT):  # pre-move root copies
        if re.fullmatch(r'best-[a-z-]+-in-' + CITY + r'\.html', f):
            os.remove(f'{ROOT}/{f}')

    star_counts = {}
    others = [(k, v['name']) for k, v in CITIES.items() if k != CITY and os.path.exists(f'{STAYS_DIR}/best-hotels-in-{k}.html')]
    landmarks = load_landmarks(CITY)
    near_nav = ('<p class="sx-cities">Stay near ' + ', '.join(
        f'<a href="/hotels/best-stays-near-{l["slug"]}">{esc(l["name"])}</a>' for l in landmarks) + '</p>') if landmarks else ''
    for slug, title, singular, flt, intro, guide in live:
        intro, guide = city_copy(slug, title, intro, guide)
        is_master = flt == 'all'
        url = f'{SITE}/hotels/best-{slug}-in-{CITY}'
        members = [s for s in stays if matches(s, flt)]
        st = stats_for(members + [o for o in own if matches(o, flt)])
        n = st['n']
        plural = 'stays' if is_master else plural_of(slug, title)
        h1 = f'Best Hotels in {CN}' if is_master else f'Best {title} in {CN}{TITLE_SUFFIX.get(slug, "")}'
        page_title = (f'Best Hotels in {CN} | All {n:,} Stays by Area & Category' if is_master
                      else f'Best {title} in {CN}{TITLE_SUFFIX.get(slug, "")} | {n:,} Compared by Area & Price')
        kinds_txt = 'hotels, dharamshalas, homestays, guest houses and apartments' if CITY == 'haridwar' else 'hotels, homestays, resorts, camps and hostels'
        desc = (f'{n:,} {CN} stays compared: {kinds_txt} by area, price and facilities, '
                f'with local tips on where to stay.') if is_master else (
                f'Compare {n:,} {plural} in {CN} by area, price and facilities. {intro}')[:300]
        faq = faqs(title, 'stay' if is_master else singular, plural, st, date)

        pill = lambda c: (f'<a href="/hotels/best-{c[0]}-in-{CITY}"{" aria-current=\"page\"" if c[0] == slug else ""}>'
                          f'{"All stays" if c[3] == "all" else esc(c[1])} <small>{counts[c[0]]:,}</small></a>')
        master = [c for c in live if c[3] == 'all']
        strip = ''.join(f'<div class="sx-cats-row">{"".join(pill(c) for c in master)}</div>' for _ in master[:1]) + ''.join(
            f'<div class="sx-cats-row"><span class="sx-cats-label">{label}</span>{"".join(pill(c) for c in members)}</div>'
            for label, members in grouped(live, lambda c: counts[c[0]]))
        fl = lambda c, label=None: (f'<li><a href="/hotels/best-{c[0]}-in-{CITY}"{" aria-current=\"page\"" if c[0] == slug else ""}>'
                                    f'<span>{label or esc(c[1])}</span> <small>{counts[c[0]]:,}</small></a></li>')
        filters = ('<details class="sx-filters" open><summary>Filter stays</summary>'
                   '<nav aria-label="Browse stays by category">'
                   + ''.join(f'<ul class="sx-f-all">{fl(c, f"All stays in {CN}")}</ul>' for c in master[:1])
                   + ''.join(f'<h3>{label}</h3><ul>{"".join(fl(c) for c in members)}</ul>'
                             for label, members in grouped(live, lambda c: counts[c[0]]))
                   + '</nav></details>')
        explore = ''.join(f'<li><a href="/hotels/best-{c[0]}-in-{CITY}">Best hotels in {CN} (all stays)</a> <span>{counts[c[0]]:,}</span></li>'
                          for c in master if c[0] != slug)
        explore = (f'<ul>{explore}</ul>' if explore else '') + ''.join(
            f'<h3>{label}</h3><ul>' + ''.join(
                f'<li><a href="/hotels/best-{c[0]}-in-{CITY}">Best {esc(c[1])} in {CN}</a> <span>{counts[c[0]]:,}</span></li>'
                for c in members if c[0] != slug) + '</ul>'
            for label, members in grouped(live, lambda c: counts[c[0]]))

        if is_master:
            blocks = []
            for sec in sections:
                lst = [s for s in stays if matches(s, sec['filter'])]
                if not lst:
                    continue
                more = (f'<a class="sx-open" href="/hotels/best-{sec["slug"]}-in-{CITY}">View all {len(lst):,} {esc(plural_of(sec["slug"], sec["title"]))}</a>' if sec['slug']
                        else (f'<button type="button" class="sx-more" data-k="c:{esc(sec["title"])}">Show all {len(lst):,}</button>' if len(lst) > MASTER_SECTION else ''))
                blocks.append(f'<section class="sx-group"><h2>{esc(sec["title"])} <span>{len(lst):,}</span></h2>'
                              f'<ul class="sx-list">{mix_html(lst[:MASTER_SECTION], own, sec["filter"] in PRIVATE_ALT)}</ul>'
                              f'{f"<div class=\"sx-actions\">{more}</div>" if more else ""}</section>')
            listing = ''.join(blocks)
            list_items = [d for d in stays][:30]
        else:
            listing = (f'<section class="sx-group"><h2>All {esc(lc(title))} <span>{len(members):,}</span></h2>'
                       f'<ul class="sx-list">{mix_html(members, own, flt in PRIVATE_ALT)}</ul></section>')
            list_items = members[:30]

        ld_breadcrumb = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
            {'@type': 'ListItem', 'position': 2, 'name': h1, 'item': url}]}
        own_here = [o for o in own if matches(o, flt)] or own
        ld_list = {'@context': 'https://schema.org', '@type': 'ItemList', 'name': h1, 'numberOfItems': n,
                   'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'item': {
                       '@type': 'LodgingBusiness', 'name': d['n'],
                       **({'url': SITE + d['u']} if d['u'].startswith('/') else {}),
                       'address': {'@type': 'PostalAddress', 'addressLocality': f'{d["a"]}, {CITIES[d.get("cy", CITY)]["name"]}', 'addressRegion': 'Uttarakhand', 'addressCountry': 'IN'}}}
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
        # City switch at the top: the same category in the other city when it
        # exists there, else that city's main list.
        city_switch = '<nav class="sx-city-switch" aria-label="Switch city">' + ''.join(
            f'<a href="/hotels/best-{slug}-in-{k}" aria-current="page">{esc(v["name"])}</a>' if k == CITY else
            f'<a href="/hotels/best-{slug if os.path.exists(f"{STAYS_DIR}/best-{slug}-in-{k}.html") else "hotels"}-in-{k}">{esc(v["name"])}</a>'
            for k, v in CITIES.items()) + '</nav>'
        kumbh_html = ('''<section class="sx-kumbh" aria-labelledby="sx-kumbh-h">
            <h2 id="sx-kumbh-h">Coming for the Kumbh 2027?</h2>
            <p>Haridwar fills up months ahead of the Kumbh. Stay within walking distance of the ghat you plan to bathe at, expect road closures around the big snan days, and book early. For a calmer base, Rishikesh is about 25 km upriver.</p>
            <p><a href="/haridwar-kumbh-2027">Read our Haridwar Kumbh 2027 guide</a> for reported dates and planning, see <a href="/hotels/best-dharamshalas-in-haridwar">dharamshalas</a> and <a href="/hotels/best-hotels-in-haridwar">all Haridwar stays</a>, or compare <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a>.</p>
          </section>''' if CITY_COPY.get(CITY, {}).get('kumbh') else '')
        explore_more = ('<p>Want a hand choosing? <a href="/homestays">See our handpicked homestays</a>, read <a href="/about-rishikesh">about Rishikesh\'s areas</a>, <a href="/places-to-visit">places to visit</a> and <a href="/things-to-do-in-rishikesh">things to do</a>, plan for the <a href="/haridwar-kumbh-2027">Haridwar Kumbh 2027</a>, or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>'
                        if CITY == DEFAULT_CITY else
                        '<p>Planning a pilgrimage? Read our <a href="/haridwar-kumbh-2027">Haridwar Kumbh 2027 guide</a> and the <a href="/triveni-ghat">Ganga Aarti guide</a>, compare <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a> (25 km upriver), or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>')
        main_html = f'''<main class="sx-page" id="main">
      <section class="section">
        <div class="container" id="sx-root" data-city="{CITY}" data-filter="{esc(flt)}" data-all-title="All {esc(lc(title))}">
          <div class="sx-topbar">
            <nav class="sx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> <span>{esc(h1)}</span></nav>
            {city_switch}
          </div>
          <p class="eyebrow">Where to stay</p>
          <h1 class="sx-title">{esc(h1)}</h1>
          <p class="sx-lede">{esc(intro)}</p>
          <p class="sx-updated">{n:,} {esc(plural)} to compare</p>
          <div class="sx-layout">
          <aside class="sx-side">{filters}</aside>
          <div class="sx-main">
          {near_nav}
          <section class="sx-guide" aria-labelledby="sx-guide-h">
            <h2 id="sx-guide-h">{f'Where to stay in {CN}' if is_master else f'Choosing {esc(lc(title))} in {CN}'}</h2>
            <p>{esc(guide)}</p>
            <ul class="sx-insights">{insight_html}</ul>
          </section>
          {kumbh_html}
          <section class="sx-own" aria-labelledby="sx-own-h">
            <h2 id="sx-own-h">Our homestays <span>{'Book direct with us' if CITY == DEFAULT_CITY else 'Book direct · in Rishikesh, about 25 km upriver'}</span></h2>
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
            <h2 id="sx-explore-h">Explore more stays in {CN}</h2>
            {explore}
            {explore_more}
          </section>
          <p class="sx-note">{esc(CITY_COPY.get(CITY, {}).get('note', NOTE_RISHIKESH))}</p>
          </div>
          </div>
        </div>
      </section>
    </main>'''
        open(f'{STAYS_DIR}/best-{slug}-in-{CITY}.html', 'w').write(page_top + main_html + bottom)

    near_pages = build_landmark_pages(stays, own, landmarks, top, bottom, today)

    # sitemap.xml + llms.txt sections (regenerated between markers)
    sm = ''.join(f'''
  <url>
    <loc>{SITE}/hotels/best-{c[0]}-in-{CITY}</loc>
    <lastmod>{today.isoformat()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{"0.8" if c[3] == "all" else "0.6"}</priority>
  </url>''' for c in live) + ''.join(f'''
  <url>
    <loc>{SITE}/hotels/best-stays-near-{np['slug']}</loc>
    <lastmod>{today.isoformat()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>''' for np in near_pages)
    ensure_markers(f'{ROOT}/sitemap.xml', '</urlset>', '  ')
    replace_between(f'{ROOT}/sitemap.xml', f'<!-- {marker()}:start -->', f'<!-- {marker()}:end -->', sm + '\n  ')
    ll = '\n' + '\n'.join(
        f'- [{f"Best Hotels in {CN} (all stays)" if c[3] == "all" else f"Best {c[1]} in {CN}"}]({SITE}/hotels/best-{c[0]}-in-{CITY}): {counts[c[0]]:,} {"stays of every type, grouped by category" if c[3] == "all" else plural_of(c[0], c[1])}. {city_copy(c[0], c[1], c[4], c[5])[0]}'
        for c in live) + ''.join(
        f"\n- [Best stays near {np['name']}]({SITE}/hotels/best-stays-near-{np['slug']}): {np['near']} stays within {np['radius']:g} km of {np['name']}, sorted by real distance, with a map."
        for np in near_pages) + '\n\n'
    ensure_markers(f'{ROOT}/llms.txt', '## Contact', '', heading=f'## Where to stay in {CN}\n\n')
    replace_between(f'{ROOT}/llms.txt', f'<!-- {marker()}:start -->', f'<!-- {marker()}:end -->', ll)

    # One shared info page for every stay (/hotels/stay?s=<id>), rendered from the
    # data module by stay-page.js. noindex: thin per-stay pages would dilute
    # the category pages, which carry the SEO.
    if CITY != DEFAULT_CITY:
        print('verified booking links:', sum('o' in s for s in stays))
        print('pages:', ', '.join(f'{c[0]} ({counts[c[0]]})' for c in live))
        return
    stay_top = (top.replace('<title>Thanks | Rishikesh Homestays</title>', '<title>Stay details | Rishikesh Homestays</title>')
                   .replace(f'{SITE}/thanks', f'{SITE}/hotels/stay'))
    stay_main = '''<main class="sx-page" id="main">
      <section class="section">
        <div class="container" id="sp-root">
          <p class="sx-note">Loading stay details…</p>
          <noscript><p>This page needs JavaScript. <a href="/hotels/best-hotels-in-rishikesh">Browse all stays in Rishikesh</a> or <a href="/contact">send us your dates</a>.</p></noscript>
        </div>
      </section>
    </main>'''
    stay_bottom = bottom.replace('/assets/js/modules/stays-index.js', '/assets/js/modules/stay-page.js')
    open(f'{STAYS_DIR}/stay.html', 'w').write(stay_top + stay_main + stay_bottom)
    if os.path.exists(f'{ROOT}/stay.html'):
        os.remove(f'{ROOT}/stay.html')  # pre-move copy
    print('verified booking links:', sum('o' in s for s in stays))

    print('pages:', ', '.join(f'{c[0]} ({counts[c[0]]})' for c in live))
    print('skipped:', ', '.join(f'{c[0]} ({counts[c[0]]})' for c in CATEGORIES if c not in live) or 'none')


if __name__ == '__main__':
    CITY = city_from_argv()   # --city <key>; default rishikesh
    CN = CITIES[CITY]['name']
    cache = cache_dir(CITY)
    crawled = sum(1 for _ in open(f'{cache}/props.jsonl'))
    main(f'{cache}/stays.json', crawled)
