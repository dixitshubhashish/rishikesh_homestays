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
import page_dates  # noqa: E402
from search_pages import (PAGES as SEARCH_PAGES, TWINS, heading, path as phrase_path, twin_of, rule_matches, select, price_band,  # noqa: E402
                          page_content, LANDMARK_NOTES, TOP_MIN_REVIEWS, PRICE_BANDS, RIVER_AREAS, KINDS as SEARCH_KINDS)

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
# Honest dates (page_dates.py): a page's sitemap <lastmod> and JSON-LD dateModified move only
# when its <main> changes. Pages are written with LASTMOD_TOKEN, swapped for the date on write.
DATES = {}       # the page-dates.tsv registry, loaded in main()
LASTMOD = {}     # page stem -> lastmod, for sitemap.xml
LASTMOD_TOKEN = '__LASTMOD__'


def write_dated(stem, head, main_html, tail):
    LASTMOD[stem] = page_dates.date_for(DATES, f'/hotels/{stem}', main_html)
    open(f'{STAYS_DIR}/{stem}.html', 'w', encoding='utf8', newline='\n').write(head.replace(LASTMOD_TOKEN, LASTMOD[stem]) + main_html + tail)


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
_AFF = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'js', 'modules', 'affiliate-links.js'), encoding='utf8').read()
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
        'kinds': 'hotels, dharamshalas, homestays, guest houses and apartments',
        'explore': '<p>Planning a pilgrimage? Read our <a href="/haridwar-kumbh-2027">Haridwar Kumbh 2027 guide</a> and the <a href="/triveni-ghat">Ganga Aarti guide</a>, compare <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a> (25 km upriver), or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>',
    },
    'dehradun': {
        'master_intro': 'Every hotel, homestay, villa, apartment and guest house we found listed in Dehradun, from simple rooms by the station to Rajpur Road boutique stays and villas in the Mussoorie foothills, grouped by category.',
        'intro': '{title} across Dehradun, from the Clock Tower and the Rajpur Road to Sahastradhara, the Mussoorie Road foothills and the airport side.',
        'guide': 'Dehradun spreads out along a few main roads. The Clock Tower and Paltan Bazaar are the busy old centre; the railway station and the ISBT bus terminal sit to the south-west; the Rajpur Road runs north-east towards Rajpur and the road up to Mussoorie, with many of the cafes, restaurants and boutique stays. Sahastradhara Road and the Mussoorie Road foothills are greener and quieter, with villas, resorts and homestays; the Chakrata Road and the Haridwar Road are practical bases for the highway, and Jolly Grant airport is on the Rishikesh side. For a short trip, stay near the Rajpur Road or the Clock Tower; for a quiet one, go towards Sahastradhara or Malsi.',
        'area_tip': 'For cafes, restaurants and an evening walk, stay on the Rajpur Road or around the Clock Tower; for trains and buses, near the railway station or the ISBT; for quiet nights and green views, towards Sahastradhara Road, Malsi or the Mussoorie Road foothills.',
        'note': 'Our area lines are drawn with a local\'s pencil, not a surveyor\'s, so a stay near the border might sit one neighbourhood over. Rates rise on weekends, long weekends, school holidays and the summer rush to the hills, so give the property a quick check before you pack.',
        'kinds': 'hotels, villas, apartments, homestays and guest houses',
        'explore': '<p>Heading up the hill? Compare <a href="/hotels/best-hotels-in-mussoorie">stays in Mussoorie</a> (about 35 km up the hill road), see <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a> (about 45 km away by road), look at <a href="/homestays">our own handpicked homestays</a>, or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>',
    },
    'mussoorie': {
        'master_intro': 'Every hotel, resort, cottage, homestay and apartment we found listed in Mussoorie, from Mall Road hotels to quiet Landour cottages and Kempty Road resorts, grouped by category.',
        'intro': '{title} across Mussoorie, from the Mall Road and Library Chowk to Landour, Camel\'s Back Road and the Kempty Road.',
        'guide': 'Mussoorie is a long ridge town, so where you sleep decides how you spend the day. The Mall Road between Library Chowk and Kulri is the lively centre, with shops, cafes and the evening walk; Library Chowk and Charleville, at the western end, are older and a little calmer; Camel\'s Back Road and Gun Hill are for slow evening strolls; Landour and Char Dukan, to the east, are quieter, with old cottages and bakeries; Barlowganj and Jharipani sit on the slopes below; and the Kempty Road runs out towards Kempty Falls, with many of the resorts and views. On busy weekends and holidays the Mall Road area gets crowded, so ask your stay how far a car can go and how much of the way is on foot.',
        'area_tip': 'For the Mall Road, cafes and evening walks, stay around Library Chowk or Kulri; for quiet, try Landour or Camel\'s Back Road; for views and the falls, the Kempty Road.',
        'note': 'Our area lines are drawn with a local\'s pencil, not a surveyor\'s, so a stay near the border might sit one neighbourhood over. Rates jump on weekends, long weekends, school holidays and the summer rush, so give the property a quick check before you pack.',
        'kinds': 'hotels, resorts, cottages, homestays and apartments',
        'explore': '<p>Coming up from the plains? Compare <a href="/hotels/best-hotels-in-dehradun">stays in Dehradun</a> (about 35 km down the hill road), see <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a> (about 80 km away by road, through Dehradun), look at <a href="/homestays">our own handpicked homestays</a>, or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>',
    },
}
AREA_TIP_RISHIKESH = 'For the evening aarti and ashrams, stay near Swarg Ashram, Muni Ki Reti or Triveni Ghat; for rafting, stay towards Shivpuri.'
NOTE_RISHIKESH = "Our area lines are drawn with a local's pencil, not a surveyor's, so a stay near the border might sit one neighbourhood over. Rates rise and fall with rafting season, festivals and the monsoon, so give the property a quick check before you pack."
KUMBH_FAQ = ('Where should I stay in Haridwar for the Kumbh 2027?',
             'Stay within walking distance of the ghat you plan to bathe at: Har Ki Pauri and the Upper Road for the main snans, or Kankhal, Bhupatwala and Shantikunj for calmer bases a short walk or ride away. Roads close to vehicles around the big bathing days, so a walkable stay matters more than a fancy one. Book as early as you can; for a quieter base, Rishikesh is about 25 km upriver. Our Haridwar Kumbh 2027 guide covers the reported dates and planning.')


def city_copy(slug, title, intro, guide):
    if slug == 'dharamshalas':
        return intro.replace('Dharamshalas:', f'Dharamshalas in {CN}:', 1), guide  # otherwise city-neutral
    c = CITY_COPY.get(CITY)
    if not c:
        return intro, guide
    if slug == 'hotels':
        return c['master_intro'], c['guide']
    return c['intro'].format(title=title), c['guide']


def clip_desc(text, limit=300):
    """A meta description that fits `limit` without cutting a word: the last whole sentence that fits,
    else the last whole word and an ellipsis (it used to be cut mid-word, '... Stays acr')."""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind('. '), cut.rfind('? '), cut.rfind('! '))
    if end >= limit // 2:
        return cut[:end + 1]
    return cut[:cut.rfind(' ')].rstrip(' ,;:–-') + '…'


# Why book our own homestays direct (owner, 2026-10-06): shown under every "Book direct with us" heading.
OWN_PERKS = '<ul class="sx-own-perks"><li>Stay 5+ days and save 15%</li><li>No booking-site fees: you pay us direct</li><li>A local replies on WhatsApp, usually within 30 minutes</li></ul>'


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
    'Sahastradhara Road': 'the road out towards the Sahastradhara sulphur-spring falls, greener and quieter, with resorts, villas and homestays; you will want a vehicle',
    'Mussoorie Road & Malsi': 'the foothills on the way up to Mussoorie, around Malsi, with villas and hillside homestays',
    'Rajpur Road': 'the long, cafe-lined road from the Clock Tower towards Rajpur, popular for restaurants, shops and boutique stays',
    'Dalanwala & Survey Chowk': 'a central, mostly residential pocket near the lower Rajpur Road and the cantonment, handy for the market',
    'Clock Tower & Paltan Bazaar': 'the old heart of Dehradun around the Clock Tower and Paltan Bazaar; busy, walkable and close to the shops',
    'Railway Station & Tyagi Road': 'around the railway station and the Tyagi Road, handy for trains and an early start',
    'ISBT & Majra': 'near the ISBT bus terminal and the Haridwar bypass, handy for buses and the road to Haridwar and Rishikesh',
    'Saharanpur Road & Patel Nagar': 'the western side towards the Saharanpur Road, practical with easy road links towards Delhi',
    'Haridwar Road & Rispana': 'south of the centre on the Haridwar Road, with practical hotels and easy access to the highway',
    'Clement Town & Mindrolling': 'the quieter south-western side around Clement Town and the Mindrolling Monastery',
    'FRI, Ballupur & Kaulagarh': 'the greener west side near the Forest Research Institute, Ballupur and Kaulagarh',
    'Vasant Vihar & Indira Nagar': 'a residential area on the west side, towards the Chakrata Road',
    'Chakrata Road & Premnagar': 'the western edge on the Chakrata Road, around Premnagar and the Indian Military Academy side',
    'Raipur & Maldevta': 'the eastern side towards Raipur and Maldevta, greener and quieter, with a drive into the centre',
    'Jolly Grant & Doiwala': 'on the Rishikesh side near Jolly Grant airport and Doiwala, handy for flights',
    'Landour & Char Dukan': 'the quieter, older side to the east, with old cottages, bakeries and walks',
    'Library Chowk & Charleville': 'the western end of the Mall Road, a little calmer than Kulri, with the old library and shops',
    "Camel's Back Road & Gun Hill": 'the quiet walking road above the Mall Road and the Gun Hill ropeway side',
    'Mall Road & Kulri': 'the lively centre, with the Mall Road, Kulri bazaar, cafes and the evening walk',
    'Happy Valley & Hathipaon': 'the western slopes around Happy Valley and the George Everest road, calmer and greener',
    'Barlowganj & Jharipani': 'the slopes below the town towards Barlowganj and Jharipani, quieter and a climb back up',
    'Kempty Road': 'the road out towards Kempty Falls, with resorts and views; you will want a vehicle',
    'Mussoorie Lake & Dehradun Road': 'the Dehradun side of town, around Mussoorie Lake, the first stretch on the way up from Dehradun',
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
# Category pages whose <h1> is a search phrase as people type it, not "Best <title> in <city>".
H1_PHRASE = {}  # e.g. {'luxury-stays': 'Luxury Stays in {City}'}; that phrase now has its own page (search-pages.tsv)


def lc(title):
    """Lower-case a category title for running text, keeping "BHK"."""
    return re.sub(r'\bbhk\b', 'BHK', title.lower())


# Running-text plural where a count comes first ("58 two-bedroom (2 BHK)
# stays", not "58 2 BHK stays"); every other category uses lc(title).
PLURAL = {'2-bhk-stays': 'two-bedroom (2 BHK) stays', '3-bhk-and-bigger-stays': 'stays with 3 or more bedrooms'}


def plural_of(slug, title):
    return PLURAL.get(slug) or lc(title)


# ---- the order of a stays list (owner, 2026-10-06) --------------------------------------------------------------------
# Not alphabetical, not by price: our own stays are pinned elsewhere; then, in this order,
#   A  linked (verified booking page) stays of promising brands (promising-brands.tsv, editable)
#   B  the other linked stays with an acceptable rating, spread: one of each first letter in turn
#   D  stays without a link yet, acceptable rating, spread the same way
#   C  linked stays with a bad rating      \ behind "View all", never in the directly shown part
#   E  unlinked stays with a bad rating    /
# "Bad rating" = BAD_RATING or lower out of 10 from at least BAD_MIN_REVIEWS reviews (an unrated stay is not bad).
# The directly shown part is the linked stays that are not bad (topped up to SHOW_MIN). Mirrored in stays-index.js
# (BAD_RATING, BAD_MIN_REVIEWS, isBad) and tested by tests/integration/stays-order.test.js.
BAD_RATING = 7.0
BAD_MIN_REVIEWS = 5
_SKIP_WORDS = {'hotel', 'the', 'shri', 'shree', 'sri', 'new', 'a', 'hostel', 'homestay', 'resort'}


def is_bad(stay):
    return bool(stay.get('g')) and stay['g'] < BAD_RATING and (stay.get('c') or 0) >= BAD_MIN_REVIEWS


def promising_brands():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'promising-brands.tsv')
    if not os.path.exists(path):
        return []
    return [re.compile(r'(?<![A-Za-z])' + re.escape(l.split('\t')[0]) + r'(?![A-Za-z])', re.I)
            for l in open(path, encoding='utf8').read().splitlines()[1:] if l.strip()]


def is_promising(stay, brands):
    return any(b.search(stay['n']) for b in brands)


def _letter(stay):
    words = [w for w in re.findall(r'[A-Za-z0-9]+', stay['n']) if w.lower() not in _SKIP_WORDS]
    return (words[0][0] if words else stay['n'][:1] or '#').lower()


def spread(items):
    """One of each first letter in turn, the letters and the stays within a letter in a fixed pseudo-random order."""
    buckets = {}
    for s in sorted(items, key=lambda s: hashlib.sha1(s['u'].encode()).hexdigest()):
        buckets.setdefault(_letter(s), []).append(s)
    letters = sorted(buckets, key=lambda L: hashlib.sha1(('letter-' + L).encode()).hexdigest())
    out, i = [], 0
    while len(out) < len(items):
        for L in letters:
            if i < len(buckets[L]):
                out.append(buckets[L][i])
        i += 1
    return out


def order_stays(stays):
    brands = promising_brands()
    linked = [s for s in stays if 'o' in s]
    free = [s for s in stays if 'o' not in s]
    a = [s for s in linked if not is_bad(s) and is_promising(s, brands)]
    b = [s for s in linked if not is_bad(s) and not is_promising(s, brands)]
    c = [s for s in linked if is_bad(s)]
    d = [s for s in free if not is_bad(s)]
    e = [s for s in free if is_bad(s)]
    return (sorted(a, key=stable_key) + spread(b) + spread(d) + spread(c) + spread(e))


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


def item_html(d, city=None):
    # Must stay in step with itemHtml() in assets/js/modules/stays-index.js.
    # city: a stay of another city (the "nearest in ..." lists on a thin page).
    qs = city_qs() if city is None else ('' if city == DEFAULT_CITY else f'&c={city}')
    return (f'<li class="sx-item"><span class="sx-name">{esc(d["n"])}</span><span class="sx-meta">{meta_html(d)}</span>'
            f'<a class="sx-go" href="/hotels/stay?s={esc(d["id"])}{qs}" aria-label="View {esc(d["n"])}">View property</a></li>')


# ---- the /homestays page: our three stays on top (data.js, no special mention), then these picks --------------------
# Top brands and the Nirmal Bagh homes come from the same ordered list as the stays pages (linked, not badly rated),
# with clear links to search more stays. Written between <!-- homestays-picks --> markers in homestays.html on every build.
PICKS_START, PICKS_END = '<!-- homestays-picks -->', '<!-- /homestays-picks -->'
PICKS_BRANDS, PICKS_AREA_ROWS = 8, 8
PICKS_AREA = 'Nirmal Bagh near Ganges'  # the area name in AREAS (data.js)
# the same words as the footer links ("Best Hotels in Rishikesh"), so the texts are translated once
SEARCH_TITLES = {'hotels': 'Hotels', 'homestays': 'Homestays', 'guest-houses': 'Guest Houses', 'apartments': 'Apartments', 'resorts': 'Resorts',
                 'hostels': 'Hostels', 'villas': 'Villas', 'ganga-view-stays': 'Ganga View Stays', 'budget-stays': 'Budget Stays',
                 'luxury-stays': 'Luxury Stays'}
PICKS_SEARCH = list(SEARCH_TITLES)


def write_homestays_picks(stays):
    path = os.path.join(ROOT, 'homestays.html')
    page = open(path, encoding='utf8').read()
    if PICKS_START not in page:
        return
    brands = promising_brands()
    fine = [d for d in stays if 'o' in d and not is_bad(d)]
    top = [d for d in fine if is_promising(d, brands)][:PICKS_BRANDS]
    nb = [d for d in fine if d['a'] == PICKS_AREA and d not in top][:PICKS_AREA_ROWS]
    ul = lambda items: '<ul class="sx-list">' + ''.join(item_html(d) for d in items) + '</ul>'
    links = ''.join(f'<a class="btn btn-secondary" href="/hotels/best-{s_}-in-rishikesh">Best {SEARCH_TITLES[s_]} in Rishikesh</a>'
                    for s_ in PICKS_SEARCH if os.path.exists(os.path.join(ROOT, 'hotels', f'best-{s_}-in-rishikesh.html')))
    haridwar = ''.join(f'<a class="btn btn-secondary" href="/hotels/best-{s_}-in-haridwar">Best {SEARCH_TITLES[s_]} in Haridwar</a>'
                       for s_ in PICKS_SEARCH[:3] if os.path.exists(os.path.join(ROOT, 'hotels', f'best-{s_}-in-haridwar.html')))
    block = f"""{PICKS_START}
      <section class="section" id="top-brands" aria-labelledby="top-brands-h">
        <div class="container">
          <p class="eyebrow">More stays</p>
          <h2 id="top-brands-h">Top brands in Rishikesh</h2>
          <p>Well-known hotel brands in Rishikesh, each with a verified booking page. Pick one and leave your name and number: we send you on to the booking site and can help with dates.</p>
          {ul(top)}
        </div>
      </section>
      <div class="container"><div class="rh-ad-slot" data-ad="article"></div></div>
      <section class="section alt" id="nirmal-bagh-homes" aria-labelledby="nirmal-bagh-h">
        <div class="container">
          <h2 id="nirmal-bagh-h">Homes in Nirmal Bagh</h2>
          <p>Stays in Nirmal Bagh, a quieter residential pocket by the Ganga, away from the Tapovan and Laxman Jhula lanes.</p>
          {ul(nb)}
        </div>
      </section>
      <section class="section" id="search-more" aria-labelledby="search-more-h">
        <div class="container">
          <h2 id="search-more-h">Search more stays in Rishikesh</h2>
          <p>Every hotel, homestay, guest house and hostel we list, with filters for area, price and distance.</p>
          <div class="search-more-links">{links}{haridwar}</div>
        </div>
      </section>
      {PICKS_END}"""
    out = page[:page.index(PICKS_START)] + block + page[page.index(PICKS_END) + len(PICKS_END):]
    if out != page:
        open(path, 'w', encoding='utf8', newline='\n').write(out)


def load_ota_links():
    """ota-links.tsv: one booking-site page per stay, found by web search and
    checked on name + area. Only 'verified' rows are used; doubtful/none are
    kept for the record so they aren't searched again."""
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ota-links.tsv')
    links = {}
    if os.path.exists(path):
        for line in open(path, encoding='utf8').read().splitlines()[1:]:
            cols = line.split('\t')
            if len(cols) >= 4 and cols[1] == 'verified' and cols[3].startswith('https://'):
                url = cols[3]
                if cols[2] == 'Booking.com':
                    url = booking_affiliate(url)
                links[cols[0]] = {'n': cols[2], 'u': url}
    return links


def prepared_stays(city, ota):
    """Another city's stays as its own pages list them: our stays and their aliases out,
    verified booking links in, linked first (in step with the start of main())."""
    keys = [k for k, _, _ in OWN]
    path = os.path.join(cache_dir(city), 'stays.json')
    if not os.path.exists(path):
        # no crawl of that city here (e.g. the scheduled refresh on GitHub crawls Rishikesh only):
        # use its committed data module, which already has our stays out, links in and this order
        module = open(f'{ROOT}/assets/js/modules/{data_module_name(city)}', encoding='utf8').read()
        return json.loads(re.search(r'export const STAYS_INDEX = (\[.*\]);', module).group(1).replace('<\\/', '</'))
    out = [s for s in json.load(open(path, encoding='utf8'))
           if s['id'] not in OWN_ALIASES and not any(k in s['u'] for k in keys)]
    for s in out:
        if s['id'] in ota:
            s['o'] = ota[s['id']]
    return order_stays(out)


# Words kept as written when a phrase is used in running text.
KEEP_CASE = {'OYO', 'Airbnb', 'Ganga', 'Ganges', 'AIIMS', 'BHK', 'ISBT', 'BHEL', 'SIDCUL', 'FRI', 'IMA'}
# Where the other city is, seen from a page of this one (for the "nearest in ..." lists).
# (road distances are the usual rounded figures; Rishikesh and Haridwar sit on the same river)
AWAY = {('rishikesh', 'haridwar'): 'about 25 km downriver', ('haridwar', 'rishikesh'): 'about 25 km upriver',
        ('rishikesh', 'dehradun'): 'about 45 km by road', ('dehradun', 'rishikesh'): 'about 45 km by road',
        ('haridwar', 'dehradun'): 'about 55 km by road', ('dehradun', 'haridwar'): 'about 55 km by road',
        ('dehradun', 'mussoorie'): 'about 35 km by road, uphill', ('mussoorie', 'dehradun'): 'about 35 km by road, downhill',
        ('rishikesh', 'mussoorie'): 'about 80 km by road', ('mussoorie', 'rishikesh'): 'about 80 km by road',
        ('haridwar', 'mussoorie'): 'about 90 km by road', ('mussoorie', 'haridwar'): 'about 90 km by road'}
# Where to look first when a city has too few stays for a page: the nearest cities, in order.
NEAREST = {'rishikesh': ['haridwar', 'dehradun', 'mussoorie'], 'haridwar': ['rishikesh', 'dehradun', 'mussoorie'],
           'dehradun': ['rishikesh', 'mussoorie', 'haridwar'], 'mussoorie': ['dehradun', 'rishikesh', 'haridwar']}


def away(frm, to):
    return AWAY[(frm, to)]


def home_away(city=None):
    """How far our own homestays (in Rishikesh) are from a city's pages."""
    return away(city or CITY, DEFAULT_CITY)
# A thin category page's "similar stays here" list: the closest category that has stays
# (None: the city's best-reviewed stays).
CATEGORY_FALLBACK = {'camps': 'resorts', 'studio-and-1-bhk-stays': 'apartments', '2-bhk-stays': 'apartments',
                     '3-bhk-and-bigger-stays': 'holiday-rentals', 'aparthotels': 'apartments',
                     'dharamshalas': 'ashram-stays', 'boutique-hotels': None}


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


# Owner, 2026-10-04: stays with a verified booking link are listed directly (owner, 2026-10-06: unless badly rated);
# the rest wait behind "View all" (still in the HTML, so crawlers see them).
# A list with fewer linked stays is topped up to SHOW_MIN so it never looks empty.
# Must stay in step with SHOW_MIN / shownCount() in stays-index.js.
SHOW_MIN = 10


def split_shown(items):
    """items in order_stays order -> (shown directly: the linked stays that are not badly rated, behind "View all")."""
    n = max(sum('o' in d and not is_bad(d) for d in items), min(SHOW_MIN, len(items)))
    return items[:n], items[n:]


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


def insights(title, plural, st, boxed=False):
    """The data lines under a page's guide text. boxed: the Quick facts box at the top already gives
    the price range and the review scores, so they are not repeated here."""
    lines = []
    if st['top_areas']:
        a = ', '.join(f'{esc(name)} ({c})' for name, c in st['top_areas'])
        lines.append(f'Most {plural} are in {a}.')
    if st['median'] and not boxed:
        lines.append(f'The typical listed starting price is about ₹{round_price(st["median"])} a night; the middle half of {plural} start between ₹{round_price(st["p25"])} and ₹{round_price(st["p75"])} (based on {st["priced"]} listings with a price).')
    if st['starred']:
        lines.append(f'{st["starred"]} have a star rating, including {st["five"]} five-star and {st["four"]} four-star.')
    if CITY in ('rishikesh', 'haridwar'):
        lines.append(f'{st["pet"]} ({pct(st["pet"], st["n"])}) allow pets and {st["ganga"]} ({pct(st["ganga"], st["n"])}) are on or facing the Ganga.')
    else:
        lines.append(f'{st["pet"]} ({pct(st["pet"], st["n"])}) allow pets.')
    if st['rated'] and not boxed:
        lines.append(f'Of the {st["rated"]} with at least five guest reviews, {st["well_rated"]} score 9/10 or higher.')
    return lines


# Timings that change (trains): a plain link to the source that has them, never a time we would have to keep current.
NTES_LINK = ('<p class="sx-source">Train times and platforms change, so check them on '
             '<a href="https://enquiry.indianrail.gov.in/ntes/" target="_blank" rel="noopener">Indian Railways\' train enquiry (NTES)</a> '
             'before you leave for the station.</p>')
STATION_SLUGS = {'rishikesh-railway-station', 'haridwar-railway-station', 'dehradun-railway-station'}


# ---------- Quick facts: short, self-contained lines near the top of every stays page ----------
# Each line names its place and gives a number, so it still reads true when quoted on its own
# (AI answers and search snippets lift single sentences). Only facts from the page's own data.
def facts_html(lines, label):
    if not lines:
        return ''
    return (f'<aside class="sx-facts" aria-labelledby="sx-facts-h"><h2 id="sx-facts-h">Quick facts <span>{esc(label)}</span></h2>'
            f'<ul>{"".join(f"<li>{esc(x)}</li>" for x in lines)}</ul></aside>')


def price_fact(prices, what, where):
    """Cheapest, typical and middle-half listed starting price. No top end: one mispriced listing at
    ₹1,00,000 would make a quotable range wrong."""
    prices = sorted(p for p in prices if p)
    if len(prices) < 2:
        return None
    w = f'{what}{" " + where if where else ""}'
    q = lambda f: round_price(prices[min(len(prices) - 1, int(len(prices) * f))])
    lo, mid = round_price(prices[0]), round_price(statistics.median(prices))
    if len(prices) < 4 or q(0.25) == q(0.75):
        return f'Listed starting prices for {w} begin at about ₹{lo} a night; a typical one starts around ₹{mid}.'
    return (f'Listed starting prices for {w} begin at about ₹{lo} a night; a typical one starts around ₹{mid}, '
            f'and the middle half between ₹{q(0.25)} and ₹{q(0.75)}.')


def own_fact(own, place_name=None, place_ll=None):
    """Where our own homestays are, from a place: straight-line distance and a rough drive in Rishikesh,
    the town (25 km upriver from Haridwar, further from the others) from another city."""
    home = CITIES[DEFAULT_CITY]['name']
    with_ll = [o for o in own if o.get('ll')]
    if not with_ll:
        return None
    area = re.sub(r'^.* · ', '', with_ll[0]['a'])
    if CITY != DEFAULT_CITY and not place_ll:
        return f'Our own Ganga-side homestays are in {area}, {home}, {home_away()} from {CN}, and are booked direct with us.'
    if not place_ll:
        return None
    k, o = min(((km_between(place_ll, o['ll']), o) for o in with_ll), key=lambda t: t[0])
    if k < 0.05:
        return None
    if CITY not in (DEFAULT_CITY, 'haridwar'):   # hill-side cities: no drive time promised from a straight line
        return (f'Our own homestays in {area}, {home} are about {dist_label(road_km(k))} from {place_name} by road '
                f'({home_away()} from {CN}), and are booked direct with us.')
    return (f'Our own homestays in {area}, {home} are about {dist_label(road_km(k))} from {place_name} by road, '
            f'roughly {drive_minutes(k)} minutes by car, and are booked direct with us.')


def faqs(title, singular, plural, st, date):
    out = []
    areas_txt = ', '.join(f'{name} ({c})' for name, c in st['top_areas']) or 'several areas'
    out.append((f'How many {plural} are there in {CN}?',
                f'There are {st["n"]:,} {plural} in {CN} on this page, spread across {len(st["areas"])} areas. The biggest clusters are {areas_txt}.'))
    if st['top_areas']:
        notes = '; '.join(f'{name} is {AREA_NOTES[name]}' for name, _ in st['top_areas'] if name in AREA_NOTES)
        tip = CITY_COPY.get(CITY, {}).get('area_tip', AREA_TIP_RISHIKESH)
        out.append((f'Which area of {CN} is best for {plural}?',
                    f'{tip} {notes + "." if notes else ""}'.strip()))
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
LANDMARK_RADIUS_KM = 2.0      # widened to 3 km, then 5 km, where fewer than 10 stays are that close
LANDMARK_MAX_ROWS = 100


def load_landmarks(city):
    import csv
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'landmarks.tsv')
    return [r for r in csv.DictReader(open(path, encoding='utf8', newline=''), delimiter='\t') if r['city'] == city]


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


# Terrain correction for the reader-facing "about X km from <landmark>" figures (owner, 2026-10-08):
# straight-line (km_between) undercounts real road distance, more so where roads switchback, as in
# the hill terrain around Mussoorie and parts of Dehradun. A paid routing API call per stay-landmark
# pair (thousands of pairs per city) is out of scope, so this is a flat correction factor instead —
# still an estimate, not exact routing, and the display text says so. Only applied where a figure is
# shown to a reader (the two `road_km()` call sites below); never changes km_between's own output, so
# the "nearby stays" radius filters and sort order these pages already tune around are untouched, and
# drive_minutes() (which has its own, separately calibrated x1.35 factor) is never double-corrected.
TERRAIN_FACTOR = {'mussoorie': 1.35, 'dehradun': 1.25, 'rishikesh': 1.15, 'haridwar': 1.1}


def road_km(k):
    return k * TERRAIN_FACTOR.get(CITY, 1.15)


def drive_minutes(k):
    """Rough drive for a straight-line distance: roads ~1.35x longer; ~20 km/h
    in town, ~35 km/h on the highway; rounded to 5 minutes."""
    road = k * 1.35
    speed = 20 if road < 10 else 35
    return max(5, int(round(road / speed * 60 / 5.0) * 5))


# "Near <place>" search pages grouped by distance (group 'd'); in step with DBANDS in stays-index.js.
DIST_BANDS = [(0.5, 'Under 500 m'), (1.0, '500 m to 1 km'), (2.0, '1 to 2 km'), (3.0, '2 to 3 km'), (None, '3 km and more')]
# a place out of town searched over a wide radius (IIT Roorkee, 40 km) is grouped in 5 km steps
FAR_DIST_BANDS = [(5.0, 'Under 5 km'), (10.0, '5 to 10 km'), (15.0, '10 to 15 km'), (20.0, '15 to 20 km'),
                  (25.0, '20 to 25 km'), (30.0, '25 to 30 km'), (None, '30 km and more')]
FAR_RADIUS_KM = 8


# Stops of the distance range on "near <place>" pages; in step with DIST_STOPS in stays-index.js.
DIST_STOPS = [0, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50]
DIST_DEFAULT_KM = 20  # a page without a place of its own starts at 20 km from its town centre (owner, 2026-10-05)


def dist_range_html(lm_name, radius, center):
    """Two slider ends with a box at each end (a number and m/km), measured from the page's own place (a near page)
    or its town centre (every other page): 0 m to the page's radius, or to 20 km, to start."""
    top = len(DIST_STOPS) - 1
    radius = radius or DIST_DEFAULT_KM
    hi = next((i for i, v in enumerate(DIST_STOPS) if v >= radius - 1e-9), top)
    to_val, to_unit = (f'{round(radius * 1000)}', 'm') if radius < 1 else (f'{radius:g}', 'km')
    unit = lambda u: ''.join(f'<option value="{x}"{" selected" if x == u else ""}>{x}</option>' for x in ('m', 'km'))
    return (f'<div class="sx-row sx-dist" id="sx-dist" data-center="{esc(center)}" style="--lo:0%;--hi:{hi / top * 100:.2f}%">'
            f'<span class="sx-label">Distance from {esc(lm_name)}</span>'
            f'<span class="sx-dist-end"><input type="number" id="sx-dist-lo" class="sx-input" min="0" step="any" value="0" aria-label="From (distance from {esc(lm_name)})">'
            f'<select id="sx-dist-lo-u" class="sx-input" aria-label="Unit for from">{unit("m")}</select></span>'
            f'<span class="sx-dist-track"><span class="sx-dist-fill" aria-hidden="true"></span>'
            f'<input type="range" id="sx-dist-a" min="0" max="{top}" step="1" value="0" aria-label="Nearest distance">'
            f'<input type="range" id="sx-dist-b" min="0" max="{top}" step="1" value="{hi}" aria-label="Farthest distance"></span>'
            f'<span class="sx-dist-end"><input type="number" id="sx-dist-hi" class="sx-input" min="0" step="any" value="{to_val}" aria-label="To (distance from {esc(lm_name)})">'
            f'<select id="sx-dist-hi-u" class="sx-input" aria-label="Unit for to">{unit(to_unit)}</select></span></div>')


def dist_bands(radius):
    return FAR_DIST_BANDS if radius and radius > FAR_RADIUS_KM else DIST_BANDS


def dist_band(k, radius=None):
    return next(label for top, label in dist_bands(radius) if top is None or k <= top)


def with_dist(row_html, label):
    return row_html.replace('<span class="sx-meta">', f'<span class="sx-meta"><span class="sx-dist">{label}</span>', 1)


# Practical advice on a landmark page, by kind of place (landmarks.tsv schema column).
LANDMARK_TIPS = {
    'Hospital': 'Coming for treatment or to look after a patient? Ask for a lift or a ground-floor room, a quiet room to rest in, flexible check-in and late check-out, and whether meals or a kitchen are available for longer stays.',
    'TrainStation': 'Arriving late or leaving early? Confirm the check-in time, ask the stay to hold your room for a late arrival, and book a cab the evening before an early train.',
    'BusStation': 'Arriving late or leaving early? Confirm the check-in time, ask the stay to hold your room for a late arrival, and keep an eye on luggage at the busy bus stand.',
    'Airport': 'Flights land through the day, so confirm early check-in or late check-out if you need it, and book your cab in advance: taxis at the airport cost more than a pre-booked one.',
    'CollegeOrUniversity': 'Coming for admissions, exams or a convocation? Rooms nearby fill up on those days, so book early, and ask for Wi-Fi and a desk if you need to study or work.',
    'Place': 'On a work or campus visit? Ask about GST invoices, Wi-Fi, a work desk and parking, and whether breakfast starts early enough for your day.',
    'TouristAttraction': 'Visiting on a festival day? Expect closed lanes and crowds around the ghats and temples, plan to walk the last stretch, and book ahead for weekends.',
}


HILL_SIGHT_TIP = 'Visiting on a busy weekend or holiday? Expect crowds and slow roads around the sights, plan to walk the last stretch, and book ahead.'


def landmark_tips(lm, name, near, radius):
    schema = lm.get('schema') or 'TouristAttraction'
    tip = HILL_SIGHT_TIP if CITY in ('dehradun', 'mussoorie') and schema == 'TouristAttraction' else LANDMARK_TIPS.get(schema)
    tips = [t for t in (LANDMARK_NOTES.get(lm['slug']), tip) if t]
    priced = sorted(s['p'] for _, s in near if s.get('p'))
    linked = sum('o' in s for _, s in near)
    kinds = {}
    for _, s in near:
        kinds[s['k']] = kinds.get(s['k'], 0) + 1
    top_kinds = ', '.join(f'{k.lower()} ({n})' for k, n in sorted(kinds.items(), key=lambda kv: -kv[1])[:3])
    tips.append(f'Within {radius:g} km of {name} we list {len(near):,} stays, mostly {top_kinds}. '
                + (f'Listed starting prices run from about ₹{round_price(priced[0])} to ₹{round_price(priced[-1])} a night. ' if len(priced) > 1 else '')
                + (f'{linked:,} of them have a booking page we have checked, so you can book online straight away.' if linked else
                   'Send us your dates and we will help you book.'))
    return tips


def build_landmark_pages(stays, own, landmarks, top, bottom, today):
    """One page per landmark in this city: stays by distance in bands,
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
        # 2 km, widened to 3 km (then 5 km, for places out of town such as the airport; up to 30 km for a place like IIT Roorkee
        # whose max_km allows it) where fewer than 10 stays are that close
        # (never past the place's max_km in landmarks.tsv: Neelkanth is 5 km from Laxman Jhula as the crow flies, 30 km by road)
        cap = float(lm.get('max_km') or 5.0)
        radius = next((r for r in (LANDMARK_RADIUS_KM, 3.0, 5.0, 10.0, 15.0, 20.0, 30.0) if r <= cap and sum(1 for k, _ in dist if k <= r) >= 10), cap)
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
            items = ''.join(with_dist(own_html(s) if id(s) in own_ids else item_html(s), (dist_label(road_km(k)) if k < 0.05 else f'{dist_label(road_km(k))} away')) for k, s in grp)
            band_html += f'<section class="sx-group"><h2>{esc(label)} <span>{len(grp):,}</span></h2><ul class="sx-list">{items}</ul></section>'
        within1 = sum(1 for k, _ in near if k <= 1)
        prices = sorted(s['p'] for k, s in near if k <= 1 and s.get('p'))
        closest_k, closest = near[0]
        base_line, own_block = '', ''
        if own_d:
            ok, oo = own_d[0]
            if ok <= radius:
                base_line = f'Our own homestays are genuinely close: {oo["n"]} is about {dist_label(road_km(ok))} away, roughly {drive_minutes(ok)} minutes by car or auto.'
            elif CITY == DEFAULT_CITY:
                base_line = (f"Prefer quiet nights over walking distance? Our Ganga-view homestays in {home_city}'s Nirmal Bagh are about {ok:.0f} km away, "
                             f'roughly {drive_minutes(ok)} minutes by car or auto.'
                             + (f' Come in for {name} and go home to the river.' if (lm.get('schema') or 'TouristAttraction') == 'TouristAttraction' else ''))
            elif CITY == 'haridwar':
                base_line = (f'Coming for {name} but want calm nights? Base yourself at our homestays in {home_city}, about {ok:.0f} km upriver '
                             f'(roughly {drive_minutes(ok)} minutes by car), and skip the crowds after dark.')
            else:
                # the hill-side cities: no drive time is promised, but the road-corrected km (road_km) is still a
                # closer estimate than a straight line would be
                base_line = (f'Our own homestays are in {home_city}, {home_away()} from {CN}, about {road_km(ok):.0f} km from {name} by road. '
                             'They suit a longer trip that also takes in the river, not a quick stop here.')
            own_rows = ''.join(with_dist(own_html(o), f'{dist_label(road_km(k))} from {esc(name)}' + (f' · ~{drive_minutes(k)} min drive' if CITY in ('rishikesh', 'haridwar') else '')) for k, o in own_d)
            own_block = ('<section class="sx-own" aria-labelledby="sx-own-h"><h2 id="sx-own-h">A calmer base <span>Book direct with us</span></h2>' + OWN_PERKS +
                         f'<p class="sx-base">{esc(base_line)}</p><ul class="sx-list">{own_rows}</ul></section>')
        # Quick facts: counts, closest, prices, bookable, the town centre and our homestays, all from this page's data
        qf = [f'{within1:,} stays are within 1 km of {name} and {len(near):,} within {radius:g} km, as the crow flies.',
              f'The closest stay to {name} is {closest["n"]}, ' + ('right next to it.' if closest_k < 0.05 else f'about {dist_label(road_km(closest_k))} away.')]
        qf.append(price_fact(prices, f'stays within 1 km of {name}', '') if len(prices) > 1 else
                  price_fact([s['p'] for _, s in near if s.get('p')], f'stays within {radius:g} km of {name}', ''))
        linked_n = sum('o' in s for _, s in near)
        if linked_n:
            qf.append(f'{linked_n:,} of the {len(near):,} stays near {name} can be booked online right away.')
        c_slug = CITIES[CITY].get('center_landmark')
        c_lm = next((l for l in landmarks if l['slug'] == c_slug), None)
        if c_lm and c_slug != slug:
            ck = km_between(here, (float(c_lm['lat']), float(c_lm['lng'])))
            qf.append(f'{name} is about {dist_label(road_km(ck))} from {c_lm["name"]} by road.')
        qf.append(own_fact(own, name, here))
        qf = [x for x in qf if x]
        url = f'{SITE}/hotels/best-stays-near-{slug}'
        h1 = f'Best Stays near {name}'
        title = f'Stays near {name}, {CN} | {within1:,} within 1 km, by Distance'
        closest_txt = (', one right next to it' if closest_k < 0.05 else f', the closest {dist_label(road_km(closest_k))} away') if closest_k < 1 else ''
        desc = f'{len(near):,} stays within {radius:g} km of {name} in {CN}, sorted by distance: {within1:,} within 1 km{closest_txt}. Map, prices and tips.'
        faq = [(f'How many stays are near {name}?',
                f'We count {within1:,} stays within 1 km of {name} and {len(near):,} within {radius:g} km. The closest, {closest["n"]}, is {"right next to it" if closest_k < 0.05 else f"about {dist_label(road_km(closest_k))} away"}.')]
        if prices:
            faq.append((f'What does a stay near {name} cost?',
                        f'Listed starting prices within 1 km run from about ₹{round_price(prices[0])} to ₹{round_price(prices[-1])} a night, with a typical stay around ₹{round_price(statistics.median(prices))}. Expect more on weekends and festival days.'))
        faq.append((f'Is it better to stay right next to {name}?',
                    ('Only if you want to walk there early and late: walking distance is handy for early mornings and evening walks, but the busiest lanes are noisy and hard to drive into on busy weekends. '
                     if CITY in ('dehradun', 'mussoorie') else
                     'Only if you want to walk there early and late: walking distance is handy for early mornings and evening aartis, but the busiest lanes are noisy and hard to drive into on festival days. ')
                    + (base_line or 'A stay 1–2 km away is often quieter and easier to reach by car.')))
        if slug == 'har-ki-pauri':
            faq.insert(1, KUMBH_FAQ)
        guide = f'<a href="{lm["guide"]}">Read our {esc(name)} guide</a> · ' if lm.get('guide') else ''
        mapdata = {'center': here, 'name': name, 'cq': city_qs(),
                   'stays': [[s['ll'][0], s['ll'][1], s['n'], s['id'], dist_label(road_km(k))] for k, s in near[:120]],
                   'own': [[o['ll'][0], o['ll'][1], o['n'], o['u']] for o in own if o.get('ll')]}
        ld = [
            {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': h1, 'url': url, 'description': desc, 'dateModified': LASTMOD_TOKEN,
             'about': {'@type': lm.get('schema') or 'TouristAttraction', 'name': name, 'geo': {'@type': 'GeoCoordinates', 'latitude': here[0], 'longitude': here[1]},
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
        lede_closest = ('; one is right next to it' if closest_k < 0.05 else f'; the closest is {dist_label(road_km(closest_k))} away') if closest_k < 1 else ''
        mapjson = json.dumps(mapdata, ensure_ascii=False).replace('</', '<\\/')
        note = esc(CITY_COPY.get(CITY, {}).get('note', NOTE_RISHIKESH))
        main_html = (
            f'<main class="sx-page" id="main" data-city="{CITY}" data-landmark="{slug}">\n'
            '      <section class="section">\n        <div class="container">\n'
            '          <div class="sx-topbar">\n'
            f'          <nav class="sx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> <a href="/hotels/best-hotels-in-{CITY}">Best Hotels in {CN}</a> <span aria-hidden="true">›</span> <span>{esc(h1)}</span></nav>\n'
            '          <nav class="sx-city-switch" aria-label="Switch city">' + ''.join(
                (f'<a href="/hotels/best-stays-near-{slug}" aria-current="page">{esc(v["name"])}</a>' if k == CITY else
                 f'<a href="/hotels/best-hotels-in-{k}">{esc(v["name"])}</a>') for k, v in CITIES.items()) + '</nav>\n'
            '          </div>\n'
            f'          <p class="eyebrow">Where to stay · {esc(CN)}</p>\n'
            f'          <h1 class="sx-title">{esc(h1)}</h1>\n'
            f'          <p class="sx-lede">Every stay within {radius:g} km of {esc(name)}, sorted by distance. {within1:,} are within 1 km{lede_closest}.</p>\n'
            f'          <p class="sx-cities">{guide}<a href="/hotels/best-hotels-in-{CITY}">All stays in {CN}</a></p>\n'
            f'          {facts_html(qf, f"Stays near {name}")}\n'
            f'          {own_block}\n'
            '          <section class="sp-map" aria-labelledby="lm-map-h">\n            <h2 id="lm-map-h">On the map</h2>\n'
            f'            <div class="sp-map-slot" id="lm-map"><a href="https://www.google.com/maps?q={here[0]},{here[1]}" target="_blank" rel="noopener">Open {esc(name)} in Google Maps</a></div>\n'
            f'            <ul class="sp-map-key" aria-hidden="true"><li><i class="k-this"></i>{esc(name)}</li><li><i class="k-own"></i>Our homestays</li><li><i class="k-near"></i>Stays nearby</li></ul>\n'
            '          </section>\n'
            f'          <script type="application/json" id="lm-data">{mapjson}</script>\n'
            f'          <div id="sx-out">{band_html}</div>\n'
            '          <div class="rh-ad-slot" data-ad="display"></div>\n'
            '          <section class="sx-guide sx-tips" aria-labelledby="lm-tips-h">\n'
            f'            <h2 id="lm-tips-h">Staying near {esc(name)}: good to know</h2>\n'
            + ''.join(f'            <p>{esc(t)}</p>\n' for t in landmark_tips(lm, name, near, radius))
            + (f'            {NTES_LINK}\n' if slug in STATION_SLUGS or lm.get('schema') == 'TrainStation' else '')
            + '          </section>\n'
            '          <section class="sx-faq" aria-labelledby="sx-faq-h">\n'
            f'            <h2 id="sx-faq-h">Staying near {esc(name)}: questions travellers ask</h2>\n            {faq_html}\n          </section>\n'
            '          <section class="sx-explore" aria-labelledby="sx-explore-h">\n'
            f'            <h2 id="sx-explore-h">Stay near other places in {CN}</h2>\n            <p>{others_near}</p>\n'
            f'            <p>Or browse <a href="/hotels/best-hotels-in-{CITY}">all stays in {CN}</a>, or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>\n'
            '          </section>\n'
            f'          <p class="sx-note">Distances are straight-line from {esc(name)}; walking and driving routes are longer, and drive times are rough. {note}</p>\n'
            '        </div>\n      </section>\n    </main>')
        page_bottom = bottom.replace('/assets/js/modules/stays-index.js', '/assets/js/modules/landmark-map.js')
        write_dated(f'best-stays-near-{slug}', page_top, main_html, page_bottom)
        made.append({'slug': slug, 'name': name, 'near': len(near), 'radius': radius, 'h1': h1, 'url': url, 'desc': desc,
                     'tips': landmark_tips(lm, name, near, radius), 'faq': faq, 'facts': qf,
                     'picks': [pick_line(s, CITY, f'{dist_label(road_km(k))} away') for k, s in near[:10]]})
    print('landmark pages:', ', '.join(f"{m['slug']} ({m['near']})" for m in made) or 'none')
    return made


def jsonld(obj):
    return '<script type="application/ld+json">\n' + json.dumps(obj, ensure_ascii=False, indent=2).replace('</', '<\\/') + '\n</script>'


# ---------- llms-full.txt: the detailed companion to llms.txt for AI assistants ----------
# llms.txt is the short index; llms-full.txt gives every stays page's summary, prices, areas,
# top picks (each with a link to its page here), tips, FAQs and a one-tap WhatsApp link, so an
# assistant can answer and send the traveller straight to an action. Each city's build rewrites
# its own section between <!-- full-<city> --> markers; the rest comes from llms.txt.
WA_NUMBER = '918050091290'


def wa_link(text):
    from urllib.parse import quote
    return f'https://wa.me/{WA_NUMBER}?text={quote(text)}'


def pick_line(d, city, extra=''):
    qs = '' if city == DEFAULT_CITY else f'&c={city}'
    bits = [d['a'], d['k']] + ([f'{d["s"]}-star'] if d.get('s') else []) \
        + ([f'guests {d["g"]:g}/10' + (f' ({d["c"]} review{"s" if d["c"] != 1 else ""})' if d.get('c') else '')] if d.get('g') else []) \
        + ([f'from ₹{inr(d["p"])} a night'] if d.get('p') else []) + (['book online'] if 'o' in d else []) + ([extra] if extra else [])
    return f'{d["n"]}: {" · ".join(bits)} · {SITE}/hotels/stay?s={d["id"]}{qs}'


def best_first(items, n=10):
    """llms-full.txt picks: bookable stays with 5+ reviews by guest score, then the page's own order."""
    top = sorted([d for d in items if 'o' in d and d.get('g') and (d.get('c') or 0) >= 5], key=lambda d: (-d['g'], -(d.get('c') or 0), d['n']))
    return (top + [d for d in items if d not in top])[:n]


def full_entry(h1, url, summary, st, facts, tips, faq, picks, ranked, alts):
    out = [f'### {h1}', f'Page: {url}', summary]
    if st and st.get('median'):
        out.append(f'Typical listed starting price: about ₹{round_price(st["median"])} a night; the middle half start between ₹{round_price(st["p25"])} and ₹{round_price(st["p75"])}.')
    if st and st.get('top_areas'):
        out.append('Main areas: ' + ', '.join(f'{a} ({c})' for a, c in st['top_areas']) + '.')
    out += facts
    if picks:
        out.append('Ranked by guest score:' if ranked else 'Picks, best guest score first (the ones you can book online lead):')
        out += [f'{i}. {line}' for i, line in enumerate(picks, 1)]
    for h2, note, lst, c, _href, _r in alts:
        out.append(f'{h2}{f" ({note})" if note else ""}:')
        out += [f'- {pick_line(d, c)}' for d in lst[:5]]
    out += [t for t in tips if not t.startswith('Prefer to book direct?')]
    # FAQs the facts above already answer (count, cheapest, closest, best-reviewed) are left out here
    out += [f'Q: {q} A: {a}' for q, a in faq
            if not re.match(r'How do I book|How many .* are there|What is the cheapest|Which .* closest to|Which .* best guest reviews', q)]
    out.append(f'Ask us about this: {wa_link(f"Hi, I am looking at {h1} on rishikeshhomestays.com. My dates: ")}')
    return '\n'.join(out) + '\n\n'


def write_llms_full(section, own):
    path = f'{ROOT}/llms-full.txt'
    old = open(path, encoding='utf8').read() if os.path.exists(path) else ''
    secs = {}
    for k in CITIES:
        m = re.search(rf'<!-- full-{k}:start -->\n(.*?)<!-- full-{k}:end -->', old, re.S)
        secs[k] = m.group(1) if m else ''
    secs[CITY] = section
    llms = open(f'{ROOT}/llms.txt', encoding='utf8').read()
    head = re.sub(r'Full details for AI assistants.*?\n\n', '', llms[:llms.index('## Key pages')], flags=re.S)
    key_pages = llms[llms.index('## Key pages'):llms.index('## Where to stay')]   # key pages + the Kumbh section
    tail = llms[llms.index('## Contact'):]
    own_lines = '\n'.join(f'- {o["n"]}: {re.sub(r"^.* · ", "", o["a"])}, {CITIES[DEFAULT_CITY]["name"]}' + (f' · guests {o["g"]:g}/10' if o.get('g') else '') + f' · {SITE}{o["u"]}' for o in own)
    body = (head.replace('# Rishikesh Homestays', '# Rishikesh Homestays (full details)', 1)
            + '## How a traveller can act\n\n'
            + f'- Book our own homestays direct (best price, no booking-site commission): WhatsApp {wa_link("Hi, I would like to book a homestay in Rishikesh. My dates: ")} or the form at {SITE}/contact.\n'
            + '- Any listed stay: open its page (links below) and press View property; we send you on to book it, or WhatsApp us your dates and we will suggest the best fit.\n'
            + f'- Bike, scooty and taxi hire: {SITE}/bike-and-taxi-rental-in-rishikesh\n'
            + f'- Short index of all pages: {SITE}/llms.txt\n\n'
            + f'## Our own homestays (book direct)\n\n{own_lines}\n\n'
            + key_pages
            + '## Every stays page in detail\n\n'
            + 'Listed starting prices change with dates and seasons; quote them as "from", and send travellers to the page or WhatsApp for the current rate.\n\n'
            + ''.join(f'## Stays in {CITIES[k]["name"]}\n\n<!-- full-{k}:start -->\n{secs[k]}<!-- full-{k}:end -->\n\n' for k in CITIES)
            + tail)
    open(path, 'w', encoding='utf8', newline='\n').write(body)


def ensure_markers(path, before, indent, heading=''):
    """Add this city's start/end markers ahead of `before` the first time."""
    s = open(path, encoding='utf8').read()
    if f'<!-- {marker()}:start -->' in s:
        return
    block = f'{heading}{indent}<!-- {marker()}:start -->\n{indent}<!-- {marker()}:end -->\n'
    s = s.replace(before, block + before, 1)
    open(path, 'w', encoding='utf8', newline='\n').write(s)


def replace_between(path, start, end, body):
    s = open(path, encoding='utf8').read()
    if start in s and end in s:
        s = s[:s.index(start) + len(start)] + body + s[s.index(end):]
    else:
        raise SystemExit(f'markers {start!r} missing in {path}')
    open(path, 'w', encoding='utf8', newline='\n').write(s)


def main(data_path, crawled):
    DATES.update(page_dates.load())
    today = datetime.date.today()
    date = f"{today.day} {today.strftime('%B %Y')}"  # not %-d: Windows' C runtime rejects it
    stays = json.load(open(data_path, encoding='utf8'))
    own = []
    # Our stays are in Rishikesh; other cities borrow them from Rishikesh's data
    # (labelled with the town) so every city's pages still pin and mix them in.
    home = stays if CITY == DEFAULT_CITY else json.load(open(os.path.join(cache_dir(DEFAULT_CITY), 'stays.json'), encoding='utf8'))
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
    stays = order_stays(stays)
    everyone = stays + own

    # Every page exists in every city (owner, 2026-10-05), so the Rishikesh / Haridwar switch always
    # lands on the same page: a category or phrase gets a page in each city once ANY city has
    # MIN_PAGE stays for it. Both cities' builds decide this from the same data, so they agree.
    pools = {k: (stays if k == CITY else prepared_stays(k, ota)) for k in CITIES}
    counts_in = {k: {c[0]: sum(matches(s, c[3]) for s in pools[k] + own) for c in CATEGORIES} for k in CITIES}
    counts = counts_in[CITY]
    live = [c for c in CATEGORIES if any(counts_in[k][c[0]] >= MIN_PAGE for k in CITIES)]
    sections = ([{'title': 'Hotels', 'filter': 'k:Hotels', 'slug': None}] +
                [{'title': c[1], 'filter': c[3], 'slug': c[0], **({'plural': PLURAL[c[0]]} if c[0] in PLURAL else {})} for c in live if c[3] != 'all'] +
                [{'title': 'Other stays', 'filter': 'k:Other stays', 'slug': None}])
    # Pages for the phrases people search (search-pages.tsv, search_pages.py): one per phrase, made
    # in every city the phrase is for once any of them has MIN_PAGE stays for it (a top 10 needs 10).
    lm_all = {r['slug']: (float(r['lat']), float(r['lng'])) for c in CITIES for r in load_landmarks(c)}
    lm_names = {r['slug']: r['name'] for c in CITIES for r in load_landmarks(c)}
    search_rows = {p: (rule, cities) for p, rule, _g, _i, cities in SEARCH_PAGES}

    def n_search(k, rule):
        rule = rule.replace('{city}', k)
        return len(select([x for x in pools[k] if rule_matches(x, rule, k, lm_all)], rule))

    def phrase_live(phrase):
        rule, cities = search_rows[phrase]
        return any(n_search(k, rule) >= (10 if 'top10' in rule else MIN_PAGE) for k in cities)
    searches = []
    for phrase, rule_t, group, s_intro, cities in SEARCH_PAGES:
        if CITY in cities and phrase_live(phrase):
            rule = rule_t.replace('{city}', CITY)
            searches.append({'h1': heading(phrase, CN), 'stem': phrase_path(phrase, CN), 'phrase': phrase, 'rule': rule,
                             'rule_t': rule_t, 'group': group, 'intro': s_intro.replace('{City}', CN), 'count': n_search(CITY, rule)})
    module_path = f'{ROOT}/assets/js/modules/{data_module_name()}'
    old_meta = re.search(r'export const STAYS_INDEX_META = (\{.*?\});\n', open(module_path, encoding='utf8').read()) if os.path.exists(module_path) else None
    old_stems = {x['stem'] for x in json.loads(old_meta.group(1)).get('searches', [])} if old_meta else set()
    meta = {
            'categories': [{'slug': c[0], 'title': c[1], 'filter': c[3], 'count': counts[c[0]], 'group': cat_group(c[3])} for c in live],
            'groups': [[key, label] for key, label in CAT_GROUPS],
            'sections': sections,
            'searches': [{'h1': x['h1'], 'stem': x['stem'], 'count': x['count']} for x in searches],
            # for the search-page rules in stays-index.js
            'landmarks': {k: list(v) for k, v in lm_all.items()},
            'river': RIVER_AREAS.get(CITY, []),
            'kinds': {k: sorted(v) for k, v in SEARCH_KINDS.items()}}
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    with open(module_path, 'w', encoding='utf8', newline='\n') as fh:
        fh.write('// Generated by scripts/stays/build_pages.py. Do not hand-edit.\n')
        fh.write(f'export const STAYS_INDEX_META = {dump(meta)};\n')
        fh.write(f'export const STAYS_OWN = {dump(own)};\n')
        # Public file: drop the source-listing URL (not used by the pages).
        fh.write(f'export const STAYS_INDEX = {dump([{k: v for k, v in s.items() if k != "u"} for s in stays])};\n')

    shell = open(f'{ROOT}/thanks.html', encoding='utf8').read()
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
    for stem in old_stems - {x['stem'] for x in searches}:
        if os.path.exists(f'{STAYS_DIR}/{stem}.html'):
            os.remove(f'{STAYS_DIR}/{stem}.html')

    star_counts = {}
    others = [(k, v['name']) for k, v in CITIES.items() if k != CITY and os.path.exists(f'{STAYS_DIR}/best-hotels-in-{k}.html')]
    landmarks = load_landmarks(CITY)
    near_nav = ('<p class="sx-cities">Stay near ' + ', '.join(
        f'<a href="/hotels/best-stays-near-{l["slug"]}">{esc(l["name"])}</a>' for l in landmarks) + '</p>') if landmarks else ''
    thin_notes = {}   # stem -> the honest summary of a page this city has few stays for (llms.txt)
    full = []         # llms-full.txt entries, one per page

    def render(slug, title, singular, flt, intro, guide, search=None):
        # One stays page: a category (best-<slug>-in-<city>) or, with `search`, a search-phrase page
        # whose address and <h1> are the phrase itself (search_pages.py).
        if search:
            match = lambda x: rule_matches(x, search['rule'], CITY, lm_all)
        else:
            intro, guide = city_copy(slug, title, intro, guide)
            match = lambda x: matches(x, flt)
        group = search['group'] if search else ''
        is_master = (flt == 'all' and not search) or group == 'c'
        stem = search['stem'] if search else f'best-{slug}-in-{CITY}'
        url = f'{SITE}/hotels/{stem}'
        members = [s for s in stays if match(s)]
        top10 = bool(search) and 'top10' in search['rule']
        if top10:
            members = select(members, search['rule'])
        st = stats_for(members + ([] if top10 else [o for o in own if match(o)]))
        n = st['n']
        if search:
            # running-text plural: the phrase without the city, lower case except names ("rooms near AIIMS")
            bare = re.sub(r'\s+', ' ', re.sub(rf'\b(in|at)\s+{CN}\b|\b{CN},?\b', ' ', title)).strip()
            head, sep, place = bare.partition(' near ')
            plural = (' '.join(w if w in KEEP_CASE else w.lower() for w in head.split()) + sep + place) or 'stays'
            h1 = title
            page_title = f'{h1} | Ranked by Guest Score' if 'top10' in search['rule'] else f'{h1} | {n:,} to Compare by Area & Price'
        else:
            plural = 'stays' if is_master else plural_of(slug, title)
            h1 = (H1_PHRASE[slug].replace('{City}', CN) if slug in H1_PHRASE else
                  f'Best Hotels in {CN}' if is_master else f'Best {title} in {CN}{TITLE_SUFFIX.get(slug, "")}')
            page_title = (f'Best Hotels in {CN} | All {n:,} Stays by Area & Category' if is_master
                          else f'Best {title} in {CN}{TITLE_SUFFIX.get(slug, "")} | {n:,} Compared by Area & Price')
        kinds_txt = CITY_COPY.get(CITY, {}).get('kinds', 'hotels, homestays, resorts, camps and hostels')
        desc = (clip_desc(intro if 'top10' in search['rule'] else f'{n:,} to compare. {intro}') if search else
                (f'{n:,} {CN} stays compared: {kinds_txt} by area, price and facilities, '
                 f'with local tips on where to stay.') if is_master else (
                f'Compare {n:,} {plural} in {CN} by area, price and facilities. {intro}')[:300])
        faq = faqs(title, 'stay' if is_master else singular, plural, st, date)

        # The same page in the other city (the city switch, and the "nearest in ..." list here).
        def other_city(k):
            if search:
                p = search['phrase']   # the other city's row: this one ({City}), or a one-city phrase's twin
                row = TWINS.get(p, p if '{City}' in p else None)
                if row in search_rows and k in search_rows[row][1] and phrase_live(row):
                    return phrase_path(row, CITIES[k]['name'])
                return f'best-hotels-in-{k}'
            return f'best-{slug}-in-{k}'
        # A city with too few stays for this page still has it (so the switch always works): it lists
        # what there is, then the same page's stays in the other city and similar stays in this one.
        n_here = len(members)
        thin = not is_master and n_here < (10 if top10 else MIN_PAGE)
        alts = []   # [(h2, note, stays, city, href or None, ranked)]
        if thin:
            def stays_there(k):
                if search:
                    o_rule = search['rule_t'].replace('{city}', k)
                    found = [x for x in pools[k] if rule_matches(x, o_rule, k, lm_all)]
                    return select(found, o_rule) if top10 else found
                return [x for x in pools[k] if matches(x, flt)]
            # the nearest city that has stays for this page (else the nearest city: the page still points there)
            other = next((k for k in NEAREST[CITY] if len(stays_there(k)) >= (MIN_PAGE if not top10 else 1)), None) or next(
                (k for k in NEAREST[CITY] if stays_there(k)), NEAREST[CITY][0])
            ON = CITIES[other]['name']
            there = stays_there(other)
            twin_stem = other_city(other)
            twin_h1 = (twin_of(search['phrase'], ON) if search else f'Best {title} in {ON}')
            if there:
                alts.append((twin_h1, away(CITY, other), there[:SHOW_MIN], other, f'/hotels/{twin_stem}', top10))
            # similar stays in this city: the search minus its first condition (usually the kind), or
            # the closest category; failing both, this city's best-reviewed stays
            sim_h2, sim = None, []
            if search:
                rest = [c for c in search['rule'].split(' & ')[1:]]
                if rest and rest != ['top10']:
                    r2 = ' & '.join(rest)
                    sim = [x for x in stays if rule_matches(x, r2, CITY, lm_all) and x not in members]
                    sim = select(sim, r2) if 'top10' in rest else sim
                    same = next((x for x in searches if x['rule'] == r2), None)
                    sim_h2, sim_href = (same['h1'], f'/hotels/{same["stem"]}') if same else (f'Similar stays in {CN}', None)
            else:
                fb = next((c for c in live if c[0] == CATEGORY_FALLBACK.get(slug)), None)
                if fb and counts[fb[0]] >= MIN_PAGE:
                    sim = [x for x in stays if matches(x, fb[3]) and x not in members]
                    sim_h2, sim_href = f'Best {fb[1]} in {CN}', f'/hotels/best-{fb[0]}-in-{CITY}'
            if len(sim) < 3:
                sim = sorted([x for x in stays if x.get('g') and (x.get('c') or 0) >= 10 and x not in members],
                             key=lambda x: (-x['g'], -(x.get('c') or 0), x['n']))
                sim_h2, sim_href = f'Best-reviewed stays in {CN}', f'/hotels/best-hotels-in-{CITY}'
            if sim:
                alts.insert(1 if n_here == 0 and alts else 0,
                            (sim_h2, '', sim[:SHOW_MIN], CITY, sim_href, False))
            there_txt = f' The nearest are in {ON}, {away(CITY, other)}.' if there else ''
            what = re.sub(r'^top 10 ', '', plural)   # "No villas in Haridwar have enough reviews", not "No top 10 villas"
            if top10:
                thin_note = (f'Only {n_here} {what} in {CN} {"has" if n_here == 1 else "have"} the {TOP_MIN_REVIEWS}+ guest reviews we need to rank them, so this list is shorter than ten.'
                             if n_here else f'No {what} in {CN} have enough guest reviews to rank yet.') + there_txt
            else:
                nm = [x['n'] for x in members]
                names = (', '.join(nm[:-1]) + ' and ' + nm[-1]) if len(nm) > 1 else ''.join(nm)
                thin_note = (f'Only {n_here} {"stay" if n_here == 1 else "stays"} in {CN} {"fits" if n_here == 1 else "fit"} this: {names}.' if n_here
                             else f'We have not found {what} listed in {CN} yet.') + there_txt
            thin_note += ((' Below them: ' if n_here else ' Below: ') + ' and '.join(h for h, *_ in alts) + '.') if alts else ''
            thin_notes[stem] = thin_note
            if not n_here:
                intro = thin_note   # the city's usual intro would promise stays it does not have
            page_title = f'{h1} | {"Nearest Options" if not n_here else f"{n_here} Here + Nearby Picks"} & Local Tips'
            desc = clip_desc(thin_note if not n_here else f'{thin_note} {intro}')
            faq = [(f'Are there {plural} in {CN}?', thin_note)] + [qa for qa in faq if qa[0].startswith('How do I book') or qa is KUMBH_FAQ]

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
                lst = [s for s in members if matches(s, sec['filter'])]
                if not lst:
                    continue
                more = (f'<a class="sx-open" href="/hotels/best-{sec["slug"]}-in-{CITY}">View all {len(lst):,} {esc(plural_of(sec["slug"], sec["title"]))}</a>' if sec['slug']
                        else (f'<button type="button" class="sx-more" data-k="c:{esc(sec["title"])}">Show all {len(lst):,}</button>' if len(lst) > MASTER_SECTION else ''))
                blocks.append(f'<section class="sx-group"><h2>{esc(sec["title"])} <span>{len(lst):,}</span></h2>'
                              f'<ul class="sx-list">{mix_html(lst[:MASTER_SECTION], own, sec["filter"] in PRIVATE_ALT)}</ul>'
                              f'{f"<div class=\"sx-actions\">{more}</div>" if more else ""}</section>')
            listing = ''.join(blocks)
            list_items = [d for d in stays][:30]
        elif top10:
            # the ranking as is: no "View all" fold, no other stays mixed in, rank before each name
            ranked = [{**d, 'n': f'{i}. {d["n"]}'} for i, d in enumerate(members, 1)]
            listing = (f'<section class="sx-group"><h2>{esc(h1)} <span>ranked by guest score</span></h2>'
                       f'<ol class="sx-list">{"".join(item_html(d) for d in ranked)}</ol></section>')
            list_items = members
        elif group in ('a', 's', 'k', 'pb', 'd'):
            # sections by area / star rating / type / price band, each with its own "View all" fold
            # by type: the page's own kinds first (a resort that is also listed as a hotel goes under Resorts)
            kind_set = next((SEARCH_KINDS[t] for t in (search['rule'].split(' & ') if search else []) if t in SEARCH_KINDS), set())
            near_c = next((c for c in (search['rule'].split(' & ') if search else []) if c.startswith('near:')), None)
            here_ll = lm_all.get(near_c.split(':')[1]) if near_c else None
            near_r = float(near_c.split(':')[2]) if near_c else None
            bands = dist_bands(near_r)
            key = {'d': lambda d: dist_band(km_between(here_ll, d['ll']), near_r) if here_ll and d.get('ll') else bands[-1][1],
                   'a': lambda d: d['a'], 's': lambda d: d.get('s') or 0, 'k': lambda d: next((k for k in d['ks'] if k in kind_set), d['k']), 'pb': lambda d: price_band(d['p']) if d.get('p') else 'No price listed'}[group]
            parts = {}
            for d in members:
                parts.setdefault(key(d), []).append(d)
            if group == 's':
                order = sorted(parts, reverse=True)
            elif group == 'pb':
                order = [label for _, label in PRICE_BANDS if label in parts] + (['No price listed'] if 'No price listed' in parts else [])
            elif group == 'd':
                order = [label for _, label in bands if label in parts]
            else:
                order = sorted(parts, key=lambda k: (-len(parts[k]), str(k)))
            blocks = []
            for k in order:
                lst = parts[k]
                name = (f'{k}-star' if k else 'Unrated') if group == 's' else str(k)
                shown, rest = split_shown(lst)
                more = (f'<details class="sx-rest"><summary>View all {len(lst):,} · {esc(name)}</summary>'
                        f'<ul class="sx-list">{mix_html(rest, own)}</ul></details>') if rest else ''
                blocks.append(f'<section class="sx-group"><h2>{esc(name)} <span>{len(lst):,}</span></h2>'
                              f'<ul class="sx-list">{mix_html(shown, own)}</ul>{more}</section>')
            listing = ''.join(blocks)
            list_items = members[:30]
        else:
            shown, rest = split_shown(members)
            more = (f'<details class="sx-rest"><summary>View all {len(members):,} {esc(plural)}</summary>'
                    f'<ul class="sx-list">{mix_html(rest, own, flt in PRIVATE_ALT)}</ul></details>') if rest else ''
            list_h2 = esc(h1) if search else f'All {esc(lc(title))}'
            listing = (f'<section class="sx-group"><h2>{list_h2} <span>{len(members):,}</span></h2>'
                       f'<ul class="sx-list">{mix_html(shown, own, flt in PRIVATE_ALT)}</ul>{more}</section>')
            list_items = members[:30]

        if search or not is_master:
            basis = members or (alts[0][2] if alts else [])
            tips, facts, more_faq = page_content(search['rule'] if search else '', CITY, basis, lm_all, lm_names, AREA_NOTES,
                                                 'stay' if is_master else singular, plural)
            faq = faq[:-1] + more_faq + faq[-1:] if faq else more_faq   # keep "How do I book" last
        else:
            tips, facts = [], []
        # Quick facts, from this page's own stays (thin pages: the nearest in the other city instead)
        what_q = re.sub(r'^top 10 ', '', plural)
        near_q = next((c for c in (search['rule'].split(' & ') if search else []) if c.startswith('near:')), None)
        q_slug = near_q.split(':')[1] if near_q else CITIES[CITY].get('center_landmark', '')
        q_ll, q_name = lm_all.get(q_slug), lm_names.get(q_slug, '')
        qf = []
        if top10 and members:
            d0 = members[0]
            qf.append(f'This list ranks {len(members)} {what_q} in {CN} by guest score, counting only those with {TOP_MIN_REVIEWS}+ guest reviews.')
            qf.append(f'{d0["n"]} in {d0["a"]} tops the {what_q} in {CN} at {d0["g"]:g}/10 from {d0["c"]:,} reviews.')
        elif n_here:
            qf.append(f'We list {n_here:,} {what_q} in {CN}' + (f', across {len(st["areas"])} areas.' if len(st['areas']) > 1 else '.'))
        if n_here:
            qf.append(price_fact([d.get('p') for d in members], what_q, f'in {CN}'))
            if st['rated'] and not top10:
                qf.append(f'{st["well_rated"]:,} of the {st["rated"]:,} {what_q} in {CN} with five or more guest reviews score 9/10 or higher.')
            linked_q = sum('o' in d for d in members)
            if linked_q:
                qf.append(f'{linked_q:,} of the {n_here:,} {what_q} in {CN} on this page can be booked online right away.')
            if near_q and q_ll:
                dk = sorted(((km_between(q_ll, d['ll']), d) for d in members if d.get('ll')), key=lambda t: t[0])
                if dk:
                    w1 = sum(1 for k, _ in dk if k <= 1)
                    qf.append(f'{w1:,} of these {n_here:,} stays are within 1 km of {q_name}; the closest, {dk[0][1]["n"]}, is '
                              + ('right next to it.' if dk[0][0] < 0.05 else f'about {dist_label(road_km(dk[0][0]))} away by road.'))
        if thin:
            other_q = next((c for _h, _n, lst, c, *_ in alts if c != CITY and lst), None)
            if other_q:
                qf.append(f'The nearest {what_q} are in {CITIES[other_q]["name"]}, {away(CITY, other_q)} from {CN}.')
        qf.append(own_fact(own, q_name if near_q else q_name or CN, q_ll if (near_q or CITY == DEFAULT_CITY) else None))
        qf = [x for x in qf if x]
        ld_breadcrumb = {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': f'{SITE}/'},
            {'@type': 'ListItem', 'position': 2, 'name': h1, 'item': url}]}
        own_here = [o for o in own if match(o)] or own
        ld_list = {'@context': 'https://schema.org', '@type': 'ItemList', 'name': h1, 'numberOfItems': n,
                   'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'item': {
                       '@type': 'LodgingBusiness', 'name': d['n'],
                       **({'url': SITE + d['u']} if d['u'].startswith('/') else {}),
                       'address': {'@type': 'PostalAddress', 'addressLocality': f'{d["a"]}, {CITIES[d.get("cy", CITY)]["name"]}', 'addressRegion': 'Uttarakhand', 'addressCountry': 'IN'}}}
                       for i, d in enumerate(own_here + list_items + [x for _h, _n, lst, *_ in alts for x in lst])]}
        ld_faq = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}
        ld_page = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': h1, 'url': url, 'description': desc,
                   'dateModified': LASTMOD_TOKEN, 'inLanguage': 'en',
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

        tips_html = (f'''<section class="sx-guide sx-tips" aria-labelledby="sx-tips-h">
            <h2 id="sx-tips-h">{esc(h1)}: tips before you book</h2>
            {"".join(f"<p>{esc(t)}</p>" for t in tips)}
            {f'<ul class="sx-insights">{"".join(f"<li>{esc(x)}</li>" for x in facts)}</ul>' if facts else ""}
            {NTES_LINK if near_q and q_slug in STATION_SLUGS else ""}
          </section>''' if tips or facts else '')
        alt_html = ''.join(
            f'<section class="sx-group sx-alt"><h2>{esc(h2)} <span>{esc(note)}</span></h2>'
            + (f'<ol class="sx-list">' if ranked else '<ul class="sx-list">')
            + ''.join(item_html({**d, 'n': f'{i}. {d["n"]}' if ranked else d['n'],
                                  'a': d['a'] if c == CITY else f'{CITIES[c]["name"]} · {d["a"]}'}, c) for i, d in enumerate(lst, 1))
            + ('</ol>' if ranked else '</ul>')
            + (f'<div class="sx-actions"><a class="sx-open" href="{href}">See the full page: {esc(h2)}</a></div>' if href else '')
            + '</section>' for h2, note, lst, c, href, ranked in alts)
        if thin and n_here:
            alt_html = f'<p class="sx-thin">{esc(thin_note)}</p>' + alt_html
        insight_html = ''.join(f'<li>{line}</li>' for line in (insights(title, plural, st, boxed=bool(qf)) if n_here or is_master else []))
        faq_html = ''.join(f'<details class="sx-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in faq)
        seg = (('<button type="button" data-g="c">Category</button>' if is_master else '<button type="button" data-g="all">All</button>')
               + '<button type="button" data-g="s">Stars</button><button type="button" data-g="a">Area</button>'
               + ('<button type="button" data-g="k">Type</button>' if not flt.startswith('k:') else '')
               + ('<button type="button" data-g="pb">Price</button>' if group == 'pb' else '')
               + ('<button type="button" data-g="d">Distance</button>' if group == 'd' else ''))
        # City switch at the top: this same page in the other city (other_city() above).
        city_switch = '<nav class="sx-city-switch" aria-label="Switch city">' + ''.join(
            f'<a href="/hotels/{stem}" aria-current="page">{esc(v["name"])}</a>' if k == CITY else
            f'<a href="/hotels/{other_city(k)}">{esc(v["name"])}</a>'
            for k, v in CITIES.items()) + '</nav>'
        kumbh_html = ('''<section class="sx-kumbh" aria-labelledby="sx-kumbh-h">
            <h2 id="sx-kumbh-h">Coming for the Kumbh 2027?</h2>
            <p>Haridwar fills up months ahead of the Kumbh. Stay within walking distance of the ghat you plan to bathe at, expect road closures around the big snan days, and book early. For a calmer base, Rishikesh is about 25 km upriver.</p>
            <p><a href="/haridwar-kumbh-2027">Read our Haridwar Kumbh 2027 guide</a> for reported dates and planning, see <a href="/hotels/best-dharamshalas-in-haridwar">dharamshalas</a> and <a href="/hotels/best-hotels-in-haridwar">all Haridwar stays</a>, or compare <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a>.</p>
          </section>''' if CITY_COPY.get(CITY, {}).get('kumbh') else '')
        explore_more = ('<p>Want a hand choosing? <a href="/homestays">See our handpicked homestays</a>, read <a href="/about-rishikesh">about Rishikesh\'s areas</a>, <a href="/places-to-visit">places to visit</a> and <a href="/things-to-do-in-rishikesh">things to do</a>, plan for the <a href="/haridwar-kumbh-2027">Haridwar Kumbh 2027</a>, or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>'
                        if CITY == DEFAULT_CITY else CITY_COPY[CITY]['explore'] if CITY in ('dehradun', 'mussoorie') else
                        '<p>Planning a pilgrimage? Read our <a href="/haridwar-kumbh-2027">Haridwar Kumbh 2027 guide</a> and the <a href="/triveni-ghat">Ganga Aarti guide</a>, compare <a href="/hotels/best-hotels-in-rishikesh">stays in Rishikesh</a> (25 km upriver), or <a href="/contact">send us your dates</a> and we\'ll suggest a stay.</p>')
        updated = (f'{n:,} {esc(plural)} to compare' if not thin else
                   f'{n_here:,} {esc(plural)} in {esc(CN)}, plus the nearest options' if n_here else
                   f'Nearest {esc(plural)} and similar stays')
        if thin and not n_here:
            listing = ''
        near_term = next((c for c in (search['rule'].split(' & ') if search else []) if c.startswith('near:')), None)
        center = near_term.split(':')[1] if near_term else CITIES[CITY].get('center_landmark', '')
        dist_row = (dist_range_html(lm_names.get(center, center), float(near_term.split(':')[2]) if near_term else None, center)
                    if center in lm_names else '')
        main_html = f'''<main class="sx-page" id="main">
      <section class="section">
        <div class="container" id="sx-root" data-city="{CITY}" data-filter="{esc(flt)}"{f' data-group="{group}"' if group else ''} data-all-title="{esc(h1) if search else f'All {esc(lc(title))}'}">
          <div class="sx-topbar">
            <nav class="sx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span aria-hidden="true">›</span> <span>{esc(h1)}</span></nav>
            {city_switch}
          </div>
          <p class="eyebrow">Where to stay</p>
          <h1 class="sx-title">{esc(h1)}</h1>
          <p class="sx-lede">{esc(intro)}</p>
          <p class="sx-updated">{updated}</p>
          {facts_html(qf, (lambda t: t[:1].upper() + t[1:])(f'{plural} in {CN}' if not is_master else f'stays in {CN}'))}
          <div class="sx-layout">
          <aside class="sx-side">{filters}</aside>
          <div class="sx-main">
          {near_nav}
          <section class="sx-guide" aria-labelledby="sx-guide-h">
            <h2 id="sx-guide-h">{f'{esc(h1)}: what to know' if search else f'Where to stay in {CN}' if is_master else f'Choosing {esc(lc(title))} in {CN}'}</h2>
            <p>{esc(guide)}</p>
            <ul class="sx-insights">{insight_html}</ul>
          </section>
          {kumbh_html}
          <section class="sx-own" aria-labelledby="sx-own-h">
            <h2 id="sx-own-h">Our homestays <span>{'Book direct with us' if CITY == DEFAULT_CITY else 'Book direct · in Rishikesh, ' + home_away()}</span></h2>
            {OWN_PERKS}
            <ul class="sx-list" id="sx-own">{"".join(own_html(o) for o in own)}</ul>
          </section>
          <div class="sx-controls"{' hidden' if thin and not n_here else ''}>
            <div class="sx-row">
              <input type="search" id="sx-q" class="sx-input" placeholder="Search a name, e.g. Zostel, Aloha, Ganga view" aria-label="Search stays">
              <span class="sx-seg" role="group" aria-label="Organise by">{seg}</span>
            </div>
            <div class="sx-row">
              <span class="sx-label">Stars</span><span class="sx-row" id="sx-stars"></span>
              <select id="sx-area" class="sx-input" aria-label="Area"><option value="">All areas</option></select>
              <select id="sx-kind" class="sx-input" aria-label="Type"{' hidden' if flt.startswith('k:') else ''}><option value="">All types</option></select>
            </div>
            {dist_row}
            <div class="sx-row"><span class="sx-label">Facilities</span><span class="sx-row" id="sx-fac"></span><button type="button" class="sx-clear" id="sx-clear">Clear all</button></div>
          </div>
          <div id="sx-out">{listing}</div>
          {alt_html}
          <div class="rh-ad-slot" data-ad="display"></div>
          {tips_html}
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
        write_dated(stem, page_top, main_html, bottom)
        full.append(full_entry(h1, url, thin_note if thin else intro, st if n_here else None, qf + facts, tips, faq,
                               [pick_line(d, CITY) for d in (members[:10] if top10 else best_first(members))], top10, alts))

    for c in live:
        render(*c)
    # search-phrase pages: guide text from the closest category (homestays, hotels, resorts, all stays)
    guide_of = {c[0]: city_copy(c[0], c[1], c[4], c[5])[1] for c in live}
    # a "kind:<type>" or "camp" rule borrows that type's category guide and singular
    by_filter = {c[3]: c for c in live}
    for sp in searches:
        conds = sp['rule'].split(' & ')
        kind = next((k for k in ('resort', 'home', 'hotel', 'entire', 'camp') if k in conds), '')
        cat = by_filter.get(next((f'k:{c[5:]}' for c in conds if c.startswith('kind:')), 'k:Camps & tents' if kind == 'camp' else ''))
        g_slug = cat[0] if cat else {'resort': 'resorts', 'home': 'homestays', 'entire': 'holiday-rentals', 'hotel': 'hotels'}.get(kind, 'hotels')
        singular = cat[2] if cat else {'resort': 'resort', 'home': 'homestay', 'hotel': 'hotel'}.get(kind, 'stay')
        render(sp['stem'], sp['h1'], singular, 'q:' + sp['rule'], sp['intro'], guide_of.get(g_slug) or guide_of.get('hotels', ''), search=sp)

    near_pages = build_landmark_pages(stays, own, landmarks, top, bottom, today)
    for np in near_pages:
        full.append(full_entry(np['h1'], np['url'], np['desc'], None, np['facts'], np['tips'], np['faq'], np['picks'], False, [])
                    .replace('Top picks (the ones you can book online first):', 'Closest stays:'))
    write_llms_full(''.join(full), own)

    # sitemap.xml + llms.txt sections (regenerated between markers)
    sm = ''.join(f'''
  <url>
    <loc>{SITE}/hotels/best-{c[0]}-in-{CITY}</loc>
    <lastmod>{LASTMOD[f"best-{c[0]}-in-{CITY}"]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{"0.8" if c[3] == "all" else "0.6"}</priority>
  </url>''' for c in live) + ''.join(f'''
  <url>
    <loc>{SITE}/hotels/best-stays-near-{np['slug']}</loc>
    <lastmod>{LASTMOD[f"best-stays-near-{np['slug']}"]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>''' for np in near_pages) + ''.join(f'''
  <url>
    <loc>{SITE}/hotels/{sp['stem']}</loc>
    <lastmod>{LASTMOD[sp['stem']]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>''' for sp in searches)
    ensure_markers(f'{ROOT}/sitemap.xml', '</urlset>', '  ')
    replace_between(f'{ROOT}/sitemap.xml', f'<!-- {marker()}:start -->', f'<!-- {marker()}:end -->', sm + '\n  ')
    for path in [p for p in DATES if p.startswith('/hotels/') and not os.path.exists(f'{ROOT}{p}.html')]:
        del DATES[path]   # pages that no longer exist
    page_dates.save(DATES)
    ll = '\n' + '\n'.join(
        f'- [{f"Best Hotels in {CN} (all stays)" if c[3] == "all" else f"Best {c[1]} in {CN}"}]({SITE}/hotels/best-{c[0]}-in-{CITY}): '
        + (thin_notes.get(f'best-{c[0]}-in-{CITY}') or
           f'{counts[c[0]]:,} {"stays of every type, grouped by category" if c[3] == "all" else plural_of(c[0], c[1])}. {city_copy(c[0], c[1], c[4], c[5])[0]}')
        for c in live) + ''.join(
        f"\n- [Best stays near {np['name']}]({SITE}/hotels/best-stays-near-{np['slug']}): {np['near']} stays within {np['radius']:g} km of {np['name']}, sorted by distance, with a map."
        for np in near_pages) + ''.join(
        f"\n- [{sp['h1']}]({SITE}/hotels/{sp['stem']}): " + (thin_notes.get(sp['stem']) or f"{sp['count']:,} stays. {sp['intro']}")
        for sp in searches) + '\n\n'
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
    open(f'{STAYS_DIR}/stay.html', 'w', encoding='utf8', newline='\n').write(stay_top + stay_main + stay_bottom)
    if os.path.exists(f'{ROOT}/stay.html'):
        os.remove(f'{ROOT}/stay.html')  # pre-move copy
    print('verified booking links:', sum('o' in s for s in stays))

    print('pages:', ', '.join(f'{c[0]} ({counts[c[0]]})' for c in live))
    print('skipped:', ', '.join(f'{c[0]} ({counts[c[0]]})' for c in CATEGORIES if c not in live) or 'none')
    if CITY == DEFAULT_CITY:
        write_homestays_picks(stays)
    # every page's footer lists all category pages of both cities (footer_links.py)
    from footer_links import write_footers
    write_footers()
    page_dates.refresh_static()   # hand-made pages' <lastmod>, from their own content


if __name__ == '__main__':
    CITY = city_from_argv()   # --city <key>; default rishikesh
    CN = CITIES[CITY]['name']
    cache = cache_dir(CITY)
    crawled = sum(1 for _ in open(f'{cache}/props.jsonl', encoding='utf8'))
    main(f'{cache}/stays.json', crawled)
