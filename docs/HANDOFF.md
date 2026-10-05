# Handoff: start here (state on 2026-10-05)

Read `CLAUDE.md` first (rules, where things live), then this file. Then, as needed: `docs/ARCHITECTURE.md` (modules, API), `scripts/stays/README.md` (stays pipeline), `docs/booking-links/RULES.md` (booking-link search), `docs/TESTING.md`. `PROGRESS.md` is the dated log; `.agents/coordination.md` is the multi-agent ledger (Codex also works here: claim files before editing).

This file is the one home for live numbers and owner to-dos. Other docs point here instead of repeating them.

## Goal

rishikeshhomestays.com is a Rishikesh/Haridwar travel guide whose job is to **sell the owner's own homestays** over third-party listings: Advaitam (luxury 3BHK in Nirmal Bagh, parking on site, 15% off stays of 5+ days), Elysium, and Yoga Retreat at the Ganges. Third-party stays are listed to attract search traffic and capture leads (lead popup, then one booking-site redirect, or WhatsApp).

## Live now (origin/main, Vercel)

- **Stays on the site**: Rishikesh 1,814 and Haridwar 1,001 in the built data modules, plus our 3 pinned in both (registry `listing-ids.tsv`: 2,819 active). 405 of them are Google Maps places (`gm`: Rishikesh 210, Haridwar 195). **1,713 have a confirmed booking link** (Rishikesh 1,124, Haridwar 589; Booking.com, MakeMyTrip, EaseMyTrip, OYO, Airbnb, Agoda, Trip.com…). Recount with the snippet in "How to run things".
- **Generated pages in `hotels/`** (about 255): 33 `best-<category>-in-<city>` per city, 20 landmark pages `best-stays-near-<landmark>`, about 170 search-phrase pages (from `scripts/stays/search-pages.tsv`, e.g. `/hotels/cheap-hotels-in-rishikesh`, `/hotels/rooms-near-aiims-rishikesh`, `/hotels/top-10-resorts-in-haridwar`; heading = the exact phrase), and `stay.html`. Every category/phrase page exists in both cities (thin ones list the nearest stays in the other city) and the city switch always lands on its twin. All are in `sitemap.xml`; `npm run check:stays` guards the content. Category pages list the linked stays directly and fold the rest behind "View all" (owner, 2026-10-04).
- **Stays page layout**: Rishikesh | Haridwar switch at the top (same page in the other city), category filters in a sticky **left sidebar** ("Filter stays" button on phones), compact one-row footer (brand+social | Stay | Explore | Stays in Rishikesh | Stays in Haridwar). `/hotels/stay` without `?s=` and `/stays` redirect to the stays list; `hotels/stay.html` itself is the single property page and must stay.
- **Hand-made pages**: guides (about, places, things to do, Triveni Ghat, Kedarnath, Kumbh 2027, Driving from Delhi), Bike & Taxi Rental (Claude owns it; verified live end to end 2026-10-04), contact, homestays, Advaitam page, list-your-homestay.
- **Prices** read "Starting ₹X onwards" everywhere.
- **Money**: Booking.com links are CJ affiliate deep links (`affiliate-links.js`). AdSense on guides, home and stays lists, none on lead pages (plan in `docs/ARCHITECTURE.md`). Competitor ads are allowed (owner's choice).
- **BigQuery** (project `keen-device-610`, dataset `rishikesh_homestays`): `enquiries`; `market_properties` + view `stays_sheet` (directory, with `booking_link`, `bedrooms`, `agoda_url_unconfirmed`); `places_lodging` (Google Maps sweep: 4,947 places, 2,036 phones; **internal only, phones never on the site**).

## Owner to do (blocked on them)

1. CJ: get **Booking.com APAC to approve** us (clicks only earn after that). Send the "Get HTML" code of link 17323528 if a Booking.com search widget is wanted (it goes **below** the homestay sections on the homepage).
2. AdSense: site verified (ads.txt) and review requested on 2026-10-04, status "Getting ready"; approval takes days to ~2 weeks. After approval, create a **vertical display unit** and put its slot in `UNITS.rail` in `assets/js/ads.js`.
3. **Google Search Console**: verify the domain (DNS TXT), submit `https://rishikeshhomestays.com/sitemap.xml`, check the Pages report weekly ("Discovered/Crawled, currently not indexed"), and Request indexing for top pages (~10 a day). Then **Bing Webmaster Tools**: import from Search Console, submit the same sitemap (Bing also gets IndexNow pings after every push). **Google Business Profile** for Advaitam if not claimed.
4. Review `docs/booking-links/review.tsv` (218 doubtful booking pages only the owner can settle).

## Booking links for stays without one

The search, its lists and its rules are in **`docs/booking-links/RULES.md`**. State on 2026-10-05: every stay has been searched at least once and `all.tsv` was deleted (never recreate it). `found.tsv` has 1,350 confirmed pages (one row per link), `unfound.tsv` 3,124 rows (`retry` 2,624, `review` 201, `none` 181, `duplicate` 85, `manual` 33), `review.tsv` the owner's checklist. Workers still run deep re-checks of `retry` rows under `search_supervisor.mjs`.

**Found links are not on the site until merged.** The last merge was 2026-10-04 (~19:35; `ota-links.tsv` now has 1,727 verified). To merge: directory stays: `python3 scripts/stays/postcheck_matches.py <out.tsv> docs/booking-links/found.tsv`, then `merge_ota.py <out.tsv>`; Google places (`g-` keys) go to `scripts/stays/.cache/places/ota-links.tsv` instead, then `push_places.mjs` → `import_google_stays.py`. Then `process.py`, `npm run build:stays`, `push_bigquery.mjs`, commit and push. `merge_ota.py` and the places append skip keys already merged; Booking.com rows get the CJ link automatically.

Lessons from the runs (2026-10-04):
- Antigravity's scripted batches (`ag1`–`ag8`) mixed stays up (one "Hotel Crystal Ganga Heights" page given to five stays). Re-checked with the name rule: 40 links kept, 18 rejected.
- Memory is the limit on this Mac: all six browsers froze together (4.6 GB swap), and one reused Bing tab grew to 3 GB, so the search tab is swapped for a fresh one every 15 stays and never more than three browsers run. A memory watchdog never stops Opera.
- `postcheck_matches.py` dropped 7 of 424 rows in the first merge (page already another listing's).
- Worker logs and pre-merge backups: `scripts/stays/.cache/booking-search-*/` (gitignored).

## Ideas not started

- **Bigger sitemap** (owner, 2026-10-04): every stay with its own indexable URL (today `hotels/stay.html?s=<slug>&c=<city>` is `noindex`), and the sitemap covering every part of the site. Needs a decision on per-stay URLs first.
- Elysium and Yoga Retreat pages (need owner details and photos).
- Haridwar size pages (too few stays state a size).
- More landmark/area pages; an AIIMS long-stay page.

## How to run things (offline-safe unless noted)

```bash
npm run dev                      # http://localhost:3000
npm test                         # see docs/TESTING.md (visual test needs `npx playwright install chromium` once)
python3 scripts/stays/process.py && python3 scripts/stays/process.py --city haridwar
npm run build:stays              # rebuild every generated page (Haridwar, then Rishikesh)
npm run check:stays              # content check of the stays pages
node scripts/stays/push_bigquery.mjs     # directory → BigQuery (+ stays_sheet view)   [network]
node scripts/stays/push_places.mjs       # Google Maps places → BigQuery (internal)    [network]
node -e 'for (const f of ["stays-index-data.js","stays-index-data-haridwar.js"]) import("./assets/js/modules/"+f).then(m=>{const s=m.STAYS_INDEX;console.log(f,s.length,"linked",s.filter(x=>x.o).length,"gm",s.filter(x=>x.gm).length)})'   # live counts
```

Google Places API calls cost money (`places_sweep.mjs`): the sweep was done **once, by the owner's decision; no monthly refresh**. Don't run any phase without the owner's OK. BigQuery reads and writes are always fine.

## Rules learned the hard way

- Never hand-edit generated files (`hotels/best-*`, the search-phrase and landmark pages, `hotels/stay.html`, `assets/js/modules/stays-index-data*.js`); change `scripts/stays/` and rebuild.
- Copy rules: friendly local-guide voice; no dates, no data sources, never "official"/"independent"; own stays first; lead before any booking-site redirect; no copied third-party photos.
- **Image credits**: never publish them and don't keep them in the repo (owner, 2026-10-05; the owner handles image licensing). No `CREDITS.md` files, credit lines or credit comments.
- Booking matches follow `docs/booking-links/RULES.md` (`ota-match.mjs` name rule, `ota-evidence.mjs` place evidence), then `postcheck_matches.py` (no page shared by differently named stays, same city). Booking-site **homepages** are never links; websites are matched by **domain**.
- Respect site blocks: MakeMyTrip and Goibibo refuse automated browsers; never evade (no proxies, VPNs or bot-check tricks); Booking.com 429 → back off.
- Never intercept ad clicks (AdSense policy).
- Google Places data: `gm` stays show "View on Google Maps", are never pinned on our OpenStreetMap maps, stay off landmark pages, and show no Google address.
- Subagents often mistype the path (`rishikesh_homestays` vs the scratchpad's `-rishikesh-homestays`): give them a ready-made run script and check with `pgrep` that each batch runs. Run `npm test` after heavy browser batches, not during.
- Commit only on request; never commit `.env`, `credentials/` or the GA opt-out phrase.
