# Handoff: start here (state on 2026-10-12)

Read `CLAUDE.md` first (rules, where things live), then this file. Then, as needed: `docs/ARCHITECTURE.md` (modules, API), `scripts/stays/README.md` (stays pipeline), `docs/booking-links/RULES.md` (booking-link search), `docs/TESTING.md`. `PROGRESS.md` is the dated log; `AGENTS.md` is the multi-agent ledger (Codex also works here: claim files before editing).

This file is the one home for live numbers and owner to-dos. Other docs point here instead of repeating them.

## Session 2026-10-17: what changed and what is open (Claude; read before the older notes below, several are stale)

**Done and pushed** (`698e5ec`, `a20e055`; `npm test` 1,721/1,721): translations for all 22 languages (`docs/I18N.md` "Bulk rounds"); the **listing sitemap** `sitemap-stays.xml` and the now-indexable stay page (`docs/ARCHITECTURE.md` "Listing sitemap"; run `python3 scripts/stays/listing_sitemap.py --check`); Dehradun and Mussoorie are in BigQuery `market_properties`; the five duplicate Booking.com pairs are settled (`scripts/stays/README.md` "Duplicate pairs"); `ota-match.mjs` town fix; registry slugs renamed; dark-theme contrast on the `/hotels` active tab.

**Stale in the notes below**: the literal "Data" bug and `CITY_NAME` in `ads.js` are fixed; `unfound.tsv` is empty and the search state lives in `scripts/stays/.cache/stays.db` (`candidate_pages`), not only the TSVs; the stay page is no longer `noindex`.

**Open, owner to decide**: (1) AdSense "Low-value content": the roughly 6,900 JS-filled stay pages now in the sitemap add thin-page risk; options are limiting the sitemap to stays with a verified booking link, and/or `noindex` for Dehradun and Mussoorie until they have links (nothing done). (2) Sinhala spelling of Rishikesh (about 1,100 older strings). (3) Hindi/Japanese/Chinese/Turkish/German wording choices from the QA reports. **Owner to do**: `CAPTCHA_SECRET` in Vercel; Search Console/Bing; CJ link choice; OTA logos; native review of the new translations; verify live that `/sitemap-stays.xml` loads and a stay URL from it renders.

**Open, work**: `candidate_pages` is down to 146 `unchecked` rows (Trip.com 81, Goibibo 53, Hotels.com 8, Hostelworld 3, Expedia 1; counted from `stays.db` on 2026-10-17; the "7,761" in the committed `candidate-pages-summary.tsv` is out of date); fix hidden search-browser windows; the footer sync adds indentation spaces to every page on each build (revert whitespace-only diffs with `git diff -w` before committing, or fix `footer_links.py`); docs (older notes) need a general refresh.

**Decision pages**: the owner can answer a list of choices through a published Artifact with a Submit button (page declares the `db` capability, writes one document, Claude reads it with `ArtifactData`); used 2026-10-17 for the five duplicates.

## Session 2026-10-13: candidate concurrency for the booking-link search (code done, not yet live)

Implemented bounded concurrency for reading booking-site candidate pages (`check()` in
`google_ota_search.mjs`) per the owner's request: up to `--concurrency` (default 2) candidate tabs now
open and get read at once per worker, while the engine search itself (`search()`, `jitter`/`pace`/
`adjustPace`, the `--gap`) stays exactly as serial as before — only the safe part (booking-site pages,
not the search engine's own results page) is parallelized. `search_supervisor.mjs`'s `COMMON` args now
pass `--concurrency 2`. Full design and the five safety properties (no tab-key collision, synchronous
`tried` de-dup before awaiting a batch, first-match-wins ordering, `.lists-lock` TSV writes unchanged,
one bad tab can't hang/fail the batch) are in `docs/booking-links/RULES.md` under "Candidate concurrency".
Both files pass `node --check`.

**Not yet live**: the search was found actively running (supervisor pid, 4 workers, found/unfound/review
counts moving) when this session started, which conflicts with the coordination ledger's own note that
search was stopped, and with GitHub Copilot's Active Claims row on these exact files marked "active;
search remains stopped until uniqueness checks are implemented." Given that direct conflict in the
ledger itself, this session did **not** stop or restart any live process (no `search-ctl.mjs stop/start`
run) — the change sits in the working tree for a supervisor-initiated restart (it already respawns a
worker that crashes, finishes its shard, or goes stale) or for the owner/Copilot to resolve the
uniqueness-check gate first. See the `AGENTS.md` ledger (Active Claims) for the flagged row.

## Session 2026-10-12: AdSense "Low-value content" diagnosis (quantified, no template edit yet)

Investigated the rejection (item 0 below). Read `scripts/stays/build_pages.py` (`CATEGORIES`, `CITY_COPY`, `city_copy()`, `render()`) and the live data modules. Did **not** edit `build_pages.py` or rebuild: it already has four active/uncommitted claims tonight (cities subagent, OTA choice-screen subagent, dedupe subagent, Copilot's URL-ownership/translation work) and the ledger explicitly warns a contaminated rebuild was discarded earlier this session — adding a fifth uncommitted hand into the same generator risked exactly that. This session's own change is docs-only (this file + `docs/ARCHITECTURE.md` + a `PROGRESS.md` line + a coordination row), so there is nothing to rebuild or test.

**Quantified findings** (478 `hotels/*.html` pages total, 15 hand-made root guides separate):

1. **Hand-made guides are not the problem.** `about-rishikesh.html` (2,722 words) and `places-to-visit.html` (3,961 words, 24 real place cards with distinct images/facts) are genuinely unique long-form writing. Confirmed by spot-reading; no further action needed there.
2. **Rishikesh's 32 category pages (`CATEGORIES` in `build_pages.py`) are the best of the generated set**: each has its own hand-written `intro` (1 sentence) and `guide` paragraph (60-150 words) that is specific to that category (camps vs. jacuzzi vs. dharamshalas all read differently) — not a mad-libs template. These are the strongest generated pages on the site.
3. **The other three cities' category pages are doorway-pattern thin**, by construction: `city_copy()` (`build_pages.py:270`) returns `CITY_COPY[city]['intro'].format(title=title)` — **one city-wide intro sentence with only the category name swapped** — plus `CITY_COPY[city]['guide']`, **the exact same paragraph, byte-for-byte, on all ~31 non-master category pages of that city**. E.g. every Dehradun category page (Hotels, Villas, Apartments, Guest Houses...) carries the identical "Dehradun spreads out along a few main roads..." paragraph with nothing specific to that category. This is the literal shape Google's thin-content guidance calls out: pages that "vary only in... city or category name inserted into an otherwise identical block of text."
4. **Dehradun and Mussoorie have zero actionable stays**, counted live from the built data modules:
   `node -e` over `assets/js/modules/stays-index-data-{dehradun,mussoorie}.js` → Dehradun 1,298 stays, **0 linked, 0 Google-Maps-confirmed**; Mussoorie 980 stays, **0 linked, 0 gm**. (Rishikesh: 1,522 stays, 1,358 linked. Haridwar: 1,266 stays, 1,150 linked, 460 gm.) Every single stay on every Dehradun/Mussoorie page is an unclickable name-and-address row — not even a "View on Google Maps" fallback. That is as thin as a listing page gets.
5. **Scale**: Dehradun + Mussoorie together are **168 of the 478 `hotels/` pages (35%)** — 87 Dehradun + 81 Mussoorie (`ls hotels | grep -c -- '-dehradun'/'-mussoorie'`), covering their category, landmark and search-phrase pages. All of them currently render `<meta name="robots" content="index, follow, max-image-preview:large">` (the `render()` function flips every stays page from the shell's default `noindex` to `index,follow` at `build_pages.py:1014`/`1527` — there is no per-city or per-thinness gate on that line today). So Google is being asked to index ~170 pages that are, right now, templated intros over zero-link listings: the single clearest thin-content exposure on the site.
6. Search-phrase pages (`search-pages.tsv`, ~170 across all 4 cities) already have real per-row `intro` copy (one sentence per phrase, not shared) and the existing `thin_note`/alt-city fallback logic (`render()`'s `thin` branch) already writes an honest, specific sentence when a page has too few local stays (owner's 2026-10-04/05 work) — this part is in reasonably good shape and not the main offender. The Dehradun/Mussoorie *category* pages lack even that per-page variation because `city_copy()` only varies the one `{title}` token.

**Recommended fix, prioritized** (none implemented yet — flagged for the owner's go-ahead or the next free session on `build_pages.py`, since the file is mid-edit by others tonight):
1. **Safest, highest-leverage, fully reversible**: add `<meta name="robots" content="noindex, follow">` for any generated stays page whose city has 0 linked/gm stays (today: Dehradun, Mussoorie) — i.e. skip the existing `index,follow` rewrite at `build_pages.py:1014`/`1527` when `CITY in ('dehradun', 'mussoorie')` or, more durably, when a page's own `n_here` (already computed in `render()`'s `thin` branch) is 0. This pulls ~168 near-zero-value pages out of Google's index immediately without deleting anything or touching URLs; flip it back per city the day that city's booking-link search produces real linked/gm coverage. One line near each of the two `.replace('<meta name="robots"...` call sites, gated on a new `city_has_links(city)` helper reading the already-loaded `pools`/`ota` data — small, self-contained, low collision risk with the other active edits to this file (none of which touch those two lines).
2. **Medium effort**: write a real per-category paragraph for Haridwar/Dehradun/Mussoorie the way Rishikesh's `CATEGORIES` guide text already works, instead of the single `CITY_COPY[city]['guide']` shared across all categories — at minimum for Haridwar, which already has real linked inventory (1,150 of 1,266) and deserves the content investment Rishikesh got. Scope: 31 categories × 1 city ≈ 31 short paragraphs as a proof of concept, not all 93 (Haridwar+Dehradun+Mussoorie) in one pass.
3. **Once Dehradun/Mussoorie booking-link search runs** (currently 0/2,278, per the 2026-10-08 cities note below): re-enable indexing city-by-city as coverage crosses a real threshold (reuse `MIN_PAGE`-style logic already in `render()`), rather than an all-or-nothing re-index.
4. Not recommended now: deleting/merging the thin pages outright — the city-switch/footer/sitemap plumbing assumes every city has every page (`docs/ARCHITECTURE.md` "stays pages"), and `noindex` gets the SEO benefit (nothing low-value in Google's index) without touching that plumbing or needing redirects.

Updated item 0 below with this diagnosis; `docs/ARCHITECTURE.md` "Generated stays pages" gets a short pointer to this note (not a duplicate).

## Session 2026-10-12: multi-OTA choice screen on the stay page

Owner request: a stay can have several verified booking links (one per OTA — Booking.com, Agoda, MakeMyTrip, etc., from `scripts/stays/ota-links.tsv`), but "View property" only ever redirected to one. `ota-links.tsv` already stores one row per (stay, OTA), so no file-format change was needed: `load_ota_links()` in `scripts/stays/build_pages.py` now collects every verified row per stay into a list instead of keeping only the last one, so each stay's `o` field in the generated data modules is `[{n, u}, ...]` (Booking.com URLs are still wrapped through the CJ affiliate link at build time, unchanged). `assets/js/modules/stay-page.js`: lead popup unchanged (lead-first policy intact); after a successful submit, a stay with exactly one verified link still redirects straight there (no point showing a one-button choice screen — kept the simpler, unchanged path); a stay with more than one shows a choice screen in the same modal (`showChoices()`), one button per OTA with its logo (if set) and name, each opening in a new tab; a stay with none still falls back to `/thanks`/WhatsApp as before. Logos come from a new `assets/js/modules/ota-logos.js`, `OTA_LOGOS` map keyed by platform name — **every value is still `''` (a TODO for the owner)**: the owner hosts the real logo images on their own image host rather than committing them to this repo, matching the "no image credits in the repo" rule. Until filled in, buttons render as a plain text label with no `<img>` (no broken image tags). Rebuilt all four cities (`npm run build:stays`) and `npm run check:stays` (8/8); `npm test` 1705/1712 passing, with the same 4 pre-existing unrelated failures as before this change (missing i18n translations for other strings, stale `/pages/...` links in `index.html`, a `/hotels` dark-theme contrast issue on `.stays-hub-tab`) — none touch `stay-page.js`, `ota-logos.js`, `affiliate-links.js` or the OTA loader.

## Session 2026-10-12 (Mac): doubled booking-search automation capacity

Owner request: run a second, independent automated instance of each engine alongside the existing four. `scripts/lib/browser-specs.mjs` now lists `chrome2`/`opera2`/`brave2`/`edge2` on ports 9226/9227/9228/9229, each its own `rh-search/<name>` profile folder, same installed app as its "1" twin. `scripts/stays/search_supervisor.mjs` doubles its shard count (12 on macOS with two Firefox workers, 8 elsewhere) and splits it in half: shards 1..N for the original five workers (unchanged numbering), N+1..2N for their "2" twins, so the new workers search previously-uncovered rows instead of redoing the same shard. Each "2" instance is fully independent of its "1" counterpart — verified live: Brave's original port (9224) stayed down the whole time while Brave2 (9228) came up and ran its own worker. `scripts/search-ctl.mjs`'s generic loops (`browsers`/`status`/`stop`/`trim`) needed no changes; they iterate `browserSpecs()` and picked the four new entries up automatically. Tested: `search:browsers --exclude brave` brought up opera2/brave2/edge2 (opera/edge were already up; chrome2 was skipped, matching the existing "needed only" rule — Chrome2 is optional like Chrome, add `--all` to include it); `search:start --exclude brave` started all nine workers (opera, edge, chrome, firefox, opera2, brave2, edge2, chrome2, firefox2) on the expected disjoint shards; `search:status` confirmed them; `search:stop` stopped everything cleanly with none left running. The three new browser instances opened only for this test were then closed by PID (not `trim`, to avoid touching anything else); the pre-existing chrome/opera/edge/brave(down) were left untouched. Docs updated: `docs/booking-links/RULES.md` §5 (port/profile table, worker count, first-run-check line). See `AGENTS.md` for the claim and commit.

## Session 2026-10-12 (Mac): handoff to Claude Code

**Current state:** booking search is stopped. `npm run search:status` confirmed no supervisor or workers. Do not start it on another machine; Claude Code takes over from this stopped state. Last observed counts: `found.tsv` 3,062 rows, `unfound.tsv` 3,713, `review.tsv` 1,431. Workers own these files; do not hand-edit them.

- Local, uncommitted changes: `scripts/search-ctl.mjs` adds `--exclude <browser>` to browser launch and supervisor startup, and memory trim always protects Brave and its child processes, including `--all`. `scripts/stays/search_supervisor.mjs` omits excluded workers. `scripts/stays/google_ota_search.mjs` reuses one Google Maps tab per worker for successive cached place URLs; OTA candidate pages remain temporary background tabs. `docs/booking-links/RULES.md` documents the options and no-API behavior. No Google Maps API, API key, paid call, or owner credentials were used.
- Start the non-Brave pool with `npm run search:browsers -- --all --exclude brave`, then `npm run search:start -- --exclude brave`. Playwright Firefox and Chromium runtimes are installed locally.
- **Background-window issue remains to verify:** after worker attachment, Chrome/Opera became visible behind the active app (neither was frontmost). They were hidden again before stopping; after stop, Chrome, Edge, and Opera all verified `visible: false` and `frontmost: false`. The post-start hide in `search-ctl.mjs` did not reliably keep them hidden during active work. Claude Code should fix and verify this before resuming, without touching the personal Brave app or foregrounding managed windows.
- The earlier unprotected trim logged `closed 43 browser processes`; the owner's personal Brave was likely among them and its debugging port is not answering. Do not launch Brave; let the owner restore their personal app if needed.
- Scoped `git diff --check` and `node --check` passed for the edited search scripts and docs. Full `npm test` was not run. A repo-wide whitespace check found trailing whitespace in worker-owned `docs/booking-links/found-by-property.tsv`; it was left untouched.

## Session 2026-10-08 (Mac): search restarted here

- The booking-link search runs on the Mac again (supervisor + Opera `--review`, Brave and Edge `--deep`); the Windows laptop must stay stopped. Started from `3de3748`.
- **Search browsers open in the background only** (owner's request): `search-ctl.mjs browsers` uses `open -g -j -n` on macOS and then hides each search browser's app (System Events, Cmd-H; the debugging port and tabs keep working), `Start-Process -WindowStyle Minimized` on Windows (untested there), `--start-minimized` elsewhere. Your own browser windows are never touched; `trim` still closes non-search browsers, so do not run it unasked on the Mac.
- **`npm run setup`** (`scripts/setup.mjs`, shared browser detection in `scripts/lib/browser-specs.mjs`): checks Node, Python, Git, Opera, Brave, Edge, npm packages and Playwright Chromium on any OS and installs only what is missing (nothing is reinstalled). `scripts/windows/setup.ps1` and `scripts/mac/setup.sh` bootstrap Node and call it. Checked on this Mac (everything present, nothing installed); the Windows branch (winget) is untested.

- **Ads and Booking.com mixed in on the stays lists** (owner's request; `assets/js/ads.js`, CSS appended to `styles.css`, `docs/ARCHITECTURE.md` ads section, `tests/modules/ads-mix.test.js`): a break after every ~15-20 stays alternating AdSense and a Booking.com CJ banner, sidebar and right rail mixed the same way, the Booking.com widget also on the rental pages and 404. Checked on localhost in preview mode (`?adpreview=1`) at 390/1440/1920; non-visual tests 477 pass, 0 fail; the visual overflow test was not run (search browsers busy). **Owner to check live after a push**: the real AdSense in-feed fills, the banner clicks through `kqzyfj.com` to Booking.com's city page, and the iframe widget (still 0 px tall in headless Chrome) in a real browser. Not committed.

- **Dehradun and Mussoorie added to the stays pipeline** (owner, 2026-10-08; subagent run, uncommitted): crawled from the `all-accommodations` listings (`all-hotels` is a subset: 357 and 381 star-rated hotels), Dehradun 1,330 listings (1,298 kept), Mussoorie 1,011 (980 kept), 0 with a verified booking link yet (the booking-link search has not run for them; View property goes lead then `/thanks`). Same page set as the other cities: 32 categories, 9 and 8 landmark pages, 67 and 62 phrase pages (river/Ganga phrases stay Rishikesh and Haridwar only), city switch with four cities, footers, sitemap, llms, search index. `npm run build:stays` builds all four (Dehradun, Mussoorie, Haridwar, Rishikesh last). Still to do: `npm run i18n:extract` and the sync steps for the new English strings, push to BigQuery (`push_bigquery.mjs`), the booking-link search for the new cities, `scripts/stays/city_areas.mjs` (the other agent's file) after the data modules, and the `CITY_NAME` line in `assets/js/ads.js` (it shows "Rishikesh" on Dehradun and Mussoorie pages). Details in `scripts/stays/README.md` "Cities".

### 2026-10-08 night: backlog (owner: limited tokens, don't run i18n every change — batch it)

- **i18n translation backlog**: 369 texts × 22 languages missing (349 site + 20 stays), from the new driving guides + rentals for Dehradun/Mussoorie below. **Do not translate yet** — owner said to batch this later once things settle, not run i18n after every change.
- **Driving guides + rentals extended to Dehradun/Mussoorie** (not committed): 24 new pages — `driving-from-<7 NCR cities>-to-{dehradun,mussoorie}.html` (14) + `driving-from-meerut-to-{dehradun,mussoorie}.html` (2) + `{bike,car,taxi}-rental-in-{dehradun,mussoorie}.html` (6). Distances researched via WebSearch (Delhi–Dehradun Expressway open since 2026-04-14, ~210km, cuts routes ~20km vs the Rishikesh figures), not haversine. `sitemap.xml` and `assets/js/ads.js` updated by hand (sitemap isn't script-generated). 371/372 tests pass (the 1 failure is the expected i18n gap above). Owner to spot-check `car-rental-in-dehradun.html` before committing.
- **Google Places sweep extended** to Dehradun, Mussoorie and Roorkee (owner authorised, 2026-10-08): `scripts/stays/places_sweep.mjs` CENTRES now has 5 points (Roorkee is sweep-only, not a stays city — `import_google_stays.py` only loops `cities.py`'s CITIES, so Roorkee places land in BigQuery `places_lodging` for internal reference only, never on-site). `--phase ids` ran once, hit its 8,000-call cap partway through (11,107 place ids from 2,075 of 1,540+ tiles, dense ones auto-split; a later unlimited run finished the rest — see below). **`--phase contact` (name+phone+pin, ~$205) dropped entirely (owner, 2026-10-08): "we will run by name and find manually" — do not run it, not even on request, without the owner raising it again.** `--phase details`/`push_places.mjs` likewise on hold until asked.
- **Footer is now one canonical source** (owner, 2026-10-08: "import footer... always"): `scripts/stays/footer_links.py` sweeps the *entire* `<footer>...</footer>` from `thanks.html` into every other root and `hotels/` page (537 pages synced in the first run) — never hand-edit a footer on any page again, edit `thanks.html`'s footer (or the `FOOTER_MADE` constant for the tagline) and re-run the script. Same file also now owns the "Made with ❤️..." tagline as a single Python constant.
- **Distance accuracy fix** (owner complaint, screenshot-prompted): `build_pages.py`'s reader-facing "X km from landmark" figures were pure haversine (straight-line); added `road_km()`, a terrain-correction multiplier (mussoorie 1.35, dehradun 1.25, rishikesh 1.15, haridwar 1.1) applied only to display, not to internal radius-filter/sort logic (left alone on purpose — already tuned). Also fixed one dishonest label ("sorted by real distance" when it wasn't → "sorted by distance"). `npm run build:stays` already run with this fix.
- **Supervisor fix**: the disk-safety gate used to fully halt the search and never recover on its own while disk stayed under 3GB (pushed as `87a6fe0`) — now degrades to one worker instead of zero.

### 2026-10-08 evening: all 22 languages complete, /hotels hub shipped, search seeded for the new cities

**All 22 languages now show `complete`** (`node scripts/i18n/sync.mjs status`) for the Dehradun/Mussoorie + `/hotels` hub strings; `build-runtime.mjs` run, 367/367 tests pass. Pushed as `d0706a8`.

**Bug for the owner to fix at the source** (flagged independently by two translation passes, Telugu and Japanese): about 20-50 generated strings have the literal word **"Data"** where a real city name should be (e.g. "Hotel in Data under 500", "Top 10 Apartments in Data") — not a city in `scripts/stays/cities.py`. Looks like a placeholder/key leak in `scripts/stays/build_pages.py` or the extractor, not a translation issue (every language kept "Data" untranslated, in Latin, rather than guess). Worth a grep for the literal string `Data` in a generated `hotels/*.html` page to find the source.

**`/hotels` hub page** (`scripts/stays/build_hotels_hub.py`, `hotels.html` at root — not `hotels/index.html`: the URL must equal the file path 1:1, a past production outage came from exactly this kind of mismatch): every stays category across all 4 cities on one page, filter bar (All Cities / per city), Homestays always first. The old footer dumped every category link for every city (huge even on desktop, owner's complaint with a screenshot) — now a 20-category teaser per city (Homestays first, full "Best X in City" phrasing) + a highlighted button to `/hotels`. Two CSS specificity bugs fixed along the way (base color and hover color both needed to out-rank an older, more general `.rhs-footer-stays a` rule using the same approach — scope the selector to the wrapper, don't rely on source order).

**Dehradun and Mussoorie seeded into the booking-link search** (`scripts/stays/seed_unfound_new_cities.py`, idempotent, uses the same `.lists-lock` as `prune_unfound.py`): all 2,278 active stays (1,298 + 980) added to `unfound.tsv` with status `retry`. They were never seeded before (`all.tsv`, the original one-time seed, was deleted on 2026-10-05, before these cities existed). The supervisor will pick them up on its next cycle with no restart needed.

**Open for the owner:**
- The "Data" placeholder bug above.
- Disk space on this Mac was down to ~2.3 GB free during this session, which auto-paused all 4 search workers repeatedly (a built-in safety threshold, not a bug) — clear some space when convenient.
- Edge (port 9225) was holding ~41 tabs (two workers, edge + edge2, likely sharing one browser instance) — left alone on purpose, the supervisor's own idle-tab sweep (unchanged across 2 sweeps, ~10 min) handles this safely; closing tabs by hand risks killing a worker mid-verification.

### 2026-10-08 later: where the big batch stands (read this first if the session was cut)

Local, **not pushed** (pushed so far: `6a4b2f3`, ads/banner/hover/setup): Dehradun and Mussoorie cities (built pages, data modules, landmarks, phrase rows, tests made data-driven), the homepage **City dropdown** (`search-form.js`, `city-areas.js`, `?area=` in `stays-index.js`), the **Windows flag font** (`assets/vendor/flag-font/`), `extract-stays.mjs` now finds every city (it was hard-coded to two), the `ensureWindows` fix in `search-ctl.mjs`, `ads.js` city names for four cities, and 22 per-language **translation QA passes** merged into `i18n/<lang>.json` (terms, leftover English, shortened nav labels; ~200-960 texts each).

**CURRENT STATE (2026-10-08 with Haiku):**
- **Translation batch wave 1 running**: 6 agents translating Hindi, Tamil, Telugu, Bengali, Marathi, Kannada (job files at `/private/tmp/…/scratchpad/new/`, ~2,163 texts each). **BUT: 1,960 of those are stays-page variants (same template, 4 cities × city name)**. Only **203 site texts are actually new**. Agents will finish; **when merging, accept site texts only**, skip stays (the pages render with templated content + city terms).
- **Remaining 16 languages** (ja, ko, es, pt, de, fr, it, id, ms, si, zh, vi, ru, he, tr, ne): run another wave translating only the **203 site texts** (use `--only <langs>` and make job files with `--size 100000` to fit all 203 in one file per language).
- **Footer optimization**: stays footer has grown (footer-stays block + four cities × 33 categories = ~132 category links). Move to a scrollable `<div>` if too wide or split into rows by city. CSS: `.footer-stays` is already grid-based; check layout at 1920 px. Plan: short footer on every page, modal or full-width stay categories on pages that need them.

Finish in this order (nothing is safe to push before step 3, because `npm test` fails while any language lacks a text):
1. **Complete translation smartly**: Wait for wave 1 → merge **site texts only** (203) → launch wave 2 for 16 languages (site texts only, no stays duplication).
2. `node scripts/i18n/build-runtime.mjs`, then `node scripts/stays/city_areas.mjs` (the homepage City list shows only cities with built data modules).
3. `npm run i18n:check`, `node --test $(ls tests/*/*.test.js | grep -v '^tests/visual')`, then `npm test` when no search browsers are busy.
4. **Footer check**: Re-measure at 1920 px (stay category rows in footer); optimize if spilling. Check stays lists, category pages, landmark pages for horizontal overflow.
5. Re-measure the header in all 23 languages (nav labels were shortened by the QA passes) at 1381/1440/1600/1920 px: one row, nav text not below `--nav-fit` 0.88; and eyeball a feminine-category stays page in French/Spanish/Portuguese and a Kannada stays page (slot grammar was rewritten gender/case-neutral).
6. `scripts/stays/merge_found.sh --dry`, then the real merge (the search found ~180 new links since `469055a`), `npm run build:stays`, commit, push (owner authorised commit + push when idle, 2026-10-08). BigQuery stays off.

Owner decisions collected from the QA reports (all small, none blocking): Hindi category titles use "स्टे" while STYLE.md says ठहराव; Japanese keeps ホームステイ (民泊 would touch ~250 texts) and writes BHK as LDK; Chinese keeps short English glosses in brackets for palki/bhajan/sadhu and Latin neighbourhood names; Turkish writes BHK as +1 and shortened two nav labels (Rishikesh, Kedarnath); French/Italian/Spanish/German/Portuguese replaced "homestay" with local trade terms (check the nav and the property-type labels); German translated Resort/Camp/Lodge/Cottage labels, which also apply inside stay names ("Ganga Ferienanlage": ids listed in the German QA report, revert those single words if it reads badly); Nepali keeps बसाइ for "stay" in the templates; Tamil/Sinhala/Hebrew/Korean nav labels dropped words to fit (e.g. "List your homestay" → "Add your homestay").

## Session 2026-10-07 (Windows laptop): handoff to the Mac

**State at the end:** the booking-link search is **stopped** on the Windows laptop (supervisor, workers and the search browsers closed; no lock file). Everything is pushed to `main` (last commit `1446aba`). The Mac may start the search now (one machine at a time).

**What landed on main** (`daa82ca`, `ae335b3`, `f3ffc34`, `1993dbd`, `1446aba`):
- **Same code on Windows and macOS** (`fc03ada`, earlier): `scripts/search-ctl.mjs`, `scripts/py.mjs`, rule in CLAUDE.md.
- **Affiliate**: Booking.com approved us in CJ. Every Booking.com link now uses CJ link **17293139** on `kqzyfj.com` (`affiliate-links.js`, 1,377 links in the two stays data modules). (The Booking.com iframe search widget that used link 17323528 was removed on 2026-10-17 at the owner's request; the ID is discarded everywhere.)
- **Report a bug** page (`/report-a-bug`, footer link on every page) and an open-source proof-of-work **captcha on every form** (`api/captcha*.js`, `assets/js/modules/captcha.js`). **The captcha is OFF until `CAPTCHA_SECRET` is set in Vercel**; forms behave as before until then.
- **Coverage / auto-list** scripts for new properties (`import_new_stays.py`, `coverage_report.py`, `booking_stays.py`, tests). The supervisor only runs `import_new_stays.py --dry`; nothing is auto-listed on the site yet.
- **22 languages** for the new strings (machine-made, like the rest).
- **Search**: up to 10 other booking pages saved per search (Booking.com first); child windows hidden on Windows; tab retries; **memory rule** (RULES.md section 5): three workers (Opera, Brave, Edge), search browsers in private windows with extensions off (Edge stays a normal window), `node scripts/search-ctl.mjs trim` closes non-search browsers when memory is tight, idle tabs are swept, Windows one-click files `scripts\windows\search-*.bat`.

**Start the search on the Mac**
1. `git pull` (the Mac must have no unpushed list changes), `npm install` (new dependency `altcha-lib`).
2. Keep the Mac's own search cache (`scripts/stays/.cache/`). Do **not** copy the Windows one: it was rebuilt from BigQuery by `scripts/stays/rebuild_places_cache.mjs` and the fresh crawl differs (Haridwar 798 stays here against about 806).
3. `npm run search:browsers` (Opera and Brave private, Edge normal, extensions off), accept each browser's cookie banner once, then `npm run search:start`; `npm run search:status` to watch. The supervisor runs three workers: Opera first re-checks the 158 `review` rows (no search engine needed), then the deep re-check of the `retry` rows is split in thirds. With plenty of RAM on the Mac, more workers can be added back to `WORKERS` in `search_supervisor.mjs` (change the shard denominators together).
4. **Untested on macOS**: the private-window flags, `search-ctl.mjs trim` (process list via `ps`) and the idle-tab sweep were only run on Windows. Run `node scripts/search-ctl.mjs trim --dry` first and read what it lists before relying on it.

**Open, for the owner**
- Vercel: set `CAPTCHA_SECRET`. Then check live: `/report-a-bug`, the footer link, a Booking.com banner on the homepage and a stay's Booking.com link redirecting through `kqzyfj.com`, and the first clicks in CJ.
- CJ link: settled 2026-10-17, 17293139 is the only one (the owner pasted that link; 17323528 and the widget that used it are gone).
- The search found only about 16 new links in three hours on this laptop: the engines rested or blocked the browsers while memory was short (0.4 GB free). After the memory rule it ran, but not long enough to judge. Counts at the stop: found 2,096, unfound 2,349 (retry 1,643, none 515, review 158, manual 33), `review.tsv` 159.
- `merge_found.sh` was **not** run: only a handful of new links since `469055a`. Run `--dry` first when you merge.
- `docs/booking-links/new-properties.tsv` (20 pages that match no stay we have): four rows carry a wrong town label (Haridwar pins labelled rishikesh). Check them before any is listed.
- **Held back from main on purpose**, saved on the branch `windows-wip-2026-10-07` (never merge it): `scripts/stays/listing-ids.tsv` (the Windows crawl flipped about 1,145 stays to inactive) and the generated lists `found-by-property.tsv`, `found-duplicates.tsv`, `found-links.tsv`, `seen-pages-checked.tsv` (written by a dry run against the rebuilt cache). On the Mac regenerate the lists with `node scripts/py.mjs scripts/stays/organise_found.py` and check `git diff scripts/stays/listing-ids.tsv` stays empty after `process.py`.
- Hand checks done by four agents in browsers were thin (the laptop was overloaded): three generic-name rows were put back to `manual`; do not repeat agents next to the workers.

**Lessons from this laptop**
- Agents that run `find / -name …` through Git Bash hang for hours and use a full CPU each (18 of them held the CPU at 100% until a restart). Tell agents to search only inside the repo or the scratchpad.
- Do not uninstall Git for Windows (`.git` stays, but nothing runs: git, Git Bash, the `.sh` files). Reinstalling needs no stuck processes in `C:\Program Files\Git`.
- ReadyBoost (a USB cache) does nothing on an SSD laptop; free memory is the fix.

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

rishikeshhomestays.com is a Rishikesh/Haridwar travel guide whose job is to **sell the owner's own homestays** over third-party listings: Advaitam (luxury 3BHK in Nirmal Bagh, parking on site, 15% off stays of 5+ days), Elysium, and Yoga Retreat at the Ganges. Third-party stays are listed to attract search traffic and capture leads (lead popup, then the verified booking site(s) — one redirect, or a choice screen when there's more than one — or WhatsApp).

## Live now (origin/main, Vercel)

- **Stays on the site** (counted 2026-10-17 from the built data modules, `gm` = Google Maps place): Rishikesh 2,832 (linked 2,666, `gm` 1,130), Haridwar 1,400 (linked 1,291, `gm` 560), Dehradun 1,471 (linked 1,211), Mussoorie 1,215 (linked 1,033): **6,918 stays, 6,201 with a confirmed booking link** (`ota-links.tsv`: 6,261 verified rows; Booking.com, MakeMyTrip, EaseMyTrip, OYO, Airbnb, Agoda, Trip.com…), plus our 3 pinned in every list. Every one of them is in `sitemap-stays.xml`. Recount with the snippet in "How to run things" (it only lists two cities: add the other two module files).
- **Generated pages in `hotels/`** (481 files on 2026-10-17, four cities): 33 `best-<category>-in-<city>` per city, 20 landmark pages `best-stays-near-<landmark>`, about 170 search-phrase pages (from `scripts/stays/search-pages.tsv`, e.g. `/hotels/cheap-hotels-in-rishikesh`, `/hotels/rooms-near-aiims-rishikesh`, `/hotels/top-10-resorts-in-haridwar`; heading = the exact phrase), and `stay.html`. Every category/phrase page exists in both cities (thin ones list the nearest stays in the other city) and the city switch always lands on its twin. All are in `sitemap.xml`; `npm run check:stays` guards the content. Category pages list the linked stays directly and fold the rest behind "View all" (owner, 2026-10-04).
- **Stays page layout**: Rishikesh | Haridwar switch at the top (same page in the other city), category filters in a sticky **left sidebar** ("Filter stays" button on phones), compact one-row footer (brand+social | Stay | Explore | Stays in Rishikesh | Stays in Haridwar). `/hotels/stay` without `?s=` and `/stays` redirect to the stays list; `hotels/stay.html` itself is the single property page and must stay.
- **Hand-made pages**: guides (about, places, things to do, Triveni Ghat, Kedarnath, Kumbh 2027, Driving from Delhi), Bike & Taxi Rental (Claude owns it; verified live end to end 2026-10-04) plus 15 generated per-city driving guides (Delhi NCR cities to Rishikesh and Haridwar, `scripts/drives/build-pages.mjs`, 2026-10-06; owner to spot-check the rounded distances and the way-out-of-city text) plus six generated rental pages (bike / car / taxi × Rishikesh / Haridwar, `scripts/rentals/build-pages.mjs`, added 2026-10-06; owner to confirm bike and car availability in Haridwar, the copy only says "on request" and "trusted local partners"), contact, homestays, Advaitam page, list-your-homestay.
- **Prices** read "Starting ₹X onwards" everywhere.
- **Money**: Booking.com links are CJ affiliate deep links (`affiliate-links.js`). AdSense on guides, home and stays lists, none on lead pages (plan in `docs/ARCHITECTURE.md`). Competitor ads are allowed (owner's choice).
- **BigQuery** (project `keen-device-610`, dataset `rishikesh_homestays`): `enquiries`; `market_properties` + view `stays_sheet` (directory, with `booking_link`, `bedrooms`, `agoda_url_unconfirmed`); `places_lodging` (Google Maps sweep: 4,947 places, 2,036 phones; **internal only, phones never on the site**).

## Owner to do (blocked on them)

0. **AdSense rejected** (2026-10-12, owner-pasted): "Low-value content". **Diagnosed in the "AdSense diagnosis" session note above** — quantified root cause: Dehradun/Mussoorie (168 of 478 `hotels/` pages, 35%) have 0 linked or Google-Maps-confirmed stays out of 2,278 crawled, and their ~31 category pages per city share one template paragraph varying only the category name (`city_copy()` in `build_pages.py`) — a textbook doorway-page pattern, currently all `index,follow`. Rishikesh's category pages and the 15 hand-made guides are genuinely unique and likely fine. Proposed fix: noindex the Dehradun/Mussoorie stays pages until their booking-link coverage is non-zero (safest, reversible, ~1 line in `build_pages.py`'s robots-meta rewrite), then re-enable per city as links appear; separately, write real per-category paragraphs for Haridwar (has real inventory) instead of the one shared guide paragraph. Not yet implemented: `build_pages.py` had four other active/uncommitted edits in flight this session; needs the owner's go-ahead (noindexing is a judgment call on indexable surface area) and a clear run at the file once those settle.
1. CJ: **Booking.com approved us on 2026-10-07**; the site now uses link 17293139 (`kqzyfj.com`) (the old iframe search widget and its link 17323528 were removed 2026-10-17). Check in CJ that clicks and the first bookings appear.
2. AdSense: site verified (ads.txt) and review requested on 2026-10-04, status "Getting ready"; approval takes days to ~2 weeks. After approval, create a **vertical display unit** and put its slot in `UNITS.rail` in `assets/js/ads.js`.
3. **Google Search Console**: verify the domain (DNS TXT), submit `https://rishikeshhomestays.com/sitemap.xml`, check the Pages report weekly ("Discovered/Crawled, currently not indexed"), and Request indexing for top pages (~10 a day). Then **Bing Webmaster Tools**: import from Search Console, submit the same sitemap (Bing also gets IndexNow pings after every push). **Google Business Profile** for Advaitam if not claimed.
3b. **Disk space low** (2026-10-13 overnight watchdog, Mac): ~2.5 GB free of 460 GB (83% used), already throttling the booking search's `edge` worker to 2 shards via its own existing disk-safety cap (`maxWorkersForDisk()` — not new, not a crash risk tonight, just slower). Clear space when convenient; not touched automatically since it's the owner's call what's safe to remove.
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

- **Local DB for the booking-link search** (owner, 2026-10-12, long-term): replace the TSV files (`found.tsv`, `unfound.tsv`, `seen-pages.tsv`, `review.tsv`) with a small local database deployed alongside the app, so the search state isn't flat-file-based. OTA logos would be hosted separately (owner's own image hosting) rather than committed. Not scoped yet — pick the engine (SQLite is the natural fit: single file, no server, works identically on Windows/macOS per the cross-platform rule) and a migration path that doesn't interrupt the search mid-run. Logged here only; no schema or code yet.
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
