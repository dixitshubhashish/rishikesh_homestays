# Stays pages pipeline (`best-*-in-rishikesh`)

Builds the market-index pages (`best-hotels-in-rishikesh.html` and its sibling
category pages) from the public Rishikesh listings on uttarakhand-hotels.com.

## Cities

Config: [`cities.py`](cities.py) (`CITIES`, `DEFAULT_CITY = 'rishikesh'`).
Every step takes `--city <key>`; without it, Rishikesh. Rishikesh keeps its
cache at `.cache/`; other cities use `.cache/<city>/`. Current cities:

| City | Directory listing | Stays | listing_id | Pages |
|---|---|---|---|---|
| Rishikesh (default) | `rishikesh-hotels-32481` | 1,608 | 1–1,608 | 29 |
| Haridwar | `haridwar-hotels-32456` | 806 | 1,609–2,414 | 26 |

Add a city: add it to `CITIES` (directory id and map centre), add its areas
to `AREAS_BY_CITY` in `process.py` and its copy and area notes to
`CITY_COPY` / `AREA_NOTES` in `build_pages.py`, then run
`crawl.py --city X`, `process.py --city X`, `build_pages.py --city X`, then
`build_pages.py` (Rishikesh last, so its city switcher links to the new city),
then `push_bigquery.mjs` (it loads every city at once).

Pages are written to `hotels/` (`/hotels/best-<category>-in-<city>`, property
page `/hotels/stay?s=<slug>&c=<city>`). Haridwar pages add a Kumbh 2027
section and FAQ, and the Kumbh guide links back to them.

## Steps

| Step | Command | Output |
|---|---|---|
| 1. Crawl | `python3 scripts/stays/crawl.py [--fresh]` | `.cache/props.jsonl` (raw, one record per property, not committed) |
| 2. Clean | `python3 scripts/stays/process.py [--names]` | `.cache/stays.json` |
| 3. Build | `python3 scripts/stays/build_pages.py` | `best-*-in-rishikesh.html` + `assets/js/modules/stays-index-data.js` |
| 3b. Match | `node scripts/stays/guess_booking_slugs.mjs [--shard i/N] [--workers n] [--limit n] [--out file]` | tries likely booking.com/hotel/in/<slug>.html pages (built from the stay's slug, name and city) for every stay without a verified link, in all cities, in a real browser (no web searches). Matches go to `.cache/slug-guesses.tsv` (or `--out`) and are merged into `ota-links.tsv`; stays tried without a match go to `<out>.tried` so re-runs skip them. `--shard i/N` splits the stays so N runs can go at once. Matching rule shared with `verify_candidates.mjs` in `booking-match.mjs` |
| 4. Snapshot | `node scripts/stays/push_bigquery.mjs` | one row per stay into BigQuery `rishikesh_homestays.market_properties` (partitioned by `snapshot_date`; re-running the same day replaces that day) |
| Auto | `python3 scripts/stays/refresh.py [--force]` | runs 1–4 only when due and the listing changed |

The crawl is resumable (re-run to continue) and polite: 4 workers with a pause
after each page; the source's robots.txt allows crawling. A full crawl of
~1,650 properties takes about 15 minutes.

## What each record gets

- **Name**: tidied for reading (`2BHK` not `02 Bhk`, `Victoria's` not
  `Victoria'S`, no slug-style hyphens, no trailing "Rishikesh").
- **Area**: a keyword in the name/address first (uses the site's `AREAS` names
  where they exist), else the nearest area centre within 1.2 km by map position,
  else "Elsewhere in Rishikesh".
- **Types** (`ks`, can be several): the directory's own section, plus each type
  word found as a whole word in the name. Weak hotel words (inn, residency,
  palace) only count when nothing else is known, so a villa called "Kedar
  Residency" isn't also listed as a hotel.
- **Theme tags** (`t`): `pet` (Pets allowed), `ganga` (Ganga/river/ghat in the
  name), `luxury` (4–5 stars or from ₹8,000), `budget` (≤ ₹1,500), `pool`.
- **Bedrooms** (`bd`): from the name only ("2BHK", "3 bedroom", "2BR",
  "Studio", "1RK"; the crawled facilities never give a count). 0 = studio,
  1–8, 9 = 8+. Left out when the name doesn't say or gives two sizes
  ("1 & 2 BHK"): never guessed. Feeds the size pages (`b:<min>-<max>`
  filters: studio & 1 BHK, 2 BHK, 3 BHK and bigger) and BigQuery `bedrooms`.
- Stars, guest rating, review count, starting price, facilities, as listed.

## Pages

`CATEGORIES` in `build_pages.py` is the single list of pages. Each entry gives
one `best-<slug>-in-rishikesh.html`. A category with fewer than 5 stays gets no
page, and its old page file is deleted. All pages share one header/footer
(copied from `thanks.html` at build time), one script
(`assets/js/modules/stays-index.js`) and the same category strip, so every page
links to every other. `best-hotels-in-rishikesh` is the master list: all stays,
one section per category, with 20 rows visible per section before "Show all"
(which then scrolls in place) and an "Open page" link to the category page.

## Ordering and our own stays

Besides the pinned "Our homestays" block, our stays are **mixed into every
list**: after the 3rd row, then after every 7th, rotating through `OWN`
(`mix_html()` in `build_pages.py`, mirrored by `mixHtml()` in
`stays-index.js` for filtered views). On `/stay` pages they sit after the 2nd
and 4th "Similar stays". They look exactly like the other rows (no badge or
border). In hostel lists, and next to a hostel, their type reads "Private
stay" (the not-shared alternative to a dorm). Only their real guest rating
is shown, and only when it's 9 or more: never invent ratings.

Order: stays with a verified booking link first, then the rest, in a fixed order
(no shuffle). Category pages list the linked stays directly and put the rest in a
"View all N …" fold (`<details class="sx-rest">`, still in the HTML for crawlers);
a list with fewer than `SHOW_MIN` (10) linked stays is topped up to 10
(`split_shown()` in `build_pages.py`, `shownCount()` in `stays-index.js` for
filtered views). The master page shows 20 per section, linked first, with
"View all" to the category page. Our own properties (`OWN` in
`build_pages.py`: Advaitam, Elysium, and "Yoga Retreat at the Ganges",
matched by exact source URL so no other yoga retreat is caught) are taken out
of the data and pinned in an "Our homestays · Book direct" block on
top of every page. Their buttons go to our own page (Advaitam) or `/contact`,
never to the source listing.

## View property, lead popup and booking links

Every listing's button is **View property** → `/stay?s=<id>` (one shared
`stay.html`, rendered by `assets/js/modules/stay-page.js`, `noindex`). Its
"Book this stay" popup takes name, phone (required) and email (optional):

- **Guests:** one total-guests stepper (kids included), labelled with one of 18 quirky Rishikesh questions picked at random on each open (`GUEST_QUESTIONS` in `stay-page.js`: Triveni and Parmarth aarti, Ganga snan, Laxman/Ram Jhula, Chotiwala, chai, rafting, yoga, Beatles Ashram, Kunjapuri, Neer Garh, Neelkanth…). Sent as `guests_total`.
- **Submit** posts the lead to `/api/contact` (source `stay_redirect_<site>`
  or `stay_enquiry`, `preferred_stay` = the stay id), waits for it to be
  acknowledged, then sends the guest to the stay's **one** verified booking
  page. With no verified page, it goes to `/thanks`.
- **Map**: a Leaflet + OpenStreetMap map (self-hosted in `assets/vendor/leaflet/`) shows this stay, our 3 homestays and other stays within 1.5 km, each linking to its own info page.
- **Chat on WhatsApp** opens a chat prefilled with the stay's name, type and area (plus the guest's name if typed), then a reference block for us: the stay id, its `/stay` link, and the straight-line distance from our nearest own homestay.

Booking pages live in `ota-links.tsv` (committed): one row per stay, with
`verified` / `doubtful` / `none`. Only `verified` rows are used, and those
stays are listed first on every page. Rows come from web searches checked on
distinctive name + area, preferring Booking.com, then MakeMyTrip, Agoda,
Airbnb. A URL that was pieced together rather than seen in a result is never
`verified`. `merge_ota.py` merges new search results (never downgrading a
verified row). Booking.com links are wrapped in our CJ affiliate deep link (IDs in `assets/js/modules/affiliate-links.js`), not `?aid=`; the Booking.com
affiliate ID to every Booking.com link.

**Owner review sheet.** Doubtful and not-found stays are in the Google Sheet
"Rishikesh Stays – Booking Links to Review"
(https://docs.google.com/spreadsheets/d/1KI8La77lRZlNsp7NrGeppS8IiIKIWXDlXl65ktSSNFE).
Mark *Confirmed* Y/N (optionally with your own site/URL), download it as CSV,
and run `import_review.py <file.csv>`, then `build_pages.py`.

Status on 2026-10-04: 328 of 1,605 stays searched, with 196 verified,
75 doubtful and 57 none. Two lessons: search by the **full property name,
unquoted** (`<name> Rishikesh booking.com`), not by our URL key, which finds
far more matches. And a candidate URL found any way (reviews page, slug) is
confirmed by `node scripts/stays/verify_candidates.mjs [extra.tsv]`: it lands
on Booking's property page, and the title names the property. That check uses
no web searches. The 200-search cap is shared by the whole session. The
remaining ~1,280 stays need the Google Programmable Search API (owner to add
GOOGLE_CSE_ID/KEY). Always finish with `node scripts/stays/check_links.mjs`.

## Landmark pages ("stays near …")

`hotels/best-stays-near-<landmark>.html` (`/hotels/best-stays-near-<slug>`),
built by `build_landmark_pages()` in `build_pages.py` from
[`landmarks.tsv`](landmarks.tsv) (slug, name, city, lat/lng, related guide,
coordinate source). Coordinates came from OpenStreetMap (Overpass/Nominatim)
and, for Laxman Jhula, structurae/bridgemeister. Check any new landmark's
coordinates against two sources: geocoders often return a nearby cafe or
the town centre instead of the place itself.

Each page lists every stay within 2 km (3 km where fewer than 10 are that
close), sorted by straight-line distance in bands ("a short walk" ≤ 500 m,
within 1 km, 1–2 km), up to 100 rows, plus a Leaflet map
(`assets/js/modules/landmark-map.js`), FAQs, and JSON-LD (CollectionPage
about a TouristAttraction with geo, BreadcrumbList, ItemList, FAQPage).
**Our own homestays always appear** as "A calmer base", with their real
distance and a rough drive time (`drive_minutes()`: roads ~1.35× the
straight line, 20 km/h in town, 35 km/h on the highway). When one is
genuinely within the radius (e.g. Yoga Retreat, 1.6 km from AIIMS), it also
appears in the distance list. Category pages link to every landmark page of
their city ("Stay near …"), and all landmark pages are in `sitemap.xml` and
`llms.txt`. Current: 9 in Rishikesh, 5 in Haridwar.

## Listing IDs (primary key)

Every stay has a permanent numeric **`listing_id`**, kept in the committed
registry [`listing-ids.tsv`](listing-ids.tsv) (`listing_id`, `slug`,
`active`). Our own stays are 1 (Advaitam), 2 (Elysium) and 3 (Yoga Retreat).
`process.py` keeps every existing id, gives new stays the next number, and
marks stays that disappear `active = 0`; ids are never reused. The `slug`
(e.g. `zostel-rishikesh-tapovan`) is the unique text key used in page URLs
(`/stay?s=<slug>`), in `ota-links.tsv` and in BigQuery's `id` column.

| File / table | Key |
|---|---|
| `listing-ids.tsv` | `listing_id` ↔ `slug` |
| `.cache/stays.json`, `stays-index-data.js` | `lid` (listing_id), `id` (slug) |
| `ota-links.tsv` | `slug` (column `key`) |
| BigQuery `market_properties` | `listing_id`, `id` (slug), `snapshot_date` |
| BigQuery view `stays_sheet` | `listing_id`, `slug` |

## BigQuery: market_properties

Each snapshot holds every stay with name, area, types, themes, stars, guest
rating, reviews, starting price, facilities, address, lat/lng, booking-link
status/site/URL, `is_own` and the source URL. Snapshots are dated, so changes
can be tracked over time. Example:

```sql
SELECT area, COUNT(*) stays, COUNTIF('pet' IN UNNEST(themes)) pet_friendly,
       APPROX_QUANTILES(price_from_inr, 2)[OFFSET(1)] median_price
FROM rishikesh_homestays.market_properties
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM rishikesh_homestays.market_properties)
  AND 'Homestays' IN UNNEST(types)
GROUP BY area ORDER BY stays DESC;
```

**View `rishikesh_homestays.stays_sheet`** is the latest snapshot as one
flat row per stay: listing_id, slug, property, area, types, stars, rating,
reviews, price, `ours`, `our_page` (`/stay?s=…`), booking status/site, the
booking URL (Booking.com links via our CJ affiliate deep link; `booking_page` is the raw page), the directory listing,
and latitude/longitude. Open it in Google Sheets via **Data → Data
connectors → Connect to BigQuery → `keen-device-610` → `rishikesh_homestays`
→ `stays_sheet`**. The view always shows the newest snapshot.

The GitHub workflow pushes a snapshot after each rebuild if the repo secret
`GOOGLE_APPLICATION_CREDENTIALS_JSON` is set (same JSON as on Vercel).

## Auto-refresh

`.github/workflows/stays-refresh.yml` runs `refresh.py` daily. It exits right
away unless the gap since `last_check` in `refresh.state` has passed. When due,
it fetches only the listing page and diffs its links against
`listing-urls.txt`:

- new or removed properties: full re-crawl and rebuild; gap resets to 7 days;
- no change: no crawl; gap doubles (7 → 14 → 28 → 56 days max).

The workflow commits any changed pages/data and pushes, and Vercel then
deploys. Run it by hand from GitHub's Actions tab (with **force** to re-crawl
immediately), or locally with `python3 scripts/stays/refresh.py --force`.

**Parallel checks:** `node verify_candidates.mjs <candidates.tsv> --out <results.tsv>` checks only that file and appends matches to `results.tsv` instead of rewriting `ota-links.tsv`, so many runs can go at once (split the candidates into shards, then `python3 merge_ota.py results-*.tsv`). Each stay only accepts a page in its own city, a title that adds its own distinctive words to a one-word name is rejected, and a different BHK count is rejected. Booking's 429 is backed off and retried. Before merging, drop pages claimed by several stays whose names differ, or that already belong to another verified stay.

**Other platforms (sitemaps):** `python3 sitemap_candidates.py <easemytrip|agoda> <urls.txt>` matches stays without a verified link against a platform's public sitemap URL list (EaseMyTrip: `.cache/easemytrip-hotels.txt`, 197,897 hotels; Agoda: `.cache/agoda-hotels.txt`, Rishikesh + Haridwar only), then `node verify_platform.mjs <candidates.tsv> --out <results.tsv> [--shard i/N] [--slow]` checks each page's title in a browser (same rule, `titleMatches` in `booking-match.mjs`), and `python3 postcheck_matches.py <out.tsv> <results.tsv>…` drops pages claimed by differently named stays before `merge_ota.py`. Agoda answers 502 to bursts: use `--slow` (one page at a time); the run stops itself after 8 refusals in a row. Goibibo/MakeMyTrip sitemaps sit behind bot protection and Airbnb's list only bare room ids, so those need a search API.

## Google Maps places (Places API, internal only)

Every place to stay Google Maps knows within 20 km of Rishikesh and Haridwar, kept in BigQuery `rishikesh_homestays.places_lodging` for our own planning and outreach. **Never shown on the site** (phones especially). Uses the BigQuery service account against project keen-device-610 (Places API (New) is enabled there; billing applies).

| Step | Command | Cost |
|---|---|---|
| 1. ids | `node scripts/stays/places_sweep.mjs --phase ids` — 662 tiles of ~2 km × one-word searches ("hotel", "homestay", "guest house", "dharamshala"…), tiles at the 60-result cap split in four; resumable (`.cache/places/tiles-done.json`) | IDs-only searches (free tier) |
| 2. details | `--phase details` — name, address, location, type, open/closed per id, 6 at a time with per-minute 429 back-off | Pro, ≈5,000 free/month |
| 3. phones | `--phase phones --ids .cache/places/need-phones.json` — phone + website only for places worth contacting (new to us or no booking link); **always `--dry-run` first** | Enterprise, ≈1,000 free/month then ≈$20/1,000 |
| 4. load | `node scripts/stays/push_places.mjs` — matches each place to a directory stay (≤300 m + same name words, or exact name ≤1.5 km), attaches booking links, writes `need-phones.json` and `unlinked-stays.json`, replaces the BigQuery table | — |

Booking links for Google places that aren't in the directory come from the same browser-checked matchers, pointed at them with `STAYS_FILE=.cache/places/unlinked-stays.json` (keys `g-<place_id>`): `sitemap_candidates.py booking|easemytrip` → `verify_platform.mjs`, and `guess_booking_slugs.mjs --out .cache/places/guess-<n>.tsv` (resumable via `.tried`); then `STAYS_FILE=.cache/places/all-stays.json postcheck_matches.py .cache/places/ota-links.tsv <results…>` and `push_places.mjs`. A place whose own Google website is a booking-site page (OYO, Agoda, Airbnb, Booking.com…) uses that link when we have none (`booking_source = google_website`).

Columns: place_id, city, km_from_centre, name, address, lat/lng, google_type(s), business_status, phone, website, website_ota, google_maps_url, in_directory, listing_id, slug, match_m, booking_site, booking_url (Booking.com with aid), booking_source (directory | matched | google_website), our_page, fetched_date. Google's terms: keep place ids; re-run the sweep monthly rather than keeping other fields longer.

Latest run (2026-10-03): 4,947 places (Rishikesh 3,131, Haridwar 1,816); 1,199 directory stays matched, 3,395 new to us; 2,036 phones (of 4,125 looked up, ≈$63); 1,287 with a booking link.

**Google Maps places on the site:** open places new to us with a confirmed booking link are listed like directory stays. `push_places.mjs` writes `.cache/places/new-with-link.json`; `python3 scripts/stays/import_google_stays.py` turns them into `<cache>/google-extra.jsonl` rows (slug from the name, Google type as a type hint, no Google address) and merges their links into `ota-links.tsv`; `process.py` appends those rows, so areas, types, tags and listing_ids come from our own logic, and marks them `gm` (their Google Maps link). Pages: a `gm` stay shows "View on Google Maps" instead of our OpenStreetMap map, is never pinned on our maps, and stays off the landmark pages (Google's terms). Booking-site websites are matched by domain (`ellbeehotels.com` is not hotels.com). A booking-site homepage ("https://www.agoda.com/") never counts as a link. Google-sourced stays (`gm`) are excluded from directory matching in `push_places.mjs`, so re-runs keep them. Listed (2026-10-03): 287 (Rishikesh 134, Haridwar 153).
