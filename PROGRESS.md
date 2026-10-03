# Progress Tracker

## Deployed 404 Choti And Two-Line Offer (Codex, 2026-10-03)

- Isolated release `7c6c4d7` pushed to `origin/main`; production now serves all three corrected, cache-versioned WebPs and the Advaitam offer heading `Stay 5+ days` / `and save 15%`.
- Targeted artwork/navigation tests: 17/17 pass against isolated release. Production Chromium verified 11 CSS widths (320-3440px), /404.html, and root/nested nonexistent paths (real 404 responses). Live laptop screenshot inspected with visible ponytail.
- Shared checkout was not pulled/rebased because another agent has active staged and unstaged work. Release checkout: `/tmp/rishikesh-choti-release`. Earlier deployment-pending notes below are superseded.

## ✅ Built — CJ affiliate links, Google stays on the site, new pages (Claude, 2026-10-03, night)

- **Booking.com commission:** every Booking.com link is now our CJ deep link (PID 101895722, link 17323528), from one constants file `assets/js/modules/affiliate-links.js`; it lands on the same property page (tested). The old `?aid=7854081` was Booking.com APAC's CJ advertiser ID and credited nobody. Owner: get Booking.com APAC to approve the CJ relationship.
- **287 Google Maps stays listed** (new to us, confirmed booking link, real property page): "View on Google Maps", no map pins, off landmark pages. Totals: 2,701 stays (Rishikesh 1,743, Haridwar 958), 1,305 with a booking link. Fixes on the way: booking-site websites matched by domain (57 false "Hotels.com"-style matches), booking-site homepages rejected (26).
- **New pages:** Bike & Taxi Rental (`rental_enquiry` form), Driving from Delhi guide, Studio/1 BHK, 2 BHK, 3 BHK & bigger stays; category links grouped (type / size / themes) and sorted by count; Advaitam offer "15% off stays of 5+ days" everywhere.
- **AdSense:** competitor ads allowed (owner's call); ad clicks are never intercepted (AdSense policy).

## ✅ Built — Google Maps phones + links, ads per page type (Claude, 2026-10-03, evening)

- **Google Maps (BigQuery `places_lodging`, internal):** 4,947 places; 2,036 phone numbers (Rishikesh 1,193, Haridwar 843) from 4,125 Enterprise lookups (≈$63, owner approved); 1,287 places with a booking link (directory match, browser-verified sitemap/slug match, or the owner's own booking-site website, e.g. 236 OYO pages).
- **Booking.com slug guessing for Google places:** stopped at 2,193 of 4,061 tried (12 found, low yield: Google names are generic). Resume any time: `STAYS_FILE=scripts/stays/.cache/places/unlinked-stays.json node scripts/stays/guess_booking_slugs.mjs --shard i/10 --workers 2 --out scripts/stays/.cache/places/guess-i.tsv` (skips stays already in `guess-i.tsv(.tried)`), then the postcheck + `push_places.mjs` steps in `scripts/stays/README.md`.
- **Ads (`assets/js/ads.js`):** per page type — guides: side rails + mid-article + grid; homepage and stays lists: rails + grid; lead/booking pages: none. Top of every page ad-free (rails only ≥1580px, after the first screen, hidden over the footer). Owner to do in AdSense: verify (meta tag), create a vertical display unit for the rails, block Travel/Hotels categories and OTA URLs.
- **Next:** bedroom/BHK capacity field + "2 BHK / 3 BHK / villas for groups" pages; Delhi–Dehradun expressway page; Elysium and Yoga Retreat own pages; a search API key (Google Programmable Search or Brave) to reach Goibibo/MakeMyTrip/Airbnb links; Agoda only via a non-automated route (it answers 502 to automated browsers).

## ✅ Built — booking links ×2, Google Maps sweep, AdSense, "Starting ₹X onwards" (Claude, 2026-10-03)

- **Booking links:** 1,018 of 2,414 stays verified (Rishikesh 744, Haridwar 274): 938 Booking.com (aid 7854081), 70 EaseMyTrip, 10 MakeMyTrip/Agoda/Airbnb. Sources: Booking's public sitemaps (1,580 name candidates), Booking slug guessing for every unlinked stay (both cities), EaseMyTrip's sitemap (197,897 hotels). Every match is browser-checked by one shared rule (`scripts/stays/booking-match.mjs`: title names the stay, same town, no extra distinctive words, same BHK), then `postcheck_matches.py` drops pages claimed by differently named stays or other cities. Agoda answers 502 to automated browsers; Goibibo/MakeMyTrip sitemaps are bot-gated; Airbnb's list has no names — those need a search API.
- **Google Maps (Places API (New), project keen-device-610, service account):** `places_sweep.mjs` found 4,947 lodging places within 20 km of Rishikesh (3,131) and Haridwar (1,816); 1,199 directory stays matched, 3,395 are new to us. `push_places.mjs` → BigQuery `places_lodging` (internal only; phones never on the site). Phones are fetched only for places worth contacting, after the owner approves the cost.
- **AdSense:** `assets/js/ads.js` + `/ads.txt`; display + Multiplex units on the six guide pages only (never on pages that sell stays, localhost or the owner's opted-out browsers).
- **Copy:** all prices read "Starting ₹X onwards"; footer stays division moved to the top of the footer.
- `npm test` 382/382.

## ✅ Built — Haridwar + multi-city stays, pages moved into hotels/ (Claude, 2026-10-04)

- **Landmark pages (14):** `hotels/best-stays-near-<landmark>` for Triveni Ghat, Laxman Jhula, Ram Jhula, Parmarth Niketan, Beatles Ashram, Janki Setu, AIIMS, the railway station and ISBT (Rishikesh), and Har Ki Pauri, Haridwar station, Mansa Devi, Chandi Devi and Daksh Mahadev (Haridwar). Stays are listed by real distance with a map, FAQs and JSON-LD; our homestays always appear as "a calmer base" with honest distance and drive time (and are listed as genuinely close near AIIMS). Coordinates are verified from OSM/web in `scripts/stays/landmarks.tsv`. `npm test` 382/382.
- **Haridwar:** crawled all 828 listings (0 errors), giving 806 unique stays (listing_id 1,609–2,414) across 12 Haridwar areas (Har Ki Pauri, Upper Road & Mayapur, Kankhal, Bhupatwala, Shantikunj & Saptrishi, Railway Station, Jwalapur, …) and 26 category pages, including a new **Dharamshalas** category, plus a Kumbh 2027 section and FAQ on every Haridwar page.
- **City factor everywhere** (Rishikesh is the default): `scripts/stays/cities.py`; `--city` on crawl/process/build; one data module per city; `/hotels/stay?s=<slug>&c=<city>`; a city switcher on every stays page; per-city `sitemap.xml` / `llms.txt` sections; BigQuery `market_properties` + `stays_sheet` now carry `city` (2,414 rows).
- **Moved into `hotels/`** (owner's request, one folder instead of two): `/hotels/best-<category>-in-<city>`. Old root URLs 301 in vercel.json, `_redirects` and server.js; `/hotels/stay` with no stay → the city's stays page.
- **Kumbh:** a "Where should you stay for the Kumbh 2027?" section on the Kumbh guide, linking Haridwar stays, dharamshalas, budget/family pages and Rishikesh plus Advaitam; sidebar links; llms.txt updated.
- **Footer:** a new "Stays in Rishikesh / Stays in Haridwar" division on every page. Property pages got a sticky sidebar (our homestays, "Why plan with us", more stays) and a proper "This stay has checked out" page.
- **Booking links:** 432 verified for Rishikesh. Haridwar has 0 so far; 705 Haridwar plus 875 Rishikesh candidates from Booking.com's public sitemaps wait for a browser check (Booking.com is bot-checking automation, so a background agent retries gently).
- `npm test` 354/354. All 54 stays pages are in the sitemap.

## 404 Choti Corrected Locally (Codex, 2026-10-03)

- Added natural ponytails directly to standard and wide artwork using built-in imagegen. Prompt: change only the guide's hair to match the approved mobile portrait, keeping the landscape scene and characters intact.
- Saved optimized `rishikesh-wrong-turn-choti.webp`, `rishikesh-wrong-turn-wide-choti.webp`, and the approved `rishikesh-wrong-turn-mobile-choti.webp` in `assets/images/404/`; `404.html` now references these cache-versioned sources.
- Added `tests/integration/404-artwork.test.js`: all three corrected sources must exist as valid WebPs, with no SVG hair overlay. Passes.
- Local Chromium: decoded corrected artwork with no horizontal overflow at 320, 390, 760, 761, 768, 1024, 1280, 1366, 1440, 1920 and 3440px. Screenshots in `/tmp/choti-<width>.png`; visually inspected representative phone/tablet/MacBook/desktop views. `/404.html` resolves; root/nested missing routes return 404 with corrected artwork.
- Live deployment remains pending. Navigation suite has unrelated failures for `/stays/best-*` links; did not change those files.

Self-tracking log so work doesn't get lost across a long session. Update this file whenever a feature ships or a bug is found.

## 🐛 Bug fixed — WhatsApp sidebar left a 400px page gap after hiding (Claude, 2026-10-04)

- **Symptom (owner, Chrome at ~1,720 px):** the drawer was gone but the header, hero and search bar stayed 400px short of the right edge.
- **Root cause, two races in `assets/js/modules/whatsapp-widget.js`:** (1) the open adds `is-open`/`whatsapp-drawer-open` inside `requestAnimationFrame`, which browsers pause in background tabs. If the 15s auto-open fired in a background tab and the idle timer closed it before the tab was shown, the queued frame re-added the page gap after the close. (2) A close that never animated left its `transitionend` "hide" listener armed, so the **next** open's slide-in fired it and hid the drawer while the gap stayed.
- **Fix:** a `drawerWanted` flag (the queued frame does nothing if the drawer was closed meanwhile), and a cancellable `pendingHide` (each open cancels the last close's hide, and hide never runs while the drawer should be open). There are two new regression tests in `tests/modules/whatsapp-widget.test.js`; the first fails without the fix.
- **Verified in Chromium at 1,724 px on all 43 pages** (every root page, `hotels/`, `/stay`, the 404): open-and-close within one frame, then open, then close with × or Escape, each restores full width.
- **Also:** the "👉 Still here — tap anytime to book on WhatsApp" hint now inherits its section's text colour (white on dark heroes) with a subtle shadow, so it no longer disappears on the homepage hero.

## ✅ Shipped — booking links round 2 + live smoke test (Claude, 2026-10-04)

- **Re-check of all 162 doubtful/none rows** (4 agents, one search each, using the owner's rule "name Rishikesh booking.com → first booking.com result") plus a third link check: **183 verified** (173 Booking.com, 4 Agoda, 4 MakeMyTrip, 2 Airbnb), 88 doubtful, 57 none.
- **BigQuery `rishikesh_homestays.market_properties`** (new): `scripts/stays/push_bigquery.mjs` loads one row per stay per `snapshot_date` (1,608 rows on the first load, verified by query). `refresh.py` runs it after each rebuild, and the workflow uses the optional `GOOGLE_APPLICATION_CREDENTIALS_JSON` repo secret.
- The remaining ~1,280 unsearched stays need the Google Programmable Search API (owner to add `GOOGLE_CSE_ID`/`GOOGLE_CSE_KEY` to `.env`). Photos are still pending Booking.com Demand API access (no copying).
- **Live smoke test passed** on rishikeshhomestays.com: all stays pages, assets and `/api/contact` respond; the master page pins our 3 stays; search lazy-loads data; the `/stay` map draws; WhatsApp uses the live URL; the popup sends the lead (`stay_redirect_booking_com`, `guests_total`) before redirecting to `…/dewa-retreat.html?aid=7854081`. The API call was intercepted, so no real lead was created.
- **Round 2 OTA search:** 5 agents covered the next 250 most-reviewed stays. The 200-search cap is **shared by the whole session**, so only 197 got searched; 53 unsearched or limit-cut rows were left out of `ota-links.tsv` so the next session re-searches them. Two name-mismatch rows were downgraded to doubtful.
- **Link check** (`node scripts/stays/check_links.mjs`) moved 41 more Booking.com links that redirect to the city search to doubtful (many hostels). **Now 166 verified** (160 Booking.com, 3 Agoda, 2 MakeMyTrip, 1 Airbnb), 120 doubtful, 42 none, out of 328 searched. About 1,280 stays are still unsearched.
- Next: re-search the 53 left-out rows, then continue down the review count (each session's 200 searches cover roughly 200 stays), and add the new doubtful rows to the owner's review sheet.

## ⚠️ Paused — 404 Chotiwala ponytail needs artwork edit (Codex, 2026-10-03)

- Tried a responsive inline SVG choti overlay on the 404 page's Chotiwala-style guide, shaped as a long tapered ponytail rather than a top tuft.
- Removed the overlay after laptop/mobile screenshots showed it still read as forehead placement. The correct next step is an artwork-level edit/regeneration so the ponytail is naturally behind the head instead of floating above the image.
- `git diff --check -- 404.html .agents/coordination.md PROGRESS.md` passes after removing the overlay.

## ✅ Built, not yet pushed — stays pages, round 3: affiliate, map, copy, link check (Claude, 2026-10-03)

- **Booking.com affiliate ID `7854081`** is set as `BOOKING_AID` in `scripts/stays/build_pages.py` and appended to every verified Booking.com link. Verified end to end: phone required → lead to /api/contact → redirect to `…/hotel/in/<slug>.html?aid=7854081`. Note: `aid=356980`, seen on many shared Booking links, is a generic ID, not ours.
- **Link check:** `node scripts/stays/check_links.mjs` loads every verified link in a real browser. 22 Booking.com links redirected to Booking's Rishikesh search (closed or moved properties) and were downgraded to `doubtful`, leaving **74 verified** (3 Agoda, 1 Airbnb, 68 Booking.com, 2 MakeMyTrip). MakeMyTrip blocks automated browsers, so its check failures are inconclusive and those links were kept. Re-run the check before each push.
- **/stay page:** the WhatsApp buttons carry the site's standard WhatsApp icon. The WhatsApp message is per listing: the stay's name, type and area, plus a "Ref" block with the stay id, its /stay link, and the straight-line distance to our nearest own homestay. A **map** was added (self-hosted Leaflet + OpenStreetMap, lazy-loaded) showing the stay, our 3 homestays and stays within 1.5 km.
- **Copy rules from the owner:** no visible dates and no mention of the data source or crawling anywhere on the public pages (page titles, FAQs, notes, `llms.txt`, and the public data file, which no longer carries source URLs). Never say "official"/"unofficial"/"independent". The disclaimers are written in a quirky local-guide voice. Footer © and the hidden JSON-LD `dateModified` are kept.

- **Book-direct pitch in the opener (round 6):** "Book direct with us and skip the booking-site commission. Spend what you save on <random treat> instead!" with 10 treats (`SAVED_COMMISSION_IDEAS` in api/contact.js): Chotiwala feast, rafting, Triveni Ghat offering/donation, sunrise yoga, chai & jalebis, Kunjapuri taxi, Parmarth diyas, Ayurvedic massage, Tapovan cafe crawl.
- **WhatsApp opener (round 5):** no longer names the clicked listing. It asks for check-in/out dates and offers "our best handpicked homestays and hotels … at direct-booking prices". Owner goal: sell our network over theirs. A test email ("Stay lead: TEST Guest (4 guests) → Sitara…") was sent to CONTACT_EMAIL on request, with BigQuery stubbed.
- **Lead popup, round 4:** unmatched stays redirect to `/thanks` (no inline message). Stay-popup leads are emailed **only to us** (never the guest), with a "WhatsApp <name> now" button (wa.me to the guest with a prefilled opener) and the guest count in the subject. The popup asks for total guests (kids included) through one of 18 random quirky Rishikesh questions. Verified in the browser (stepper → `guests_total`, guest's WhatsApp text includes the group size). Note: one real test email ("Stay lead: Divya Test (5 guests) → Sitara…") went to CONTACT_EMAIL while rendering the email, because the Resend SDK ignored the fetch stub; BigQuery was stubbed and got no row.

### Decisions and findings (2026-10-03 conversation)
- **Photos:** not taken from the directory site or Booking.com (copyright; a credit line doesn't grant permission). Legitimate routes are Booking.com's partner data API (apply in Partner Centre) or photos sent by the properties. A photo gallery is pending one of those.
- **Framing Booking.com pages:** rejected. Booking sends `frame-ancestors 'none'` (report-only today, can be enforced), third-party cookies break affiliate tracking inside frames, and the framed page showed a city search in Hindi, not the property.
- **Booking.com's old affiliate widgets** (`<ins class="bookingaff">` + `aff.bstatic.com/.../flexiproduct.js`, as in the Squarespace forum thread) are **retired**. Every product (map, nsb, dfl2), even the thread's own example, redirects to a bare `flexiproduct.html` that returns 400. Use current Partner Centre widget code if one is needed.
- **Why the directory shows Advaitam's 100 photos without the owner's approval:** it is almost certainly a Booking.com partner site using Booking's content feed. Booking.com's property terms typically let Booking share uploaded content with partners. Owner options: check the Extranet terms or ask Booking partner support, and ask the site to remove the page (which may cost distribution).
- **Review sheet:** [Rishikesh Stays – Booking Links to Review](https://docs.google.com/spreadsheets/d/1KI8La77lRZlNsp7NrGeppS8IiIKIWXDlXl65ktSSNFE) holds the first 64 doubtful/none rows. The 22 link-check downgrades are not in it yet (only the Drive connector was available, which can't edit an existing sheet). Add them with the Sheets connector, or as a second sheet.

## ✅ Built, not yet pushed — SEO pages, View property + lead popup, booking links (Claude, 2026-10-02)

- **SEO and AI-search pass.** No more shuffle. Lists are written into the HTML in a fixed order: our 3 stays first, then verified-booking stays, then the rest. Each of the 27 pages has data-derived figures (areas, price ranges, pet/Ganga shares), a local guide paragraph, 5 FAQs and JSON-LD (CollectionPage, BreadcrumbList, ItemList, FAQPage). The filters lazy-load their data on first use. `noindex` is removed, the pages are in sitemap.xml and llms.txt, and the footer of all 13 existing pages links to them.
- **Categories now match the directory's own types and themes** (its type/theme pages, slug/name type words, facilities). Added Aparthotels, Lodges, Yoga, Spa & Wellness, Family, Long stays with a kitchen, Airport pickup, Business, Boutique and Jacuzzi, for 27 pages in total.
- **View property → /stay?s=<id> → lead popup → one redirect.** Name/phone/email go to /api/contact (sources `stay_redirect_<site>` / `stay_enquiry`). Then the guest goes to the stay's single verified booking page, or sees a confirmation; WhatsApp is the alternative. Tested end to end with mocked API and redirect.
- **Booking links:** 160 top stays were searched by 4 agents, giving 96 verified, 35 doubtful and 29 none. Agent-inferred URLs were downgraded to doubtful. Doubtful and none rows went to the owner's Google Sheet for review (`import_review.py` brings answers back). The Booking.com affiliate ID is still to be added as `BOOKING_AID`.

## ✅ Superseded — best-X-in-rishikesh market pages (Claude, 2026-10-02)

- Crawled all 1,651 Rishikesh listings on uttarakhand-hotels.com (robots.txt allows; polite 4-worker crawl, 0 errors), then cleaned them to 1,608 unique stays with readable names, area (site AREAS names, by keyword or map position), types (several allowed, each needing evidence), theme tags, stars, guest rating, price and facilities.
- Generated 17 interlinked pages, from `best-hotels-in-rishikesh` (the master list of all stays, one section per category, 20 visible plus Show all and Open page) to homestays, resorts, camps, hostels, villas, apartments, guest houses, cottages, B&Bs, holiday rentals, ashram stays, pet-friendly, Ganga view, luxury, budget and pool. Every page has a category strip and an "Explore more" block linking all the others, plus links to homestays, places, things to do and contact.
- No ranking: lists shuffle randomly on every visit, and the sort control was removed. Our own Advaitam, Elysium and Yoga Retreat at the Ganges (exact listing only) are pinned in a "Book direct" block on top of every page, linking to our page or /contact.
- Pipeline in `scripts/stays/` (crawl → process → build_pages, README). `refresh.py` and `.github/workflows/stays-refresh.yml` re-crawl automatically: a daily check, a cheap diff of the listing page, a full crawl only when properties were added or removed, and a gap that doubles 7 → 56 days while nothing changes.
- Verified all pages at 390 and 1280 px (no errors, no overflow, all interlinks 200). `npm test` passes.
- **Open decisions (owner):** (1) the Go buttons send visitors to the source site (a competitor), so consider "Enquire on WhatsApp" instead; (2) pages are `noindex`, with no nav or sitemap entry, until they carry original content; (3) nothing has been pushed yet.

## ✅ Shipped — owner opt-out now needs a secret phrase (Claude, 2026-09-30)

- Replaced the guessable `?notrack=1` with `?baba=<owner phrase>`. The code stores only the phrase's SHA-256 (compared via `crypto.subtle`), so the phrase isn't exposed in the public code; the owner has it. `?baba=wapas` resumes tracking. Verified: `?notrack=1` and wrong phrases are tracked normally, the right phrase stops all hits on later pages, and `wapas` restores them. All other visitors are always tracked.

## ✅ Shipped (superseded above) — owner opt-out from GA4 (Claude, 2026-09-30)

- `?notrack=1` on any page stores a localStorage flag, and that browser then sends nothing to GA4 (gtag.js isn't loaded, and `ga-disable-G-L82BSZMRLW` is set). `?notrack=0` resumes. The setting is per browser and is reset by clearing site data or using a private window. Verified in Chromium: no requests while opted out, and a `page_view` again after resuming. `npm test` passes 241/241.

## ✅ Shipped — switched GTM → direct GA4 (Claude, 2026-09-30)

- At the user's request, `assets/js/analytics.js` now loads GA4's gtag.js directly (`G-L82BSZMRLW`) instead of the GTM container `GTM-M4KQ9TNN`. Pages are unchanged (same single include line), so there's exactly one Google tag per page and no double counting. `analytics.test.js` now also fails on any hardcoded `G-`/`GTM-`/gtag snippet in HTML, and fails if `gtm.js` loads alongside GA4. The GTM container is no longer used by the site.

## ✅ Shipped (superseded above) — Google Tag Manager on every page (Claude, 2026-09-30)

- Container `GTM-M4KQ9TNN` is loaded from one shared file, `assets/js/analytics.js`, not pasted inline 13 times. Each page has a single `<script async src="/assets/js/analytics.js"></script>` right after `<meta charset>`, so changing the ID later is a one-file edit. Google's `<noscript>` iframe is omitted on purpose: it can't be shared from JS, and GA4 records nothing without JavaScript.
- New guard `tests/integration/analytics.test.js` discovers every root and `hotels/` page from disk (a new page is covered automatically). It fails if the include is missing or misplaced, or if a `GTM-` ID is hardcoded in HTML.
- Verified in Chromium against the dev server: `gtm.js` returns 200 and `dataLayer` gets `gtm.js`/`gtm.dom`/`gtm.load` on `/`, `/contact`, and the `hotels/` page. `npm test` passes 241/241.
- **Still needed in the GTM dashboard (user action):** add a GA4 Configuration ("Google tag") with the G- measurement ID, triggered on Initialization – All Pages, then **Submit/Publish** the container. Until it's published, GTM loads but sends nothing.

## ✅ Shipped — WhatsApp nudge speech-bubble tail + Edge/Windows rendering check (Claude, 2026-09-29)

- **Nudge bubble tail**: the "Planning a Rishikesh trip?" / "Psst… still here!" bubble above the WhatsApp FAB now has a speech-bubble tail on its bottom edge pointing at the icon. It's a CSS-only `::after` in `assets/css/whatsapp-widget.css`, aligned to the FAB center through a `--nudge-tail-right` custom property (30px desktop, 28px at ≤480px), with the bubble raised slightly (96px / 88px) so the tail clears the button. Verified with Playwright screenshots at 1440x900 and 390x844; `npm test` passes 239/239.
- **Edge "haziness" investigation**: Edge and Chrome share the Chromium engine, so a difference between them almost always comes from Windows rather than the browser. Playwright on this Mac can't reproduce Windows text rendering. What it could test:
  - Windows display scaling: homepage at 1366x768 with deviceScaleFactor 1 / 1.25 / 1.5 stayed sharp, so scaling was ruled out.
  - Actual rendered font (queried through CDP `CSS.getPlatformFontsForNode`): body/nav text renders as **San Francisco** (`.SF NS`) on macOS and headings as Georgia. The `Inter` in the font stack is **never loaded** (no `@font-face`, no webfont link), so Windows visitors get **Segoe UI** with ClearType, which looks softer and lighter, especially small muted text. This is the most likely cause of the haziness.

## ✅ Shipped — page rename + SEO gap audit

- **`pages/things-to-do.html` renamed to `pages/things-to-do-in-rishikesh.html`** (URL keyword reinforcement for search). All ~48 internal link references updated across every page, `sitemap.xml`, `llms.txt`. Old URLs (both `/pages/things-to-do` and `/pages/things-to-do.html`) 301-redirect to the new one in both `server.js` (local dev) and `_redirects` (Netlify production) — nothing that was ever indexed or bookmarked breaks.
- **SEO gap audit across every page**, checking: sitemap completeness vs actual files (✅ complete, `thanks.html` correctly excluded as `noindex`), image alt-text coverage (✅ every image on every page has non-empty alt text), broken internal links (✅ none found, verified programmatically), duplicate titles/descriptions (✅ none), heading structure (✅ exactly one `<h1>` per page), `lang` attribute (✅ present everywhere).
- **Found and fixed 3 real gaps**: `kedarnath-yatra.html`'s title was 64 characters (Google truncates past ~60, would have cut off "Itineraries" mid-word) — shortened to 55. Two meta descriptions (`places-to-visit.html` at 164 chars, `list-your-homestay.html` at 166 chars) exceeded Google's ~160-char display limit and would render with an ellipsis cutoff — both trimmed to fit while keeping the key info.
- **Added `og:locale`** (was missing on every single page) — a minor but real gap for how Facebook/LinkedIn and some crawlers interpret language/region when rendering link previews.

152/152 tests passing, all 11 pages verified 200, all old URLs verified redirecting correctly.

## 🐛 Bug fixed — Places/Restaurants tabs never activated at all

**Root cause**: `setupPageTabs` was imported into `assets/js/site.js` but never actually called inside the `DOMContentLoaded` handler — a plain "wired the import, forgot the invocation" mistake. The tab buttons and panels existed and were styled correctly, but the JS that makes clicking them do anything never ran on any page. This is exactly why the "Places to Visit" button showed no active-state styling even by default — `activate()` never fired at all.

Fixed by adding the missing `setupPageTabs();` call. Also fixed two smaller, real issues found while debugging:
- The auto-popup "shown" flag was written only when the 20-second timer *fired*, not when it started — meaning a visitor browsing between several pages (spending 20+s on each) could see the popup/nudge re-trigger fresh on every page, not just once per session. Now claimed immediately.
- Switching tabs didn't adjust scroll position — since Places (22 cards) and Restaurants (a handful) have very different heights, switching while scrolled down could strand the visitor in blank space. Now smoothly scrolls back to the tab switcher on every click.

**New regression test** (`tests/modules/site-shim.test.js`) specifically guards against this class of bug going forward: it statically checks that every named import in `site.js` is actually referenced again in the file (not just imported and forgotten), and specifically that `setupPageTabs()` is called inside the `DOMContentLoaded` handler, not just imported.

**Follow-up bug once tabs actually worked**: huge empty gap between the tab buttons and the panel content below. The tab-switcher's wrapping `<section class="section">` and the panel section right after it both carry the shared `.section`/`.guide-section` rule's `padding: 82px 0`, so their paddings stacked into ~164px of pure whitespace. Fixed by adding a `.page-tabs-section` class that zeroes just that section's bottom padding (needed `!important` since a later mobile-breakpoint rule on the same selector would otherwise win by source order).

152/152 tests passing.

## ✅ Shipped

- **Modular JS architecture** — `assets/js/modules/*`, with `site.js`/`contact.js` as backward-compat shims (now correctly loaded as `type="module"` everywhere — see Bugs Fixed).
- **WhatsApp popup widget** (`whatsapp-widget.js`) — name/phone/dates/adults/children/pets/message form, opens WhatsApp with a formatted plain-text message, saves to DB via `/api/contact` with `source: whatsapp_widget`.
- **Device-aware WhatsApp linking** (`whatsapp-link.js`) — `wa.me` on mobile (opens app), `web.whatsapp.com/send` on desktop (one hop if WhatsApp Web is already open). Rewrites every static `wa.me` link on a page too.
- **Phone validation** (`validators.js` + `country-select.js`) — real per-country validation via `libphonenumber-js` (self-hosted, `assets/vendor/libphonenumber/`), country dropdown built from library metadata + `Intl.DisplayNames`, IP-based auto-detect (`ipapi.co`, fallback India). Validated client-side and server-side (`api/contact.js`).
- **Date-range validation + calendar** — flatpickr (self-hosted, `assets/vendor/flatpickr/`) on check-in/check-out, check-out forced after check-in, both client and server validated.
- **Main contact form** (`pages/contact.html` / `contact-form.js`) — now also opens WhatsApp with a formatted message (email + "coming from city" included) on submit, in addition to the existing DB save.
- **Mobile responsiveness pass** — 16px inputs (no iOS zoom), ≥36-44px touch targets, popup max-height fixed for short viewports, verified breakpoints collapse before phone widths.
- **SEO / AI-search compliance** — canonical tags, OG/Twitter cards, `BreadcrumbList` + `LodgingBusiness`/`WebSite` JSON-LD on every page, `sitemap.xml` with `lastmod`/`priority`, `llms.txt` added, `thanks.html` set `noindex`.
- **Footer consistency bug fixed** — every page now uses the same rich footer (brand/contact/social/nav columns) that only `index.html` used to have; `thanks.html` had no footer *and* no `site.js` at all — both fixed.
- **Real photos sourced** — 9 real, appropriately-licensed (CC/public-domain, Wikimedia Commons, verified per-file via EXIF/description) photos downloaded to `assets/images/things-to-do/`: Neelkanth Mahadev, Kunjapuri Devi Temple, Neer Garh Waterfall, river rafting, Ganga Aarti, Beatles Ashram, Lakshman Jhula, Parmarth Niketan, Ram Jhula. Full attribution in `assets/images/things-to-do/CREDITS.md` (required for CC BY-SA compliance).
- **`places-to-visit.html` fixed** — all 6 place cards were cycling through only 3 generic stock photos via CSS `nth-child` selectors (not real photos of each place). Replaced with real `<img>` tags per place, each with correct alt text; added on-page photo-credit line linking to CREDITS.md.
- **Country dropdown label fixed** — was showing full country names ("India (+91)") which clipped in the narrow select box; now shows compact ISO code format ("🇮🇳 IN +91") with full name in a `title` tooltip.

## 🐛 Bugs found and fixed

- `site.js` / `contact.js` contain `import` statements but were loaded via plain `<script src>` on every page → silent `SyntaxError`, broke nav/search/forms site-wide. Fixed: all loaded as `type="module"`.
- WhatsApp FAB icon SVG path was malformed (rendered as a blob, not the WhatsApp logo). Fixed with a verified path.
- WhatsApp message used emoji (🏠) and unicode bullets (•) that rendered as a broken "tofu" character on some WhatsApp clients. Fixed: plain ASCII (`-` bullets, no emoji) in all WhatsApp-bound messages.
- Instagram footer link used `instagram.com` instead of canonical `www.instagram.com/rishikesh.homestays`. Fixed.
- **Footer inconsistency** (see above) — fixed.
- **`country-select.js` dropdown appeared empty** — root cause was a missing `<script src="assets/vendor/libphonenumber/libphonenumber-min.js">` tag on the pages that use it. Fixed on `index.html` and `contact.html`.
- **Favicon missing on every page except the homepage** — only `index.html` had the `<link rel="icon">`/`<link rel="manifest">` tags. Added to all 9 subpages, plus copied `assets/images/logo.ico` to `/favicon.ico` at the site root as a fallback (browsers/crawlers check that conventional path regardless of the `<link>` tag).
- **"Plan my stay" nav CTA unreadable on its own page** — on `pages/contact.html`, the CTA link carries `aria-current="page"` (it points to that same page). The generic `.site-nav a[aria-current="page"]` rule (higher specificity than `.nav-cta` alone) was overriding the button's dark background with a light one, while `color: #fff !important` still forced white text — white-on-light-blue, unreadable. Also found and cleaned up a second, unrelated bug in the same CSS block: three separate `.nav-cta` rule sets had accumulated over time with directly conflicting `color`/`background` values (one setting `color: var(--river)` — dark green — which fought the `!important` white from another rule), plus a dead hover rule immediately shadowed by a later one. Consolidated into one clear set of rules.

## ✅ Shipped — clean URLs & mobile menu

- **`.html` no longer shows in the address bar.** `server.js` now 301-redirects any `.html` URL to its clean equivalent (`/pages/contact.html` → `/pages/contact`) and serves the clean URL by mapping it to the matching file on disk. `_redirects` carries the same two-way mapping for the Netlify production deploy (redirect old → new, then rewrite new → the actual `.html` file so the browser bar never shows the extension). All ~300 internal links across every page, `sitemap.xml`, and `llms.txt` updated to the extensionless form. Fixed one edge case along the way: `/index.html` was redirecting to `/index` instead of `/`.
- Also cleaned up `pages/contact.html`'s form tag: dropped the stale `data-netlify="true"` (this form hasn't used Netlify Forms since it was rebuilt to POST to `/api/contact` via `fetch`) and updated its native `action` fallback to the clean URL.
- **Mobile menu made more discoverable** — was an icon-only hamburger square; now a pill-shaped button with the hamburger icon *and* a "Menu" text label, per user request for something "more visible on mobile."
- Added regression tests: every page's internal links must never contain `.html`, and every page must declare a favicon.

## ✅ Shipped — About Rishikesh depth + new Restaurants & Cafes page

- **`pages/about-rishikesh.html` rewritten with real depth**: history/religious significance (name origins, Mahabharata/Ramayana references, Raghunath Temple, Adi Shankaracharya's 9th-century visit), how the Beatles' Feb 1968 stay is credited with putting Rishikesh on the global yoga map, its adventure-tourism identity, a Rishikesh-vs-Haridwar comparison (~25 km apart, different character), and a section on Haridwar's Kumbh Mela with 2027 as the next expected gathering — deliberately hedged (no fixed 2027 dates stated, since those are astrologically set and confirmed close to the event; sourced via web research, not fabricated).
- **New page: `pages/restaurants-cafes.html`** — the vegetarian/alcohol-free municipal rule explained (not just stated), food-style categories (Israeli, German bakery, organic/health, local thali, riverside cafes), area clusters (Laxman Jhula–Tapovan strip vs Ram Jhula/Swarg Ashram vs Triveni Ghat), and ~10 real, named cafes/restaurants with what they're actually known for. **No images used** — researched specifically for this page and confirmed no verified Wikimedia photo exists of Rishikesh's cafe scene (a "Beatles cafe" hit was actually an unrelated derelict building, rejected).
- Both additions wired into nav/footer on every page, `sitemap.xml`, `llms.txt`, and `_redirects`.

## ✅ Shipped — nav consolidation (10 items → cleaner structure)

The nav had grown to 10 top-level items and looked cluttered. Consolidated:

- **Restaurants & Cafes merged into Places to Visit** as an in-page tab (new `assets/js/modules/page-tabs.js`, hash-deep-linkable — `/pages/places-to-visit#restaurants` opens directly to that tab). The standalone `pages/restaurants-cafes.html` page was removed; both its old clean URL and `.html` URL 301-redirect to the new location (`server.js` for local dev, `_redirects` for Netlify).
- **New dedicated `pages/haridwar-kumbh-2027.html` page**, split out of the paragraph that was in `pages/about-rishikesh.html` (which now has a short teaser + link instead, avoiding duplicate content). Includes the specific 2027 Shahi Snan dates the user asked to pull from a tour-operator source, but explicitly labeled "reported, not officially confirmed" — cross-checked against Wikipedia, which still lists 2033 as the next Kumbh under the strict 12-year cycle, and that discrepancy is disclosed on the page rather than picking one source silently.
- Net nav count unchanged (still 10), but now: Restaurants & Cafes is discoverable as a tab within Places (not a competing top-level item), and Kumbh 2027 — a genuinely time-sensitive, high-interest topic — gets its own dedicated page instead of being buried mid-paragraph in About Rishikesh.
- `sitemap.xml`, `llms.txt`, `server.js`, `_redirects`, and nav/footer across all pages updated consistently. 9 new/updated tests added (147/147 passing), including regression guards that the old restaurants-cafes URL is gone from every internal link and that the tab markup exists.

## ✅ Shipped — WhatsApp widget bug fix + site-wide rollout

- **Fixed: submit button was invisible without scrolling.** The popup was one long scrollable box (header included), and "Send on WhatsApp" was the very last thing inside the form — easy to never see at all, per the user's screenshot. Restructured so only the middle content scrolls: header and a new fixed footer (containing the submit button) stay pinned via `flex-shrink: 0` on a proper flex-column popup, with `flex: 1 1 auto; min-height: 0` on the scrolling body. The button itself moved from inside `<form>` to the fixed footer, wired via the standard HTML `form="whatsapp-form"` attribute (no JS changes needed — the existing submit listener still fires correctly, verified with a jsdom functional test).
- **Widget rolled out to all 11 pages, not just the homepage.** Added the widget stylesheet, both vendor scripts (flatpickr + libphonenumber), and the init snippet to the 10 pages that were missing them — checked each one individually so pages that already had the vendor scripts for their own forms (contact, homestays, list-your-homestay) didn't get duplicates.
- 2 new regression tests added: every page must load the widget + its dependencies, and the submit button must live in the footer, not nested inside the form. 149/149 tests passing.

## 🔔 Also shipped — WhatsApp auto-popup

- **Desktop**: after 20 seconds on a page, the WhatsApp widget auto-opens (once per browser session, never if the visitor already interacted with it manually).
- **Mobile**: deliberately does *not* auto-open the full form — that's the kind of intrusive mobile interstitial Google's own mobile-usability guidelines flag, and it just feels spammy on a small screen. Instead, the FAB pulses briefly and a small dismissible "💬 Need help planning your stay?" bubble appears next to it for ~8 seconds, tap to open the full form, otherwise it fades without blocking any page content.
- Verified via a functional smoke test (jsdom + shortened delay in a throwaway copy, not the shipped file): desktop opens the popup, mobile shows the nudge with the pulse class — confirmed both branches actually fire correctly.

## ⚠️ Flagged to user — partially fixed, one choice still open

- Codex's `things-to-do.html` rebuild used AI-generated images with alt text presenting them as specific real named sites (no "illustrative" qualifier), unlike Codex's later, more careful work on `places-to-visit.html` (AI only for photo-gaps, clearly labeled "Illustrative view of..."). Claude fixed the labeling on `things-to-do.html` and `triveni-ghat.html` to match that same honest pattern — see `.agents/coordination.md` for the full note.
- **Still open, needs your call**: whether to keep the AI illustrations on `things-to-do.html`/`triveni-ghat.html` for places where real verified photos already exist unused in `assets/images/things-to-do/` (Neelkanth Mahadev, Neer Garh Waterfall, Ganga Aarti), or swap back to those. Not assumed either way.

## ⚠️ Known issue — misidentified form (my mistake, needs correcting)

There are **two different enquiry forms** on this site, and I initially enhanced the wrong one:

1. `pages/contact.html` — the main "Send enquiry" / "Plan my stay" form. **This is the one I upgraded** with country-aware phone validation, flatpickr dates, and WhatsApp-message-on-submit.
2. `pages/homestays.html` sidebar — headed **"Ask for a shortlist"** (this is what the user meant when asking about "Ask for a shortlist"). This form is still the old, basic version: free-text "Dates" field, no phone validation, no country code, and — importantly — **it submits via Netlify Forms (`data-netlify="true"`, action `/pages/thanks.html`), not `/api/contact`, so it never reaches Supabase at all.**

**Next step:** rebuild the `pages/homestays.html` "Ask for a shortlist" form to match `contact.html`: country-code phone validation, flatpickr check-in/check-out, email field, "coming from city" field, submit to `/api/contact` (so it actually saves to the DB), and open WhatsApp with the same formatted-message pattern.

## ✅ Also shipped (new pages)

- **`pages/list-your-homestay.html`** — new host-onboarding page (Airbnb-style "list with us"): benefits, how-it-works steps, requirements, and an application form (`host-form.js`) that validates phone, opens WhatsApp with a formatted application message, and saves to `/api/contact` with `source: host_application`.
- **`pages/kedarnath-yatra.html`** — new page positioning Rishikesh as the Char Dham/Garhwal gateway: route/distance to Kedarnath, registration note, best season, distances to Badrinath/Gangotri/Yamunotri/Auli/Valley of Flowers, sample itinerary, practical tips. Content researched and fact-checked via web search; flagged uncertain figures (exact km, yearly registration process, temple open/close dates) as "verify current" rather than stated as fixed.
- Both new pages added to nav (all pages), footer (all pages), `sitemap.xml`, and `llms.txt`.
- Country dropdown now shows compact `🇮🇳 IN +91` format instead of full names that clipped in the select box (full name in `title` tooltip).
- Removed visible on-page photo-credit line per request; attribution kept as HTML comments per image + `CREDITS.md` (keeps CC BY-SA compliance without a visible line).

- [x] **Fixed "Ask for a shortlist" form (`pages/homestays.html`)** — was submitting via Netlify Forms (`data-netlify="true"`, action `/pages/thanks.html`) with zero phone/date validation, never reaching Supabase. Rebuilt to reuse the exact `contact-form.js` module (same field IDs as `contact.html`'s form): country-aware phone validation, flatpickr check-in/check-out, email + coming-from-city fields, opens WhatsApp with formatted message, saves to `/api/contact`. This was the actual form the user meant by "Ask for a shortlist" all along.

- [x] **`pages/places-to-visit.html` expanded to 22 places** — added the 6 originally-researched places that never got cards (Kunjapuri, Sivananda Ashram, Patna Waterfalls, Vashishta Gufa, Gita Bhawan, Swarg Ashram) plus 10 new ones from the 30-place TripAdvisor research (Bharat Mandir, Tera Manzil Temple, Bhootnath Temple, Gurdwara/Hemkund Sahib Trust, Astha Path, Sachcha Akhileshwar Mahadev Temple, Shatrughna Temple, Chilla Canal Viewpoint, Janki Pul, Rajaji National Park). 13 of 22 have real verified photos; the other 9 are text-only cards (no image fabricated) since no correctly-verified photo could be found — user said images can be supplied later if needed. Meta description updated to reflect the expanded count.

## 📋 Pending

- [ ] **Self-host Inter** (woff2 in `assets/vendor/`, `@font-face` in `styles.css`) so text renders identically on macOS and Windows/Edge instead of falling back to San Francisco vs Segoe UI. Proposed 2026-09-29, waiting on user go-ahead. Also waiting on an Edge/Windows screenshot of the user's "other minor issues".
- [x] Reorganized and refreshed `404.html` with dedicated desktop and portrait mobile WebP scenes, vertical 4/0/4 signboards, confused woman traveler and Chotiwala-style guide sharing an upside-down map marked `RISHIKESH`, Kedarnath walking stick, restored “dip in the Ganga” headline and “Last seen” punchline, and the Hindi chant with a flowing Ganga underline repositioned into open clouds. Laptop/desktop now uses the requested horizontal 70:30 image/content split; mobile remains stacked. The articulated diver and a capsizing raft with three jumping passengers land in the visible river channel with individual splash rings, foam, droplets, and reflected shimmer until the 20-second home redirect. Reduced-motion visitors do not see the raft incident. Verified at 1440x900 and 390x844, including impact frames, with `npm test` passing 233/233.
- [x] Corrected the desktop WhatsApp drawer behavior: it still auto-opens after 15 seconds, but now auto-closes at 55 seconds total if ignored, stays open after genuine user/form engagement, overlays the page without changing body width or rearranging hero imagery, and uses a softer 0.9-second slide. Browser verification confirmed identical 404 image bounds before and after opening; regression tests cover idle close, engagement persistence, and no body resize. `npm test` passes 233/233.
- [x] Rebuilt the Restaurants & Cafes venue list with ten identifiable, source-documented photos: Little Buddha, Om Freedom, The 60's Cafe, Shambala, Devraj, The Arches, Ramana's Organic Cafe, Pure Soul, Bistro Nirvana, and Chotiwala. All card assets are optimized 900x600 WebP files; the two ambiguous listings were replaced with verifiable venues. Also added a versioned WebP Rajaji National Park editorial safari scene with a jeep, Asian elephants, and spotted deer. Verified with `npm test` passing 225/225.
- [x] Rebuilt `pages/things-to-do.html` with six experience-led image cards, internal links, and consistent AI-generated realistic travel photography.
- [x] Synced `things-to-do-in-rishikesh.html` first-time experience cards with their correct images: Kunjapuri sunrise, Neer Garh Waterfall, river rafting, Ganga Aarti, and yoga/quiet had been shuffled across cards. Verified with `npm test` passing 225/225.
- [x] Refreshed `pages/about-rishikesh.html` with five visual story sections, improved area descriptions, and direct homestay links.
- ⚠️ **Flagged for user decision (Claude, 2026-09-23):** the images above are AI-generated (`ai-neelkanth-mahadev.png` etc.), but the alt text and cards present them as depicting specific real, named sites (Neelkanth Mahadev Temple, Kunjapuri, Neer Garh Waterfall, Ganga Aarti). This wasn't part of the original brief — real, verified Wikimedia photos for these exact places already exist unused in the same folder (`neelkanth-mahadev-temple.jpg`, `kunjapuri-devi-temple.jpg`, `neer-garh-waterfall.jpg`, `ganga-aarti-triveni-ghat.jpg`). Flagging rather than reverting unilaterally — Codex, please don't treat this as resolved until the user weighs in.
- [ ] Places explicitly excluded as too thin/unverified to publish as fact (see research findings above): Shri Satya Sai Ghaat, Vedic Dham - Ganga, Chandreshwar Mahadev Temple, Pabekh (nobody could determine what this even is) — add only if the user has first-hand info.
- [ ] Discoverability / "show up when people search 'rishikesh homestay'" — see recommendations below. Waiting on user's Google Business Profile details (exact name, address, phone, category, GBP link) to tighten NAP consistency in the schema.

## 🔬 Research findings: 30-place TripAdvisor list

Background research pulled TripAdvisor's Rishikesh attractions list (ranks 1-23 and 31-60 rendered; 24-30 didn't load — not guessed/fabricated). Already covered: Triveni Ghat, Vashishta Gufa, Parmarth Niketan, Neer Garh Waterfall, Kunjapuri, Sivananda Ashram, Lakshman Jhula, Patna Waterfalls, Beatles Ashram, Ram Jhula, Gita Bhawan, Swarg Ashram.

**New places with solid facts, ready to add** (skipping yoga schools/shops/spas — not comparable "places to visit" content): Bharat Mandir, Tera Manzil Temple, Bhootnath Temple, Gurdwara Sri Hemkund Sahib (Rishikesh branch), Astha Path (riverside promenade), Shri Sachcha Akhileshwar Mahadev Temple, Shatrughna Temple, View Point Chilla Canal, Janki Pul (3rd suspension bridge), Rajaji National Park (Chilla Zone — safaris).

**Verified images found** (Wikimedia Commons, CC BY-SA 4.0): Tera Manzil/Trayambakeshwar Temple, Rajaji National Park, Bharat Mandir, and a probable match for the Rishikesh Gurdwara.

**No verified image found** (after real effort — not guessing a wrong one): Bhootnath Temple, Gita Bhawan, Astha Path, Vashishta Gufa, Swarg Ashram (the precinct itself). These can go live as text-only cards, or wait for the user's own photos.

**Explicitly flagged as too thin/unverified to publish as fact** — do not add without a local site visit or better source: Shri Satya Sai Ghaat, Vedic Dham - Ganga, Chandreshwar Mahadev Temple, Pabekh (nobody could determine what this actually is).

## 🔎 Discoverability recommendations (not code — needs the business owner's action)

On-site SEO (JSON-LD, canonical, sitemap, llms.txt) is done, but ranking for "rishikesh homestay" competitively also depends on off-site signals I can't create from inside the codebase:

1. **Google Business Profile** — the single highest-leverage thing missing. A verified GBP listing (address, phone, photos, category "Homestay"/"Guest house") is what actually drives the local map pack and much of what Google's AI Overviews pull from for "near me"/local queries.
2. **Structured NAP consistency** — Name/Address/Phone identical across GBP, the website (already added via `LodgingBusiness` schema), and any directory listing.
3. **Listings on travel directories** — TripAdvisor, MakeMyTrip, Booking.com/Airbnb (even a "not bookable, contact us" listing), Justdial — these are exactly the kind of sources AI answer engines (ChatGPT, Perplexity, Google AI Overviews) cite for "best homestays in Rishikesh" style queries, more than the business's own site.
4. **Backlinks from Rishikesh-focused content** — travel bloggers, yoga-school partner pages, local tourism boards linking to rishikeshhomestays.com.
5. **Real customer reviews** — on Google Business Profile and any directory listing. This is something I will not fabricate — genuine reviews are also a ranking/trust signal for both Google and AI answer engines, and fake ones violate Google's policies and would be actively harmful if discovered.

None of the above needs code changes here — happy to help draft the actual directory listing copy/descriptions if useful.
