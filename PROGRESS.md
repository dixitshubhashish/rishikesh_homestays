# Progress Tracker

Bugs, features, chores, open questions and owner actions, one line per ticket, newest state in place. IDs are `RH-BUG-N`, `RH-FEAT-N`, `RH-CHORE-N`, `RH-Q-N` (needs a decision) and `RH-OWNER-N` (only the owner can do it); mention the ID instead of re-explaining. A closed ticket keeps its line (moved to Closed, with the date and commit), so an ID is never reused. Agent work (claims, session logs, verification notes, the long write-up behind each closed ticket) lives in `AGENTS.md`, not here.

## Open

- **RH-BUG-2** — Goibibo (4,821) and MakeMyTrip (2,540) `candidate_pages` rows still `unreadable`. The `navigator.webdriver` block is solved (Playwright over CDP to the project's own real Edge, port 9225, `scripts/stays/_scratch_recheck_via_edge.mjs`); a separate volume rate-limit remains, so the recheck runs in paced batches (≤120 rows, 2.5 s gap, cooldown between). Run stopped 2026-10-18 when the VS Code Claude sessions were shut down; resume the paced batches (`scripts/stays/_scratch_recheck_via_edge.mjs`, Edge on CDP port 9225) from wherever `candidate_pages` still shows `unreadable`.
- **RH-FEAT-1** — the 853 declined Rishikesh/Haridwar candidates: sampled 2026-10-17; the 31 placeholder-geocode rows are not recoverable (Booking.com reassigned the slugs); the 644 "no lodging type" rows wait on RH-Q-5. Nothing else to do until then.
- **RH-FEAT-9** — more content pages: size pages (2 BHK, 3 BHK & bigger, Studio & 1 BHK, Villas) already exist for all four cities, confirmed on disk 2026-10-18 — done, no action. Still open: more landmark pages, an AIIMS long-stay page. Needs real, verified facts (distances, coordinates) before writing — not started.
- **RH-FEAT-15** — native-speaker review of the stays templates in 22 languages: 104 of 110 chunks reviewed and merged on 2026-10-18; six chunks never ran (Kannada C2 and C3, Korean C3, Sinhala C3, Hebrew C3, Telugu C3; chunk files in the scratchpad `review2/`, regenerate with `sync.mjs` if gone). Also not done: a page-flow check in a real browser per language (`scripts/i18n/coverage.mjs`, screenshots).
- **RH-FEAT-14** — guide → stays → call interlinking for user experience ("Plan the rest of your trip" card on the stay page is in). Another session, active 2026-10-18.
- **RH-CHORE-2** — a review pass had six unfinished chunks when the session was stopped (2026-10-18); re-run it. Also rerun the visual test (3 page-load timeouts at machine load 66–85; 1,722/1,726 otherwise passed) on an idle machine.
- **RH-CHORE-1** — the ~13 finished `_scratch_*.mjs`/prototype files (Agoda, Airbnb, Booking.com, small-OTA, old-unreadable recheck, requeue-closed, placeholder-geocode, city-boundary demo) deleted 2026-10-18. `_scratch_recheck_via_edge.mjs` stays until RH-BUG-2 finishes.
- **RH-CHORE-2** — `docs/HANDOFF.md`: live numbers are current (2026-10-17); the dated session notes below them are history and stay as written. Nothing pending unless the owner wants them pruned.
- **RH-CHORE-4** — Windows: `npm run setup` and the search paths are untested on real Windows.
- Permanent limitation, not a ticket: 146 `candidate_pages` rows stay `unchecked` on Trip.com (login wall), Hotels.com (no geo), Hostelworld, Expedia (bot-check). No tooling fix.

## Blocked on the owner

- **RH-Q-7** — place-name spellings the 2026-10-18 reviewers left alone because a bulk change needs your OK: Sinhala (Rishikesh, Dehradun and Mussoorie each spelled two ways), Japanese (デラドゥン vs デヘラードゥーン, ムッスーリー vs ムスーリー, タポヴァン vs タポワン), Telugu and Nepali (two Mussoorie spellings), Kannada (Badrinath), Tamil (self-drive), German and Spanish (the river as "Ganga" or "Ganges"), Korean (무쏘리 vs 무수리, 264 to 17). Pick one form per language and it is one search-and-replace round.

- **RH-FEAT-2** — extend `map_seen_pages.py` to Dehradun/Mussoorie; ~1,526 verified `ok` candidates wait. Scope decision.
- **RH-FEAT-7** — booking links for Goibibo, MakeMyTrip, Airbnb, Agoda: needs a search API key (Google Programmable Search or Brave); Agoda only by hand.
- **RH-FEAT-8** — own pages for Elysium and Yoga Retreat at the Ganges: details and photos.
- **RH-FEAT-11** — stay photo gallery: Booking.com partner API access or photos from the properties; no copying.
- **RH-Q-2** — Sinhala spelling of Rishikesh: `i18n/si.json` has උෂිකේෂ් (~1,100) and රිෂිකේෂ් (~640); unify on the second?
- **RH-Q-3** — wording from the translation QA: Hindi "स्टे" vs ठहराव; Japanese ホームステイ vs 民泊; Chinese English glosses; Turkish BHK as "+1"; German translating Resort/Camp/Lodge inside names.
- **RH-Q-4** — facts only the owner knows: Rishikesh→Sonprayag km on the Kedarnath page (120–125 vs ~210); Janki Setu = Janki Pul listed twice in `places-to-visit`; Yoga Retreat card "Quiet private rooms with mountain near AIIMS"; "Cots" (baby cots or extra beds?).
- **RH-Q-5** — list the 644 stays declined for "no lodging type in the page data" (Agoda 534)? Mostly real hotels in a sample of 24; would add ~10% more stays, mostly Dehradun/Mussoorie.
- **RH-OWNER-1** — set `CAPTCHA_SECRET` in Vercel (`openssl rand -hex 32`, Production, redeploy); the form captcha is off until then.
- **RH-OWNER-2** — Search Console, Bing Webmaster, Google Business Profile: verify, submit `sitemap.xml` and `sitemap-stays.xml`, claim Advaitam.
- **RH-OWNER-3** — CJ: confirm clicks and bookings credit to link 17293139.
- **RH-OWNER-4** — host the OTA logo images and fill `assets/js/modules/ota-logos.js`.
- **RH-OWNER-5** — native-speaker review of the new translations (Bengali, French, Sinhala, Russian, German, Italian first).
- **RH-OWNER-6** — check live after deploy: `/sitemap-stays.xml`, a stay URL from it, destination search for "Laxman Jhula" and "Haridwar", AdSense fills, a Booking.com banner via `kqzyfj.com`; in Search Console press "Validate fix" on the Holiday rental report (RH-BUG-9).
- **RH-OWNER-7** — Mac memory: 17 GB RAM with swap at 16–19.5 GB of 20 GB on 2026-10-18 (disk is fine now, 44 GB free). Heaviest: Brave (3.1 GB, 52 processes), the dbLogic `next dev` servers (port 3100 ≈1 GB, an idle one on 3123), VS Code. Closing the idle dev server and spare Brave tabs is the owner's call; search browsers are closed when not in use.
- **RH-OWNER-8** — review `docs/booking-links/review.tsv` (~77 doubtful pages).

## Closed

- **RH-FEAT-13** — driving-guide titles lead with distance and hours (31 pages regenerated, 62 strings translated in 22 languages): closed 2026-10-18, `f5e6c5a9`.

- **RH-FEAT-10** — per-stay JSON-LD on `/hotels/stay`: closed 2026-10-18, `8a1176e2` (`assets/js/modules/stay-jsonld.js`: lodging node + BreadcrumbList per third-party stay, no aggregateRating; none for our own or missing stays).
- **RH-Q-6** — closed 2026-10-18: no longer needed, see RH-BUG-5.
- **RH-BUG-5** — Search Console "Why pages aren't indexed": closed 2026-10-18. (1) "Excluded by noindex" (16): correct (`404`, `thanks`, missing/own stays, and since RH-Q-1 the 14 thin category pages). (2) "Discovered – currently not indexed" (390): guide pages that are in the sitemap, linked and current; Google's crawl-budget call, not a defect. (3) "Page with redirect" (7): all 7,475 sitemap URLs answer 200 on `server.js` and none matches a `vercel.json` redirect source, so the 7 are retired URLs (`/pages/…`, root `/best-…`, `/stay`, `/stays`, http/www variants) that 301 on purpose; nothing to fix.
- **RH-Q-1** — AdSense thin content: closed 2026-10-17, `68d71eda`. Per-page gate in `build_pages.py` (`MIN_PAGE` real stays for that city/category, or the master page; landmark pages likewise): 14 thin pages noindex, self-correcting on rebuild.
- **RH-FEAT-12** — finalised stays (verified booking link) listed in `sitemap.xml`, the rest in `sitemap-stays.xml`: closed 2026-10-17, `5b587971`.
- **RH-BUG-9** — Search Console "Holiday rental" invalid item: closed 2026-10-17 (duplicate VacationRental removed from `homestays.html`; Advaitam schema completed). Owner: Validate fix (RH-OWNER-6).
- **RH-BUG-8** — `sync.mjs jobs --help` made a `--help` folder: closed 2026-10-17.
- **RH-BUG-7** — footer "Browse all hotels" button touching the Rentals heading: closed 2026-10-17.
- **RH-BUG-6** — search browsers coming to the front: closed 2026-10-17 (`npm run search:hide`, run by the supervisor every minute on macOS).
- **RH-BUG-4** — `footer_links.py` indenting every page on each run: closed 2026-10-17.
- **RH-BUG-3** — destination search in production (boundary files were git-ignored): closed 2026-10-17 (`scripts/stays/city-boundaries/`, `vercel.json` `includeFiles`); live check in RH-OWNER-6.
- **RH-BUG-1** — Agoda/Booking.com/MakeMyTrip "unreadable" recheck: Agoda and Booking.com cleared; MakeMyTrip's block solved the same way as RH-BUG-2 (2026-10-17), remaining rows run under RH-BUG-2.
- **RH-FEAT-6** — cross-breakpoint UI consistency: closed 2026-10-17 (destination dropdown anchoring; odd-count card grids at tablet width).
- **RH-FEAT-5** — AI-crawler visibility audit: closed 2026-10-17 (`robots.txt` explicit allows; llms.txt, JSON-LD, FAQPage, IndexNow already in order).
- **RH-FEAT-4** — OTA-style destination search on the homepage and in the header search: closed 2026-10-17.
- **RH-FEAT-3** — live OSM geocoding endpoint `api/geocode-area.js`: closed 2026-10-17.
- **RH-CHORE-5** — old CJ widget (link 17323528) removed: closed 2026-10-17, `fb55e87`.
- **RH-CHORE-3** — header fit in all languages at 1381–1920 px and footer at 1920 px: closed 2026-10-17 (no native read of the shortened nav labels).
