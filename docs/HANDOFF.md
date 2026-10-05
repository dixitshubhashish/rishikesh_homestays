# Handoff — state of the stays/guide work (2026-10-03)

Read `CLAUDE.md` first (architecture, page rules), then this file, then `scripts/stays/README.md` for the pipelines. `PROGRESS.md` has the dated log; `.agents/coordination.md` is the multi-agent ledger (Codex also works here — claim files before editing).

## Goal

rishikeshhomestays.com is a Rishikesh/Haridwar travel guide whose job is to **sell the owner's own homestays** (Advaitam — luxury 3BHK, Nirmal Bagh, parking on site, 15% off stays of 5+ days; Elysium; Yoga Retreat at the Ganges) over third-party listings. Third-party stays are listed to attract search traffic and capture leads (lead popup → then one booking-site redirect, or WhatsApp).

## Live now (origin/main, Vercel)

- **2,819 stays**: Rishikesh 1,818, Haridwar 1,001 (directory crawl + 412 Google Maps places marked `gm`). **1,720 have a confirmed booking link** (Booking.com, MakeMyTrip, EaseMyTrip, OYO, Airbnb, Agoda, Trip.com…). Category pages list the linked stays directly and fold the rest behind "View all" (owner, 2026-10-04).
- Generated pages in `hotels/`: `best-<category>-in-<city>` (types, sizes, themes), landmark pages `best-stays-near-<landmark>`, **search-phrase pages** (rows of `scripts/stays/search-pages.tsv`: ~190 pages named after Google searches, e.g. `/hotels/cheap-hotels-in-rishikesh`, `/hotels/rooms-near-aiims-rishikesh`, `/hotels/hotels-near-patanjali-haridwar`, `/hotels/top-10-resorts-in-haridwar`; heading = the exact phrase). Every category/phrase page exists in both cities (thin ones list the nearest in the other city), the city switch always lands on its twin, all are in sitemap.xml, and `npm run check:stays` guards content (450+ words of guide text, unique titles/ledes, one ad slot after the lists), property page `stay?s=<slug>&c=<city>`. Every footer lists all of them per city (`footer_links.py`). Category links are grouped (Accommodation type / By size / Themes & facilities) and sorted by count.
- Hand-made pages: guides (about, places, things to do, Triveni Ghat, Kedarnath, Kumbh 2027, **Driving from Delhi**), **Bike & Taxi Rental** (Claude owns it; form → `/api/contact` with `source: 'rental_enquiry'`; verified live end to end on 2026-10-04 — test with the POST intercepted, never send real enquiries), contact, homestays, Advaitam page, list-your-homestay.
- Prices read "Starting ₹X onwards" everywhere.
- Stays pages layout: Rishikesh | Haridwar switch at the top (same category in the other city), category filters as a **left sidebar** (sticky; "Filter stays" button on phones), compact one-row footer (brand+social | Stay | Explore | Stays in Rishikesh | Stays in Haridwar). `/hotels/stay` without `?s=` and `/stays` redirect to the stays list; `hotels/stay.html` itself is the single property page and must stay.
- **Booking.com links = CJ affiliate deep links** from `assets/js/modules/affiliate-links.js` (PID 101895722, link 17323528). Never use `?aid=`.
- **AdSense** (`assets/js/ads.js`, `/ads.txt`): guides get side rails + mid-article + grid; homepage and stays lists get rails + grid; lead pages none; top of every page ad-free. Competitor ads allowed (owner's choice). Never intercept ad clicks (AdSense policy).
- **BigQuery** (project keen-device-610, dataset `rishikesh_homestays`): `market_properties` + view `stays_sheet` (directory, with `booking_link`, `bedrooms`, `agoda_url_unconfirmed`); `places_lodging` (Google Maps sweep: 4,947 places, 2,036 phones — **internal only, phones never on the site**).

## Owner to do (blocked on them)

1. CJ: get **Booking.com APAC to approve** the relationship (clicks only earn after that); send the "Get HTML" code of link 17323528 if a Booking.com search widget is wanted (place it **below** the homestay sections on the homepage).
2. AdSense: **site ownership verified (ads.txt) and review requested on 2026-10-04** — status "Getting ready"; wait for Google's approval email (days to ~2 weeks). After that: create a **vertical display unit** and put its slot in `UNITS.rail` in `assets/js/ads.js`.
3. **Google Search Console**: verify the domain (DNS TXT record), submit `https://rishikeshhomestays.com/sitemap.xml`, and check the Pages report weekly ("Discovered/Crawled, currently not indexed"); URL Inspection → Request indexing for the top pages (~10 a day). Then **Bing Webmaster Tools**: import from Search Console and submit the same sitemap (Bing also gets IndexNow pings automatically after every push). **Google Business Profile** for our homestays (Advaitam) if not claimed yet.
4. Optional: a search API key (Google Programmable Search or Brave) to find Goibibo/MakeMyTrip/Airbnb/Hotels.com links for the ~1,400 stays still without one.

## Finding booking links for the stays without one

`docs/booking-links/` has the lists, every stay in exactly one: `all.tsv` (still to sort; deleted once empty), `found.tsv` (verified links, one row per link; the first five columns are the `key / verified / Platform / url / title` format the merge scripts read) and `unfound.tsv` (statuses `retry`, `none`, `manual`, `duplicate`, `review`; see RULES.md §1) and `review.tsv` (the owner's checklist). Sorting a stay moves its row out of `all.tsv` (or its `retry` row) into `found.tsv` or `unfound.tsv`; nothing is rebuilt. `all.tsv` holds the directory stays without a link **and the Google Maps places new to us** (keys `g-<place_id>`, from the sweep already on disk: 3,079 added offline, same place-to-directory rule as `push_places.mjs`; no new Places API calls). Our own stays (`OWN`/`OWN_ALIASES` in `build_pages.py`) are never in any list.

`scripts/stays/google_ota_search.mjs` does the searching in the owner's real browsers (Opera ×2, Chrome, Edge; at most three browsers on this Mac), kept running by `scripts/stays/search_supervisor.mjs`; checks by hand go through `scripts/stays/record_manual.mjs`. The match rules (name, then the place: the page's own map pin or address), the search order, pace and manners, and the merge into the site are all in **`docs/booking-links/RULES.md`**, pinned by `tests/scripts/ota-match.test.js` and `tests/scripts/ota-evidence.test.js`. Captchas are never solved and blocks never worked around.

To merge into the site: directory stays: `python3 scripts/stays/postcheck_matches.py <out.tsv> docs/booking-links/found.tsv`, then `merge_ota.py <out.tsv>`, rebuild both cities and `push_bigquery.mjs`. Google places (`g-` keys) go to `scripts/stays/.cache/places/ota-links.tsv` instead, then `push_places.mjs` → `import_google_stays.py` (see the stays README, "Google Maps places on the site"). Booking.com rows get the CJ link automatically.

**History (2026-10-04):** Antigravity ran first (batches `ag1`–`ag8`): its scripted searches mixed up stays (one "Hotel Crystal Ganga Heights" page was given to five stays). Its results were merged with the name rule: 40 links kept, 18 rejected (those stays are `retry`), and its "not found" list is `retry` too.

**Resumed 2026-10-04 18:28** with 2–4 workers (Edge, Opera, Brave, headless Firefox; Bing + Brave Search only), possessive "'s" fixed, search tab swapped for a fresh one every 15 stays (one reused Bing tab grew to 3 GB and pushed swap past 10 GB), memory watchdog stopping workers (never Opera). **Merged at ~19:35:** a snapshot of `found.tsv` (424 rows) went through `postcheck_matches.py` (7 dropped: page already another listing's) into `ota-links.tsv` (297 directory stays) and `.cache/places/ota-links.tsv` (120 places) → `push_places.mjs` → `import_google_stays.py` → `process.py` + `build_pages.py` (both cities) → `push_bigquery.mjs`. Later finds need the same steps; `merge_ota.py` and the places append skip keys already merged.

**Earlier pause, 2026-10-04 17:50 (quick pass about a third done):** found 274 stays (MakeMyTrip 104, Booking.com 68, Agoda 49, Trip.com 22, Goibibo 18, EaseMyTrip 9, Trivago 4), unfound 1,193 (1,010 `retry`, 155 `none`, 28 `manual`), `all.tsv` 3,006 still to sort (2,323 Google places, 683 directory stays). Not merged into the site yet. The run stopped because all six browsers froze together at 16:03 (most likely memory: 4.6 GB swap in use), then the four attached browsers closed at 16:24; the stays the workers skipped afterwards were never written, so they are still in `all.tsv`. Worker logs and the pre-merge backups are in `scripts/stays/.cache/booking-search-2026-10-04/` (gitignored). For the restart: run fewer workers (about 4); Bing gave a match on ~1 in 5 searches, Brave Search ~1 in 25, and Google showed a captcha at once. Before restarting, fix the possessive "'s" in `ota-match.mjs`, which is read as its own word ("Sushma's Homestay" was rejected against "Sushma homestay", 3 cases).

## Ideas not started

- **Bigger sitemap (owner, 2026-10-04, later task):** every stay should be in `sitemap.xml` with its own URL (today only the category/landmark pages are listed; `hotels/stay.html?s=<slug>&c=<city>` is `noindex`), and the sitemap should grow to cover every part of the site. Needs a decision on indexable per-stay URLs first.

- Elysium and Yoga Retreat dedicated pages (need owner details/photos).
- Haridwar size pages (too few stays state a size).
- More landmark/area pages; AIIMS long-stay page.

## How to run things (all offline-safe unless noted)

```bash
npm run dev                      # http://localhost:3000
npm test                         # 413 tests; the visual overflow test needs `npx playwright install chromium` once
python3 scripts/stays/process.py && python3 scripts/stays/process.py --city haridwar
python3 scripts/stays/build_pages.py --city haridwar && python3 scripts/stays/build_pages.py   # rebuild all generated pages
node scripts/stays/push_bigquery.mjs     # directory → BigQuery (+ rebuilds stays_sheet view)
node scripts/stays/push_places.mjs       # Google Maps places → BigQuery (internal)
```

Google Maps API calls cost money (`places_sweep.mjs`): the sweep was done **once by owner's decision — no monthly refresh**. Don't re-run phases without asking.

## Rules learned the hard way

- Never hand-edit generated files (`hotels/best-*`, `hotels/stay.html`, `assets/js/modules/stays-index-data*.js`); change `scripts/stays/build_pages.py` and rebuild.
- Copy rules: friendly local-guide voice; no dates, no data sources, never "official"/"independent"; own stays first; lead before any booking-site redirect; no copied third-party photos.
- Booking matches must be browser-verified with the shared rule in `scripts/stays/booking-match.mjs`, then `postcheck_matches.py` (no page shared by differently named stays, same city). Booking-site **homepages** are never links; match websites by **domain**.
- Respect site blocks: Agoda/Goibibo block automation — don't evade (no proxies, no bot-check tricks). Booking 429 → back off.
- Google Places data: `gm` stays show "View on Google Maps", never pinned on our OpenStreetMap maps, not on landmark pages; no Google addresses shown.
- Subagents often mistype the path (`rishikesh_homestays` vs scratchpad `-rishikesh-homestays`): give them a ready-made run script and check with `pgrep` that each batch runs. Heavy parallel browsers make the visual test time out — run `npm test` after batches.
- Commit only on request; never commit `.env`, `credentials/`, the GA opt-out phrase.
