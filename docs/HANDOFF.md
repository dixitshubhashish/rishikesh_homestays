# Handoff: start here (state on 2026-10-06)

Read `CLAUDE.md` first (rules, where things live), then this file. Then, as needed: `docs/ARCHITECTURE.md` (modules, API), `scripts/stays/README.md` (stays pipeline), `docs/booking-links/RULES.md` (booking-link search), `docs/TESTING.md`. `PROGRESS.md` is the dated log; `.agents/coordination.md` is the multi-agent ledger (Codex also works here: claim files before editing).

This file is the one home for live numbers and owner to-dos. Other docs point here instead of repeating them.

## Session 2026-10-06: what landed and what's open

Pushed first (`22b86b8`): the dark/light theme merge and libphonenumber on `list-your-homestay`. Then, in the next commit:
- **Languages, every section** (all in `docs/I18N.md`): one flat catalogue per language keyed by a 64-bit SHA-256 id (`i18n/<lang>.json`), one English file (`i18n/en.json`), two browser files per language (`i18n/dist/`), house styles in `i18n/STYLE.md`. The generated stays pages translate through ~1,750 sentence templates + ~530 names; text written by scripts is found in the browser too (`extract-rendered.mjs`). Hero slider, stay page (map key, directions, city notes, facilities), stays lists, `/homestays` cards: all translated in 22 languages. Never translated: the brand name and logo, contact forms, proper nouns in stay names (their generic words, Hotel/Guest House/Lodge…, are). Hindi uses मोहल्ला for area. `npm test` fails while a language lacks a site text.
- **Header**: small language pill (globe + code), site search button, theme, menu; one row at every width 320–1440 px in every language (`nav-fit.js` shrinks the desktop nav when labels run long).
- **Site search** (fuzzy, ~70% word similarity, typo-tolerant): `assets/js/modules/site-search.js`, index `assets/search/index.json` (`npm run build:search`, run by `build:stays`). Details in `docs/ARCHITECTURE.md`.
- **WhatsApp form link** for Instagram and social posts: `https://rishikeshhomestays.com/whatsapp` (keeps `?utm_…`).
- **Booking links merged**: 1,155 new (`scripts/stays/merge_found.sh`, re-runnable): 2,857 stays linked (Rishikesh 1,888, Haridwar 969); BigQuery reloaded.
- **Stays pages**: "Book direct with us" perks (5+ days save 15%, no booking-site fees, WhatsApp reply); meta descriptions end at a sentence or word (were cut mid-word).
- **Fixes**: hero height no longer jumps between slides; hero buttons equal height; `/homestays` lists our 3 stays only (sample cards removed, Elysium added); homepage in-feed ad in the middle of the guide cards' second row.
- **Booking search**: running (`search_supervisor.mjs`, 5 workers). Deep search order now follows what finds pages (the MakeMyTrip/EaseMyTrip/Trip.com OR search second; Goibibo/Expedia/Cleartrip, which found almost nothing, dropped by the 6-search cap). The supervisor also closes booking pages left open by stopped workers (every 5 min).

Open:
- Owner to confirm: the Kedarnath Rishikesh→Sonprayag km (page says 120–125; others say ~210), and Janki Setu = Janki Pul listed twice in `places-to-visit`.
- English copy flagged by translators: Yoga Retreat card "Quiet private rooms with mountain near AIIMS" (missing word: "mountain views"?) in `assets/js/modules/data.js`; "Cots" (baby cots or extra beds?).
- Machine-made translations of the stays templates were spot-checked by the agents, not read in full by native speakers.
- The four known bugs from the last handoff are fixed or no longer reproduce (the `stay.html` cross-city links looked styled when checked on 2026-10-06).
- Booking search: sort the duplicates at the end, then rename `unfound` once every case is sorted; merge again with `scripts/stays/merge_found.sh` when `found.tsv` has grown.

## Goal

rishikeshhomestays.com is a Rishikesh/Haridwar travel guide whose job is to **sell the owner's own homestays** over third-party listings: Advaitam (luxury 3BHK in Nirmal Bagh, parking on site, 15% off stays of 5+ days), Elysium, and Yoga Retreat at the Ganges. Third-party stays are listed to attract search traffic and capture leads (lead popup, then one booking-site redirect, or WhatsApp).

## Live now (origin/main, Vercel)

- **Stays on the site**: Rishikesh 2,172 and Haridwar 1,151 in the built data modules, plus our 3 pinned in both (registry `listing-ids.tsv`: 2,819 active). 913 of them are Google Maps places (`gm`: Rishikesh 568, Haridwar 345). **2,857 have a confirmed booking link** (Rishikesh 1,888, Haridwar 969; Booking.com, MakeMyTrip, EaseMyTrip, OYO, Airbnb, Agoda, Trip.com…). Recount with the snippet in "How to run things".
- **Generated pages in `hotels/`** (about 255): 33 `best-<category>-in-<city>` per city, 20 landmark pages `best-stays-near-<landmark>`, about 170 search-phrase pages (from `scripts/stays/search-pages.tsv`, e.g. `/hotels/cheap-hotels-in-rishikesh`, `/hotels/rooms-near-aiims-rishikesh`, `/hotels/top-10-resorts-in-haridwar`; heading = the exact phrase), and `stay.html`. Every category/phrase page exists in both cities (thin ones list the nearest stays in the other city) and the city switch always lands on its twin. All are in `sitemap.xml`; `npm run check:stays` guards the content. Category pages list the linked stays directly and fold the rest behind "View all" (owner, 2026-10-04).
- **Stays page layout**: Rishikesh | Haridwar switch at the top (same page in the other city), category filters in a sticky **left sidebar** ("Filter stays" button on phones), compact one-row footer (brand+social | Stay | Explore | Stays in Rishikesh | Stays in Haridwar). `/hotels/stay` without `?s=` and `/stays` redirect to the stays list; `hotels/stay.html` itself is the single property page and must stay.
- **Hand-made pages**: guides (about, places, things to do, Triveni Ghat, Kedarnath, Kumbh 2027, Driving from Delhi), Bike & Taxi Rental (Claude owns it; verified live end to end 2026-10-04) plus 15 generated per-city driving guides (Delhi NCR cities to Rishikesh and Haridwar, `scripts/drives/build-pages.mjs`, 2026-10-06; owner to spot-check the rounded distances and the way-out-of-city text) plus six generated rental pages (bike / car / taxi × Rishikesh / Haridwar, `scripts/rentals/build-pages.mjs`, added 2026-10-06; owner to confirm bike and car availability in Haridwar, the copy only says "on request" and "trusted local partners"), contact, homestays, Advaitam page, list-your-homestay.
- **Prices** read "Starting ₹X onwards" everywhere.
- **Money**: Booking.com links are CJ affiliate deep links (`affiliate-links.js`). AdSense on guides, home and stays lists, none on lead pages (plan in `docs/ARCHITECTURE.md`). Competitor ads are allowed (owner's choice).
- **BigQuery** (project `keen-device-610`, dataset `rishikesh_homestays`): `enquiries`; `market_properties` + view `stays_sheet` (directory, with `booking_link`, `bedrooms`, `agoda_url_unconfirmed`); `places_lodging` (Google Maps sweep: 4,947 places, 2,036 phones; **internal only, phones never on the site**).

## Owner to do (blocked on them)

1. CJ: get **Booking.com APAC to approve** us (clicks only earn after that). Send the "Get HTML" code of link 17323528 if a Booking.com search widget is wanted (it goes **below** the homestay sections on the homepage).
2. AdSense: site verified (ads.txt) and review requested on 2026-10-04, status "Getting ready"; approval takes days to ~2 weeks. After approval, create a **vertical display unit** and put its slot in `UNITS.rail` in `assets/js/ads.js`.
3. **Google Search Console**: verify the domain (DNS TXT), submit `https://rishikeshhomestays.com/sitemap.xml`, check the Pages report weekly ("Discovered/Crawled, currently not indexed"), and Request indexing for top pages (~10 a day). Then **Bing Webmaster Tools**: import from Search Console, submit the same sitemap (Bing also gets IndexNow pings after every push). **Google Business Profile** for Advaitam if not claimed.
4. Review `docs/booking-links/review.tsv` (218 doubtful booking pages only the owner can settle).

## Booking links for stays without one

**Windows laptop and Mac (owner, 2026-10-06):** the search can run on either machine with the same `npm run search:browsers | search:start | search:status | search:stop` commands (`scripts/search-ctl.mjs` chooses paths and process handling from the OS). Browsers, approvals and the move-over steps are in `docs/booking-links/RULES.md` section 5 (the full start is not yet run on real Windows: do its first-run check). One machine at a time. Python runs through `node scripts/py.mjs` (npm scripts) or auto-detection (`merge_found.sh`), so no `PYTHON` export is needed.

The search, its lists and its rules are in **`docs/booking-links/RULES.md`**. State on 2026-10-05: every stay has been searched at least once and `all.tsv` was deleted (never recreate it). `found.tsv` has 1,350 confirmed pages (one row per link), `unfound.tsv` 3,124 rows (`retry` 2,624, `review` 201, `none` 181, `duplicate` 85, `manual` 33), `review.tsv` the owner's checklist. Workers still run deep re-checks of `retry` rows under `search_supervisor.mjs`.

**Found links are not on the site until merged.** The last merge was 2026-10-06 (evening: 167 new rows, 37 of them new pages for the site, the rest "page already belongs to" a stay we already link; 3,230 stays linked: 1,090 directory + 2,140 Google Maps places; BigQuery not loaded; `npm test` 1,065/1,065; committed and pushed as `469055a`). The earlier merge was 2026-10-06 ~10:15 (1,155 new). The step-by-step merge and push, and the Windows hand-over, are in `docs/booking-links/RULES.md` §4 and §5. To merge again: `scripts/stays/merge_found.sh --dry`, then `scripts/stays/merge_found.sh` (snapshot of `found.tsv`, stays already linked keep their link, postcheck, directory → `merge_ota.py`, Google places → `.cache/places/ota-links.tsv` → `push_places.mjs` → `import_google_stays.py`, then `process.py`, `npm run build:stays`, `check:stays`), then `node scripts/stays/push_bigquery.mjs`, `npm test`, commit and push. Booking.com rows get the CJ link automatically.

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
