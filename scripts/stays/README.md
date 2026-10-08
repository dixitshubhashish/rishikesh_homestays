# Stays pages pipeline

Builds the generated stays pages in `hotels/` (category, landmark and
search-phrase pages for Rishikesh, Haridwar, Dehradun and Mussoorie, plus the property page
`stay.html`) and the per-city data modules from the public listings on
uttarakhand-hotels.com, plus Google Maps places with a confirmed booking link.
Live counts are in `docs/HANDOFF.md`; the booking-link search is in
`docs/booking-links/RULES.md`. Never hand-edit the outputs: change these
scripts and rebuild.

## Cities

Config: [`cities.py`](cities.py) (`CITIES`, `DEFAULT_CITY = 'rishikesh'`).
Every step takes `--city <key>`; without it, Rishikesh. Rishikesh keeps its
cache at `.cache/`; other cities use `.cache/<city>/`. Current cities:

| City | Directory listing | Data module | Category pages |
|---|---|---|---|
| Rishikesh (default) | `rishikesh-hotels-32481` | `stays-index-data.js` | 33 |
| Haridwar | `haridwar-hotels-32456` | `stays-index-data-haridwar.js` | 33 |
| Dehradun | `dehradun-hotels-14775` | `stays-index-data-dehradun.js` | 32 |
| Mussoorie | `mussoorie-hotels-13000` | `stays-index-data-mussoorie.js` | 32 |

Add a city: add it to `CITIES` (directory id and map centre), add its areas
to `AREAS_BY_CITY` in `process.py` and its copy and area notes to
`CITY_COPY` / `AREA_NOTES` in `build_pages.py`, then run
`crawl.py --city X`, `process.py --city X`, `build_pages.py --city X`, then
`build_pages.py` (Rishikesh last, so its city switcher links to the new city),
then `push_bigquery.mjs` (it loads every city at once). Also: the landmarks
(`landmarks.tsv`, `city` column), the city's phrase rows (`search-pages.tsv`), its
`NEAREST` / `AWAY` entries and copy in `build_pages.py`, `CITY_NOTES` in
`search_pages.py`, and the city's name in `stays-index.js`, `stay-page.js`,
`site-search.js` and `scripts/search/build-index.mjs` (`CITY_DATA`). Use the
`all-accommodations` listing, not `all-hotels`: for Dehradun and Mussoorie
`all-hotels` lists only the star-rated hotels (357 and 381) and is a subset of
`all-accommodations` (1,330 and 1,011 properties). Dehradun and Mussoorie are in
big districts: `FAR_KM` in `process.py` marks a stay more than 30 km from the
centre "Outside <city>" whatever its address says, and `MAP_KM` sets how far an
address-less stay may be from an area's centre. A property the directory lists
in two cities is listed once, in the city that already has it. Dehradun and
Mussoorie are not on the Ganga: no river or Ganga phrase rows for them, and our
own homestays (in Rishikesh) are labelled with their road distance
(`AWAY` in `build_pages.py`), never a drive time promised from a straight line.

Pages are written to `hotels/` (`/hotels/best-<category>-in-<city>`, property
page `/hotels/stay?s=<slug>&c=<city>`). Haridwar pages add a Kumbh 2027
section and FAQ, and the Kumbh guide links back to them.

## Steps

| Step | Command | Output |
|---|---|---|
| 1. Crawl | `python3 scripts/stays/crawl.py [--fresh]` | `.cache/props.jsonl` (raw, one record per property, not committed) |
| 2. Clean | `python3 scripts/stays/process.py [--names]` | `.cache/stays.json` |
| 3. Build | `python3 scripts/stays/build_pages.py` (all cities: `npm run build:stays`, Dehradun, Mussoorie, Haridwar, then Rishikesh) | `hotels/best-*-in-<city>.html`, landmark and search-phrase pages, `hotels/stay.html`, the city's data module, footers (`footer_links.py`), `sitemap.xml`, `llms.txt`, `llms-full.txt` |
| 3b. Match (older) | `node scripts/stays/guess_booking_slugs.mjs [--shard i/N] [--workers n] [--limit n] [--out file]` | tries likely booking.com/hotel/in/<slug>.html pages (built from the stay's slug, name and city) for every stay without a verified link, in all cities, in a real browser (no web searches). Matches go to `.cache/slug-guesses.tsv` (or `--out`) and are merged into `ota-links.tsv`; stays tried without a match go to `<out>.tried` so re-runs skip them. `--shard i/N` splits the stays so N runs can go at once. Matching rule shared with `verify_candidates.mjs` in `booking-match.mjs` |
| 4. Snapshot | `node scripts/stays/push_bigquery.mjs` | one row per stay into BigQuery `rishikesh_homestays.market_properties` (partitioned by `snapshot_date`; re-running the same day replaces that day) |
| Auto | `python3 scripts/stays/refresh.py [--force]` | runs 1–4 only when due and the listing changed |

Each step takes `--city <key>` (shown here without it, so Rishikesh). Check
the result with `npm run check:stays`.

The crawl is resumable (re-run to continue) and polite: 4 workers with a pause
after each page; the source's robots.txt allows crawling. A full Rishikesh
crawl (~1,650 properties) takes about 15 minutes; Haridwar has ~830, Dehradun 1,330 and Mussoorie 1,011 (about 35 and 25 minutes; the crawl keeps its pace of 4 workers and a pause per page). Two Mussoorie listings (Kempty Oasis) have host names over the 63-character DNS limit and cannot be fetched; they are skipped.

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
one `best-<slug>-in-<city>.html`. **Every page exists in every city** (owner,
2026-10-05, extended to four cities 2026-10-08) so the city switch at the top of every page always
lands on the same page: a category gets a page in each city once *any* city
has 5 stays for it (both builds decide from the same data, `prepared_stays()`).
Where a city has fewer (Haridwar has no camps), the page says so honestly, lists
what there is, then the same page's stays in the other city ("about 25 km
upriver") and similar stays in this city (`CATEGORY_FALLBACK`, or the
best-reviewed). A category no city has 5 stays for gets no page, and its old
page file is deleted. All pages share one header/footer
(copied from `thanks.html` at build time; the footer of every site page lists
every category page of every city, "Stays in Rishikesh", then Haridwar, Dehradun, Mussoorie, one wrapped line of links each, between `<!-- footer-stays -->`
markers written by `footer_links.py`; on phones each city's search-phrase
links fold behind "More <city> searches", a CSS-only toggle with the links
still in the HTML), one script
(`assets/js/modules/stays-index.js`) and the same category strip, so every page
links to every other. `best-hotels-in-rishikesh` is the master list: all stays,
one section per category, with 20 rows visible per section before "Show all"
(which then scrolls in place) and an "Open page" link to the category page.

## Search-phrase pages

`search-pages.tsv` holds one row per phrase people search ("Rishikesh Hotels 5 Star", "Rooms near AIIMS Rishikesh", "Top 10 Homestays in Haridwar"…); `search_pages.py` loads it. Columns:

- **phrase**: the page's address and `<h1>`, in the searcher's own words (never reworded); `{City}` = the city name.
- **rule**, joined with ` & `: `home | hotel | resort | resortcamp | entire | camp`, `price<N`, `price<=N`, `priced`, `river`, `gangaview`, `family`, `kitchen`, `pool`, `luxury`, `wedding`, `oyo`, `linked`, `stars=N`, `stars>=N`, `area:<Area>`, `near:<landmark>:<km>` (a slug from `landmarks.tsv`), `kind:<Kind>` (a kind with ` & ` in its name needs an alias, e.g. `camp`), `top10`.
- **group**: blank one list, `a` area, `s` stars, `k` type, `pb` price band, `d` distance from the rule's landmark, `c` like the main page.
- **cities**: `both` (every city), one key, or several keys joined with a comma (`rishikesh,haridwar`: the river and Ganga phrases; `rishikesh,haridwar,dehradun`: "near railway station", as Mussoorie has no station). A `both` phrase gets a page in every city once any city has `MIN_PAGE` stays (Top 10: 10 with 5+ reviews), with the same thin-page fallback as categories.
- **intro**: the one-line lede.
- **twin** (one-city phrases only): the other city's phrase its city switch goes to, e.g. `Rooms near AIIMS Rishikesh` ↔ `Rooms near Patanjali Haridwar`; blank = that city's main list.

`build_pages.py` renders each with the category template at `/hotels/<phrase-slug>`, adds the page's own tips, facts and FAQs (`page_content()`: what the rule means in practice, cheapest, best-reviewed, closest, where they are), lists the pages in the data module's meta (`searches`), sitemap.xml, llms.txt and every footer, and removes a phrase's page once it drops out. `stays-index.js` mirrors the rules (`ruleMatches`) and groupings (price and distance bands) so the page filters keep working: keep them in step.

"Rooms near" / "Hotels near" pages for big places and institutions (AIIMS, Himalayan Hospital, Jolly Grant airport, Neelkanth, Patanjali Yogpeeth, Shantikunj, Gurukul Kangri, BHEL, SIDCUL, the ghats and stations) use `near:` rules on `landmarks.tsv`, which also makes each place's map page (`best-stays-near-<slug>`, 2 km, widened to 3 then 5 km, never past the row's `max_km`). Coordinates come from OpenStreetMap (Nominatim/Overpass), never a paid API; add a place's practical note to `LANDMARK_NOTES` in `search_pages.py`.

**Dates and IndexNow**: a page's sitemap `<lastmod>` and JSON-LD `dateModified` come from `page_dates.py` (fingerprint of the page's `<main>` in `page-dates.tsv`): unchanged content keeps its date, so a rebuild that changes nothing leaves sitemap.xml untouched, and `scripts/indexnow.mjs` (run by `.github/workflows/indexnow.yml` after a push) sends only the pages whose date moved. Hand-made pages get the same treatment via `page_dates.refresh_static()` at the end of the Rishikesh build (fingerprint: the whole file minus the generated footer block). IndexNow is shared by Bing (and so ChatGPT search, Copilot, DuckDuckGo) and other engines; Google does not take part and reads the sitemap. By hand: `npm run indexnow -- --from <git ref>` or `--all`, plus `--dry-run` to only list. The scheduled stays refresh pings IndexNow itself, because its bot pushes don't start other workflows. The public key file `998dc5c32f318e29058c994927f39486.txt` at the repo root proves ownership: never delete or rename it. Without a local crawl of the other city (the scheduled refresh on GitHub crawls Rishikesh only), `prepared_stays()` reads that city's committed data module.

**Sitemap and AI assistants**: every build rewrites its city's section of `sitemap.xml` and `llms.txt` (between the `stays-pages` markers for Rishikesh, `stays-pages-<city>` for other cities; one line per page in `llms.txt`) and `llms-full.txt` (`write_llms_full()`: per page the summary, typical prices, main areas, facts, best-reviewed bookable picks with links to their `/hotels/stay` pages, nearest alternatives on thin pages, tips, FAQs and a prefilled WhatsApp link to 80500 91290, plus how to book our own homestays direct; the intro, own homestays and key pages come from `llms.txt`; about 1.2 MB). Thin pages are described honestly, never as "0 stays".

Add a phrase or place: add a row, then `npm run build:stays` (every city, footers, sitemap, llms.txt) and `npm run check:stays`: every stays page must have 450+ words of guide text outside the lists (landmark pages 300+), its own title, `<h1>`, lede and description, 2+ FAQs, one in-content ad slot after the lists, a working city switch and a sitemap entry.

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
top of every page (on another city's pages they are labelled as being in
Rishikesh). Their buttons go to our own page (Advaitam) or `/contact`,
never to the source listing.

## View property, lead popup and booking links

Every listing's button is **View property** → `/hotels/stay?s=<slug>&c=<city>`
(one shared `hotels/stay.html`, rendered by `assets/js/modules/stay-page.js`, `noindex`). Its
"Book this stay" popup takes name, phone (required) and email (optional):

- **Guests:** one total-guests stepper (kids included), labelled with one of 18 quirky Rishikesh questions picked at random on each open (`GUEST_QUESTIONS` in `stay-page.js`: Triveni and Parmarth aarti, Ganga snan, Laxman/Ram Jhula, Chotiwala, chai, rafting, yoga, Beatles Ashram, Kunjapuri, Neer Garh, Neelkanth…). Sent as `guests_total`.
- **Submit** posts the lead to `/api/contact` (source `stay_redirect_<site>`
  or `stay_enquiry`, `preferred_stay` = the stay id), waits for it to be
  acknowledged, then sends the guest to the stay's **one** verified booking
  page. With no verified page, it goes to `/thanks`.
- **Map**: a Leaflet + OpenStreetMap map (self-hosted in `assets/vendor/leaflet/`) shows this stay, our 3 homestays and other stays within 1.5 km, each linking to its own info page.
- **Chat on WhatsApp** opens a chat prefilled with the stay's name, type and area (plus the guest's name if typed), then a reference block for us: the stay id, its `/hotels/stay` link, and the straight-line distance from our nearest own homestay.

Booking pages live in `ota-links.tsv` (committed): one row per stay, with
`verified` / `doubtful` / `none`. Only `verified` rows are used, and those
stays are listed first on every page. Rows come from web searches checked on
distinctive name + area, preferring Booking.com, then MakeMyTrip, Agoda,
Airbnb. A URL that was pieced together rather than seen in a result is never
`verified`. `merge_ota.py` merges new search results (never downgrading a
verified row). Booking.com links are wrapped in our CJ affiliate deep link
(IDs in `assets/js/modules/affiliate-links.js`); never `?aid=`.

New links come from the browser search in `docs/booking-links/` (rules,
lists and merge steps in its `RULES.md`). Search by the **full property
name, unquoted**, not by our URL key: it finds far more. Always finish a merge
with `node scripts/stays/check_links.mjs`.

**Older review flow** (before `docs/booking-links/review.tsv`): doubtful and
not-found stays went to the Google Sheet "Rishikesh Stays – Booking Links to
Review"
(https://docs.google.com/spreadsheets/d/1KI8La77lRZlNsp7NrGeppS8IiIKIWXDlXl65ktSSNFE):
mark *Confirmed* Y/N (optionally with your own URL), download as CSV, run
`import_review.py <file.csv>`, then rebuild.

## Landmark pages ("stays near …")

`hotels/best-stays-near-<landmark>.html` (`/hotels/best-stays-near-<slug>`),
built by `build_landmark_pages()` in `build_pages.py` from
[`landmarks.tsv`](landmarks.tsv) (slug, name, city, lat/lng, related guide,
coordinate source, schema type, `max_km`). Coordinates came from OpenStreetMap (Overpass/Nominatim)
and, for Laxman Jhula, structurae/bridgemeister. Check any new landmark's
coordinates against two sources: geocoders often return a nearby cafe or
the town centre instead of the place itself.

Each page lists every stay within 2 km (widened to 3, then 5 km where fewer
than 10 are that close, never past the row's `max_km`), sorted by
straight-line distance in bands (under 500 m, 500 m–1 km, 1–2 km, 2–3 km,
3 km+), up to 100 rows (`LANDMARK_MAX_ROWS`), plus a Leaflet map
(`assets/js/modules/landmark-map.js`), FAQs, and JSON-LD (CollectionPage
about a TouristAttraction with geo, BreadcrumbList, ItemList, FAQPage).
**Our own homestays always appear** as "A calmer base", with their real
distance and a rough drive time (`drive_minutes()`: roads ~1.35× the
straight line, 20 km/h in town, 35 km/h on the highway). When one is
genuinely within the radius (e.g. Yoga Retreat, 1.6 km from AIIMS), it also
appears in the distance list. Category pages link to every landmark page of
their city ("Stay near …"), and all landmark pages are in `sitemap.xml` and
`llms.txt`. Current: 20 pages.

## Listing IDs (primary key)

Every stay has a permanent numeric **`listing_id`**, kept in the committed
registry [`listing-ids.tsv`](listing-ids.tsv) (`listing_id`, `slug`,
`active`, `city`). Our own stays are 1 (Advaitam), 2 (Elysium) and 3 (Yoga
Retreat). The first crawls gave Rishikesh 1–1,608 and Haridwar 1,609–2,414;
since then every new stay (either city, Google Maps places included) gets the
next free number, so ids are not in per-city blocks. `process.py` keeps every
existing id and marks stays that disappear `active = 0`; ids are never reused.
The `slug` (e.g. `zostel-rishikesh-tapovan`) is the unique text key used in
page URLs (`/hotels/stay?s=<slug>&c=<city>`), in `ota-links.tsv` and in
BigQuery's `id` column.

| File / table | Key |
|---|---|
| `listing-ids.tsv` | `listing_id` ↔ `slug` |
| `.cache/stays.json`, `stays-index-data*.js` | `lid` (listing_id), `id` (slug) |
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
reviews, price, `ours`, `our_page` (`/hotels/stay?s=…`), booking status/site, the
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

## Older booking-link matchers

Used before the browser search in `docs/booking-links/`; still work for
batches of candidate URLs. A candidate URL found any way (reviews page, slug)
is confirmed by `node scripts/stays/verify_candidates.mjs [extra.tsv]`: it
lands on Booking's property page and checks the title names the property
(no web searches).

**Parallel checks:** `node verify_candidates.mjs <candidates.tsv> --out <results.tsv>` checks only that file and appends matches to `results.tsv` instead of rewriting `ota-links.tsv`, so many runs can go at once (split the candidates into shards, then `python3 merge_ota.py results-*.tsv`). Each stay only accepts a page in its own city, a title that adds its own distinctive words to a one-word name is rejected, and a different BHK count is rejected. Booking's 429 is backed off and retried. Before merging, drop pages claimed by several stays whose names differ, or that already belong to another verified stay.

**Other platforms (sitemaps):** `python3 sitemap_candidates.py <easemytrip|agoda> <urls.txt>` matches stays without a verified link against a platform's public sitemap URL list (EaseMyTrip: `.cache/easemytrip-hotels.txt`, 197,897 hotels; Agoda: `.cache/agoda-hotels.txt`, Rishikesh + Haridwar only), then `node verify_platform.mjs <candidates.tsv> --out <results.tsv> [--shard i/N] [--slow]` checks each page's title in a browser (same rule, `titleMatches` in `booking-match.mjs`), and `python3 postcheck_matches.py <out.tsv> <results.tsv>…` drops pages claimed by differently named stays before `merge_ota.py`. Agoda answers 502 to bursts: use `--slow` (one page at a time); the run stops itself after 8 refusals in a row. Goibibo/MakeMyTrip sitemaps sit behind bot protection and Airbnb's list only bare room ids, so those need a search API.

## Google Maps places (Places API, internal only)

Every place to stay Google Maps knows within 20 km of Rishikesh and Haridwar, kept in BigQuery `rishikesh_homestays.places_lodging` for our own planning and outreach. **Never shown on the site** (phones especially). Uses the BigQuery service account against project keen-device-610 (Places API (New) is enabled there). **Places API calls cost money: the sweep was done once by the owner's decision; never run a phase without the owner's OK.**

| Step | Command |
|---|---|
| 1. ids | `node scripts/stays/places_sweep.mjs --phase ids`: 662 tiles of ~2 km × one-word searches ("hotel", "homestay", "guest house", "dharamshala"…), tiles at the 60-result cap split in four; resumable (`.cache/places/tiles-done.json`) |
| 2. details | `--phase details`: name, address, location, type, open/closed per id, 6 at a time with per-minute 429 back-off |
| 3. phones | `--phase phones --ids .cache/places/need-phones.json`: phone + website only for places worth contacting (new to us or no booking link); **always `--dry-run` first** |
| 4. load | `node scripts/stays/push_places.mjs` (no Places calls): matches each place to a directory stay (≤300 m + same name words, or exact name ≤1.5 km), attaches booking links, writes `need-phones.json` and `unlinked-stays.json`, replaces the BigQuery table |

Booking links for Google places that aren't in the directory come from the same browser-checked matchers, pointed at them with `STAYS_FILE=.cache/places/unlinked-stays.json` (keys `g-<place_id>`): `sitemap_candidates.py booking|easemytrip` → `verify_platform.mjs`, and `guess_booking_slugs.mjs --out .cache/places/guess-<n>.tsv` (resumable via `.tried`); then `STAYS_FILE=.cache/places/all-stays.json postcheck_matches.py .cache/places/ota-links.tsv <results…>` and `push_places.mjs`. A place whose own Google website is a booking-site page (OYO, Agoda, Airbnb, Booking.com…) uses that link when we have none (`booking_source = google_website`).

Columns: place_id, city, km_from_centre, name, address, lat/lng, google_type(s), business_status, phone, website, website_ota, google_maps_url, in_directory, listing_id, slug, match_m, booking_site, booking_url (Booking.com via the CJ link), booking_source (directory | matched | google_website), our_page, fetched_date. Google's terms: keep place ids; other fields are meant to be refreshed (monthly) rather than kept long. The owner chose no refresh for now.

**Rebuilding the search cache from BigQuery:** `node scripts/stays/rebuild_places_cache.mjs [--dry-run] [--force]` (read-only SELECT, no Places calls; refuses to overwrite an existing cache without `--force`) regenerates `.cache/places/places.json`, `all-stays.json` (`g-<place_id>`, n, cy, ll), `ota-links.tsv` (the `matched` links, Booking.com unwrapped) and `phones.json` (internal, gitignored, the sweep's `{id: {phone, website}}` that `push_places.mjs` needs for the `google_website` links) on a machine without the originals. It holds the last BigQuery load, so links merged since are re-derived by `merge_found.sh`. The directory `.cache/stays.json` files are not rebuilt from BigQuery: they come from `crawl.py` then `process.py` for each city.

Sweep (2026-10-03): 4,947 places (Rishikesh 3,131, Haridwar 1,816); 1,199 directory stays matched, 3,395 new to us; 2,036 phones (of 4,125 looked up); 1,287 with a booking link.

**Google Maps places on the site:** open places new to us with a confirmed booking link are listed like directory stays. `push_places.mjs` writes `.cache/places/new-with-link.json`; `python3 scripts/stays/import_google_stays.py` turns them into `<cache>/google-extra.jsonl` rows (slug from the name, Google type as a type hint, no Google address) and merges their links into `ota-links.tsv`; `process.py` appends those rows, so areas, types, tags and listing_ids come from our own logic, and marks them `gm` (their Google Maps link). Pages: a `gm` stay shows "View on Google Maps" instead of our OpenStreetMap map, is never pinned on our maps, and stays off the landmark pages (Google's terms). Booking-site websites are matched by domain (`ellbeehotels.com` is not hotels.com). A booking-site homepage ("https://www.agoda.com/") never counts as a link. Google-sourced stays (`gm`) are excluded from directory matching in `push_places.mjs`, so re-runs keep them. How many are listed: `docs/HANDOFF.md`.
