# Stays pages pipeline (`best-*-in-rishikesh`)

Builds the market-index pages (`best-hotels-in-rishikesh.html` and its sibling
category pages) from the public Rishikesh listings on uttarakhand-hotels.com.

## Steps

| Step | Command | Output |
|---|---|---|
| 1. Crawl | `python3 scripts/stays/crawl.py [--fresh]` | `.cache/props.jsonl` (raw, one record per property, not committed) |
| 2. Clean | `python3 scripts/stays/process.py [--names]` | `.cache/stays.json` |
| 3. Build | `python3 scripts/stays/build_pages.py` | `best-*-in-rishikesh.html` + `assets/js/modules/stays-index-data.js` |
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

There is no ranking. Each visit shuffles the list into a fresh random order
(the Stars / Area / Type views only group it). Our own properties (`OWN` in
`build_pages.py`: Advaitam, Elysium, and "Yoga Retreat at the Ganges",
matched by exact source URL so no other yoga retreat is caught) are taken out
of the shuffled data and pinned in an "Our homestays · Book direct" block on
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
verified row). `BOOKING_AID` in `build_pages.py` appends the Booking.com
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
