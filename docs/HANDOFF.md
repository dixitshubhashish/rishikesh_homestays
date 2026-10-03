# Handoff — state of the stays/guide work (2026-10-03)

Read `CLAUDE.md` first (architecture, page rules), then this file, then `scripts/stays/README.md` for the pipelines. `PROGRESS.md` has the dated log; `.agents/coordination.md` is the multi-agent ledger (Codex also works here — claim files before editing).

## Goal

rishikeshhomestays.com is a Rishikesh/Haridwar travel guide whose job is to **sell the owner's own homestays** (Advaitam — luxury 3BHK, Nirmal Bagh, parking on site, 15% off stays of 5+ days; Elysium; Yoga Retreat at the Ganges) over third-party listings. Third-party stays are listed to attract search traffic and capture leads (lead popup → then one booking-site redirect, or WhatsApp).

## Live now (origin/main, Vercel)

- **2,701 stays**: Rishikesh 1,743, Haridwar 958 (directory crawl + 287 Google Maps places marked `gm`). **1,305 have a confirmed booking link** (Booking.com, EaseMyTrip, OYO, Airbnb, Agoda, MakeMyTrip…).
- Generated pages in `hotels/`: `best-<category>-in-<city>` (types, sizes, themes), landmark pages `best-stays-near-<landmark>`, property page `stay?s=<slug>&c=<city>`. Category links are grouped (Accommodation type / By size / Themes & facilities) and sorted by count.
- Hand-made pages: guides (about, places, things to do, Triveni Ghat, Kedarnath, Kumbh 2027, **Driving from Delhi**), **Bike & Taxi Rental** (Claude owns it; form → `/api/contact` with `source: 'rental_enquiry'`; verified live end to end on 2026-10-04 — test with the POST intercepted, never send real enquiries), contact, homestays, Advaitam page, list-your-homestay.
- Prices read "Starting ₹X onwards" everywhere.
- **Booking.com links = CJ affiliate deep links** from `assets/js/modules/affiliate-links.js` (PID 101895722, link 17323528). Never use `?aid=`.
- **AdSense** (`assets/js/ads.js`, `/ads.txt`): guides get side rails + mid-article + grid; homepage and stays lists get rails + grid; lead pages none; top of every page ad-free. Competitor ads allowed (owner's choice). Never intercept ad clicks (AdSense policy).
- **BigQuery** (project keen-device-610, dataset `rishikesh_homestays`): `market_properties` + view `stays_sheet` (directory, with `booking_link`, `bedrooms`, `agoda_url_unconfirmed`); `places_lodging` (Google Maps sweep: 4,947 places, 2,036 phones — **internal only, phones never on the site**).

## Owner to do (blocked on them)

1. CJ: get **Booking.com APAC to approve** the relationship (clicks only earn after that); send the "Get HTML" code of link 17323528 if a Booking.com search widget is wanted (place it **below** the homestay sections on the homepage).
2. AdSense: **site ownership verified (ads.txt) and review requested on 2026-10-04** — status "Getting ready"; wait for Google's approval email (days to ~2 weeks). After that: create a **vertical display unit** and put its slot in `UNITS.rail` in `assets/js/ads.js`.
3. Optional: a search API key (Google Programmable Search or Brave) to find Goibibo/MakeMyTrip/Airbnb/Hotels.com links for the ~1,400 stays still without one.

## Antigravity helping with booking links

`docs/antigravity/PROMPT.md` is a ready prompt for Antigravity to find booking pages for the 1,396 stays in `docs/antigravity/no-link-stays.tsv` (best first) via Google + its browser. It writes `docs/antigravity/results-*.tsv` in our `key / verified|none / Platform / url / title` format. To merge: `python3 scripts/stays/postcheck_matches.py <out.tsv> docs/antigravity/results-*.tsv`, re-check Booking.com/EaseMyTrip/Agoda rows with `scripts/stays/verify_platform.mjs` where possible, then `merge_ota.py <out.tsv>`, rebuild both cities and `push_bigquery.mjs`. Booking.com rows get the CJ link automatically.

## Ideas not started

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
