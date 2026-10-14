# Finding booking pages for our stays: how it works

Every stay on the site's stays pages gets a **View property** button that, after the lead popup, sends the guest
to the stay's own page on a booking site. This folder holds the search for those pages. A wrong link sends a guest
to the wrong hotel; a missing link costs little (the lead is still captured), so **when in doubt, it is not a match**.

## 1. The lists (this folder)

| File | What is in it |
|---|---|
| `all.tsv` | stays never searched yet; deleted on 2026-10-05 once every stay had been searched (never recreate it) |
| `found.tsv` | confirmed booking pages: `key, status, platform, url, note, name, city, source`; the note says why it matched |
| `unfound.tsv` | stays without a confirmed page, by `status`: `retry` (search again), `none` (searched well; not on a booking site, or a closed listing whose URL another stay already owns), `manual` (the name cannot identify it), `duplicate` (a second entry of a place already linked), `review` (only the owner can decide) |
| `review.tsv` | the owner's checklist: the page, what it shows, and why it is doubtful |

`found-by-property.tsv`, `found-links.tsv`, `found-duplicates.tsv` and `duplicates-resolved.tsv` were TSV files here;
since 2026-10 they are DB tables (`scripts/stays/.cache/stays.db`, schema in `scripts/stays/db.mjs`/`db.py`), not files
in this folder any more. `python3 scripts/stays/organise_found.py` reads `found.tsv` + `scripts/stays/ota-links.tsv` +
the Google Maps stays' links (the originals are never changed, nothing goes to BigQuery) and rebuilds, in full, every
run: **`found_properties`**, one row per property (`slug` our own, from the property's current name: lower case,
letters, digits and hyphens only; a name shared by several properties adds the area, then the city, then a number,
never a random suffix; `key`, `google_place_id` the `g-` keys without the prefix, `listing_id`, names, city, area,
lat/lng, a Maps link, `primary_ota`/`primary_url` the first site of `scripts/stays/ota-priority.tsv` that has a link,
`urls_json` one JSON `{ota: url}` entry per site, `sources`); and **`found_links`**, the same links one row each
(`key, slug, ota, rank, url, status, note, checked, source_file`). **Close duplicates are merged** into one
`found_properties` row (same booking-site page, or within 40 m with the same core name): the survivor is the stay the
site lists, else the shortest readable name; it learns the Google place id, listing id, coordinates and any booking
link it lacked, keeps the other keys in `alias_keys` and a different link of the same site in `other_urls`;
`found_duplicates` lists what went where. The booking-site order lives in one file, `scripts/stays/ota-priority.tsv`
(Booking.com first: the reliable pages; reorder there). Readers use `organise_found.linked_properties()` /
`links_rows()` (`import_new_stays.py`, `map_seen_pages.py`, `prune_unfound.py`, `booking_stays.taken_slugs()`).

Rows move between the TSV lists only through `scripts/stays/google_ota_search.mjs` (workers) and `scripts/stays/record_manual.mjs`
(checks by hand), under a lock, written atomically. Never edit and save these files while workers run: an editor's stale copy
would undo their work (an open editor tab may also show an old copy: close and reopen it).

`python3 scripts/stays/prune_unfound.py` takes out of `unfound.tsv` every stay that is already listed (owner, 2026-10-06). It checks the booking page's **URL first**: a `duplicate` row whose log names a page a linked stay already has (another Google Maps listing of the same property, say a room type) is recorded in `found.tsv` under its own key with that same page (`source` says so; Booking.com stays the priority link), so the file shows the page for every listing; the site still lists the property once (`merge_found.sh` drops "page already belongs to"). Then: a `duplicate` row whose "same place as" stay is linked, any `retry`/`none`/`manual` row within 40 m of a linked stay with the same core name and size (1BHK/2BHK/studio) and the same numbers ("Army House 2" is not "Army House 4"), or a stay that has a link by now. `review` rows stay (the owner's checklist). Each removed row is kept with its reason in the DB's `resolved_duplicates` table (append-only, keyed by `key`; `prune_unfound.resolved_duplicates_rows()`). Written under the lists lock, safe while the workers run; `--dry` shows what would go.

## 2. When a page is this stay

The page must be that site's **property page** (not a search, city or list page), **live** (a closed listing redirects or says
"no longer available"; **exception, owner 2026-10-06:** when the deep pass finds the stay's own property page and it is closed, that page is still assigned, noted `closed listing…` in found.tsv; `scripts/stays/assign_closed.mjs` moves earlier closed-listing rows the same way), and pass the name and the place:

- **Name** (`scripts/stays/ota-match.mjs`): the stay's distinctive words are on the page, in the right town; brand and unit clashes
  fail ("Zostel Tapovan" ≠ "Zostel Laxman Jhula", 1BHK ≠ 2BHK, different OYO numbers). Taglines, add-ons ("& Cats Cafe",
  "Wedding Banquet Garden"), known operators after "by" (Reet, Trindra, Around Stays, …), "Home Stay" = "Homestay" and
  landmark tails ("– Yog Nagari Railway Station") do not count against it.
- **Place** (`scripts/stays/ota-evidence.mjs`), from the page's own map pin (Booking's map, the property's JSON-LD or meta tags,
  never a "nearby hotels" pin) or the address it shows:
  - name fits: a match, unless the page's pin is over 2 km from ours (review);
  - name close (spelling slips, renamed listing): a match only when the pin is within 250 m, the page shows our PIN code and an
    address word, or the name matches in every word and the page names the stay's area (the town alone only backs an exactly
    spelt name); pin within 1 km, or two of our street words on the page: review;
  - right on our pin (within 100 m): a name of common words is enough;
  - a pin shared by 3+ of our stays is a placeholder: it never confirms a place, it only rules out far pages;
  - a page in another town (its link or title says Mussoorie, Delhi, …) is never this stay.
- **Already another stay's page**: the same place (pins within 250 m, close name, no brand difference) makes this row a
  `duplicate`; a page that fits this stay's name but not its owner's, or differs by a brand, goes to review.
- **Google Maps partners**: a booking link the place's own Google Maps page lists is confirmed by Google; with a close name it is a
  match, with a different name it goes to review.

Real cases: "Krishn Kunj home Stay" vs Booking's Krishna Kunj Homestay, pins 2.6 km apart: different places. "Aranyam In the
Village Homestay" vs Booking's Aranyam, 24 km apart: different. "MUSKAN RIVER RESORT" vs Agoda's "The Muskan Camp & Resort",
same village and PIN on the page: the same place.

## 3. How the search runs

- **Workers**: `scripts/stays/search_supervisor.mjs` runs deep retry searches on disjoint shards across Edge, Chrome,
  Opera, Brave, and (on macOS) headless Playwright Firefox. On macOS, Edge gets two of six shards because it has been the
  most productive browser; the others get one each. This gives Edge more of the queue, not a faster request pace. Idle browsers process separate, non-overlapping review shards
  while searches continue; productive workers restart or advance through their plan, and concurrency is capped as disk
  space falls. Opera was previously the steadiest browser; the supervisor uses available search results to change engines
  when one is blocked or unproductive. Logs:
  `scripts/stays/.cache/booking-search-*/`.
- **Order**: never-searched stays first (`all.tsv`, split between workers), likeliest first (guest reviews and a price);
  then the deep re-check of `retry` rows; review rows are re-opened and settled with the current rules (`--review`).
- **Per stay**: a Google Maps place first reads its booking partners in the managed browser, reusing one Maps tab per worker. It navigates to cached Maps URLs; it makes no Google Maps API calls and uses no Maps API key. Then searches the name with its area, `site:booking.com`
  (the preferred OTA), the MakeMyTrip/EaseMyTrip/Trip.com OR query, then one site at a time (Agoda, Airbnb, Hostelworld for
  hostels, OYO for OYO names, Goibibo, Expedia, Cleartrip). Every result is read
  with its title and snippet; the page is scrolled, then "More results" / the next page read, only when nothing near the top fits.
  **Stop for this stay as soon as an opened OTA page is verified as its property page**; do not search another OTA or engine
  for another link to the same stay. A suggested link that is unrelated or does not verify is not a match: continue checking
  relevant candidates and searches as usual. Other OTA property links from results are still harvested to the DB's `candidate_pages` table
  and handled by the separate seen-page flow below. A search with nothing like the stay is repeated on up to two other engines
  (DuckDuckGo finds the most, then Bing, Google, Brave Search).
- **Pages**: late titles are waited for; closed listings do not use up link slots (at most 3 per stay); a site is skipped for a
  stay only after two unreadable pages. MakeMyTrip and Goibibo often refuse automated browsers: never forced.
- **Pace and manners**: base gap 2–4 s between searches (tightened from 4–8 s on 2026-10-13, owner: "do it little faster
  than human now", after 10+ hours showed near-zero blocking); after 15 clean result pages, the worker adapts down to as
  low as 0.3x that (loosened from a 0.5x floor the same day). It slows after a challenge. A captcha is never solved or
  bypassed, and a block is never worked around (no proxies, VPNs
  or Tor); the affected engine rests, or waits for a person when explicitly configured. If all engines for a worker are resting
  or blocked, it retries after 3 minutes. One tab per engine, opened directly
  at its first search URL and reused through its search box; booking pages are closed as soon as they are read. Blank tabs
  are closed immediately (replacing a browser's sole blank tab with a Google home page first); search pages are kept while in
  use.
- **Candidate concurrency (owner, 2026-10-13):** a stay's booking-site candidate pages (Booking.com, Agoda,
  MakeMyTrip, …) are opened and read up to `--concurrency` at a time per worker (`CONCURRENCY` in
  `google_ota_search.mjs`, default 4 as of 2026-10-13 — raised from 2 the same day, paired with running
  fewer separate browser processes; see the capacity note below). This only
  parallelizes `check()` — reading a booking-site's own property page — never the search engine's results
  page: `search()` and its `jitter`/`pace`/`adjustPace` gap stay exactly as serial as before, one search at
  a time. Each candidate still gets its own tab (`openBackground`/`openPick`, closed in its own `finally`),
  so concurrent tabs never collide with each other or with the per-engine search tab (`tabKey`); a batch's
  URLs are added to `tried` synchronously before any of them is awaited, so two tabs never open the same
  page; a MATCH/DUPLICATE/REVIEW result still stops the stay immediately (no further batch starts) and
  still wins in the same order a serial run would have picked; list writes still go through the existing
  `.lists-lock` (`withLock`), so two concurrent "verified" results can't race on the same TSV row; a crash
  or timeout in one candidate's tab is caught inside `check()`'s own try/catch (it already returns
  `{ok:false, unreadable:true, ...}` on error) and never hangs or fails the rest of the batch.
- **By hand**: stays the workers cannot settle are checked in the owner's Chrome (Claude in Chrome, at most two agents per
  browser), recorded only through `record_manual.mjs` under the same rules; a second agent re-opens every link accepted.
  Directory and comparison sites (uttarakhand-hotels.com, tiket.com, Traveloka, Kayak, …) are skipped: they are not booking pages.

### Pages a search shows besides the stay (owner, 2026-10-06; auto-listing 2026-10-07)

Every results page shows other properties too. Per search the worker writes up to 6 booking-site property links into the DB's
`candidate_pages` table (`scripts/stays/db.mjs`/`db.py`; `candidate_pages.url` is the primary key), status `unchecked`
(`harvest()` in `google_ota_search.mjs`; nothing is opened there). `seen-pages.tsv`, `seen-pages-checked.tsv`,
`new-properties.tsv` and `new-properties-decisions.tsv` were TSV files here; since 2026-10 they are all one `candidate_pages`
row per page, carried through a `status` column (`unchecked` → `checked` → `held` / `imported` / `rejected`), not files in this
folder any more. `scripts/stays/verify_seen.mjs` opens `unchecked` rows **fast and in parallel** (headless, 8 at once, no images
or styles, DOM-ready only, the bot check solved once per run: about 2 pages a second) and UPDATEs each row to `checked` with
the name, the pin, the town and the evidence: the JSON-LD lodging type (`ltype`), where the name came from (`name_src`: `ld`
is the page's own data), the address `locality` and `postal`, `signals` (`rated` = a guest rating in the data, `bookable` = an
availability or reserve button) and the `final_url` after redirects (a redirect to another page makes the state `redirected`;
this per-check outcome lives in the `state` column, separate from the row's lifecycle `status`). Only a pin within 25 km of
Rishikesh or Haridwar counts, and **the town is the nearer of the two `cities.py` centres** (it used to be the first centre
within 25 km, so a Haridwar page could be stored as Rishikesh; the centres are now the `cities.py` ones, a test keeps them
equal). `--refresh-days N` re-opens `checked`/`held` rows whose state is `ok` that no stay of ours lists yet when they are
older than N days or have no evidence (a `held` row is included: its evidence may refresh and requalify it later).
`scripts/stays/map_seen_pages.py` then maps each `checked`/`held` row across by **distance only** (the city is worked out
again from the pin): to the stay **without a link** within **200 m** of the page's pin that reads as the same place (or is the
only one there), recorded in `found.tsv` and the row marked `imported` (`key` = that stay's, when it already has a DB
`properties` row); to a stay we **already list** as an *extra link* if its site has none yet (same `found.tsv` + `imported`
treatment); to a stay we already list whose site already has a *different* page (no `found.tsv` row to add, nothing new),
also marked `imported` (never a new-property candidate again); a page that matches no stay we have is simply left `checked`
-- it needs no separate list, it already **is** the new-property candidate. (Two checked pages matching the very same
unlinked stay in one run: the first takes the slot, the second is left `checked` rather than `imported` -- a transient,
per-run conflict, not a permanent one, so it is re-examined next run rather than risking a wrong, permanent verdict.) The
supervisor runs both every 30 minutes with `prune_unfound.py`.

**A new property is auto-listed (owner, 2026-10-07: "no listing in Rishikesh or Haridwar should be missed").** `scripts/stays/import_new_stays.py` (a step of `merge_found.sh`; the supervisor only runs its `--dry` for a status line) reads every `candidate_pages` row with status `checked` or `held`, and lists the ones that pass every check as a **new stay** with that booking link, like the Google Maps stays but with no `gm` flag (its pin is the booking page's own, so it gets our map, landmark pages and the normal order). Its identity lives in the committed, append-only registry `scripts/stays/booking-stays.tsv` (`process.py` reads it; slugs are permanent, never recomputed); its verified link is written to `ota-links.tsv` (commit both together, or a CI refresh would drop the stay). A candidate is listed only when **all** hold:
- the page was read `ok` (a pin from its own data, not dead, still the same property page after redirects);
- its site is `autolist=y` in `scripts/stays/ota-priority.tsv` (Booking.com, Agoda, MakeMyTrip, Goibibo, Trip.com, Expedia, Hotels.com, EaseMyTrip, OYO, Hostelworld; **not** Airbnb, whose pins are offset and listings single rooms, nor Trivago, a meta-search);
- the page's data has a lodging type and the name is from that data (not the browser title);
- the name is sane: 2-8 words, Latin script, not a list or marketing title ("best", "top 10", "hotels in", "reviews", "deals"), at least one distinctive word, and a word shared with the URL's slug;
- it is open for booking (an availability or reserve button, or a guest rating);
- the pin is within 25 km of the nearer centre (that centre is the city) and the page was read within 14 days.

Anything else is `held` with its reason on the row's own `decision_why` (status stays `checked`, on purpose: a held row is re-examined every run in case its evidence refreshed, the same way `new-properties.tsv` never dropped a row), never silently dropped. A terminal decision (`listed`/`extra_link` → status `imported`, `key` = the slug when it already has a DB `properties` row; `duplicate`/`out_of_scope` → status `rejected`) stops that row being re-considered. **Duplicates are blocked in this order**: (1) the page's **URL** (a URL a stay already has, in `found.tsv`, the DB's `found_links` table, `ota-links.tsv`, the places' links, `review.tsv`, the DB's `resolved_duplicates` table or a `duplicate` row of `unfound.tsv`, is never a new stay); (2) a **pin within 200 m and the same name and size** (1BHK is not 2BHK) against every stay we have: the site, the crawl, our own 3, **all** Google Maps places and the registry; (3) a **near miss** (the same pin test, a fuzzy name) is held, not listed: a wrong duplicate is worse than a delayed listing. The **same property on several sites is one stay**: Booking.com (first in `ota-priority.tsv`) is the primary link, the other sites are `extra_links`; a better-ranked page that arrives later swaps the primary (slug, name and listing id never change). A second page of one site for a stay we list is held. Read the held rows after the first dry run (`import_new_stays.py --dry --verbose`) before loosening a rule. **Reality check:** headless reads Booking.com pages well and little else (Agoda, Goibibo and MakeMyTrip are mostly blocked, Airbnb has no pin), so until the phase 2 reads exist (README, "Booking-found stays") the importer lists almost only Booking.com properties; `npm run report:coverage` shows this plainly.

## 4. Onto the site

`scripts/stays/merge_found.sh` is the one way verified links reach the site (never copy rows by hand). BigQuery is **off by default** (owner, 2026-10-06): the script writes the local files `push_places.mjs` makes but loads nothing; `--bigquery` loads `places_lodging`, and `push_bigquery.mjs` stays a separate step. The stays lists are then ordered by `order_stays()` (promising brands, one of each letter in turn, bad ratings behind "View all": CLAUDE.md).


Found links reach the stays pages only when merged: `scripts/stays/postcheck_matches.py` → `merge_ota.py` → the places pipeline
(`push_places.mjs`, `import_google_stays.py`) → `process.py` → `build_pages.py` → `push_bigquery.mjs`, then a commit and push.
Booking.com links get the CJ affiliate wrapper on the way (`assets/js/modules/affiliate-links.js`); never add `aid=`.

**Merge and push, step by step** (a merge is safe while the workers run; do the push when you decide to). BigQuery is its own, later step.
1. `scripts/stays/merge_found.sh --dry`: shows how many rows are new and which are dropped ("page already belongs to": another listing of a stay we already link), and what `import_new_stays.py --dry` would auto-list.
2. `scripts/stays/merge_found.sh`: snapshots `found.tsv`, merges, auto-lists the new properties (`import_new_stays.py`: the registry `scripts/stays/booking-stays.tsv` and their `ota-links.tsv` rows), rebuilds both cities and runs `check:stays`. Backups and inputs go to `scripts/stays/.cache/booking-search-*/merge-<date>/` (gitignored). It writes the local places files but loads **nothing** into BigQuery.
3. `npm test` (about 3 minutes, all must pass) and `npm run i18n:status` (every language "complete").
4. Only when the owner says so: `git add -A` (the lists in `docs/booking-links/`, `scripts/stays/ota-links.tsv` **and `scripts/stays/booking-stays.tsv` together**, `scripts/stays/listing-ids.tsv`, the rebuilt `hotels/` pages, `assets/js/modules/stays-index-data*.js`, `sitemap.xml`, `llms*.txt`, `assets/search/index.json`, `i18n/`), commit, `git push`. A push that changes `sitemap.xml` pings IndexNow (`.github/workflows/indexnow.yml`) and Vercel deploys; check one new stay on the live site.
5. Later, only when the owner says so: `node scripts/stays/push_bigquery.mjs` (directory stays) and `merge_found.sh --bigquery` / `node scripts/stays/push_places.mjs` (Google Maps places).
`npm run report:coverage` (read-only, local files and the DB) shows what we list per city (directory / Google Maps / booking-found, linked and unlinked), the search's open work, the seen pages by state and site, what `import_new_stays.py` decided (the DB's `candidate_pages` rows), and an estimate of what is still uncovered.
Never push from a second machine while the first still has unpushed list changes: the lists are plain files and a git merge of them is not safe (see §5, one machine at a time).

## 5. Running the search (Windows and macOS)

The search can move between the Mac and a Windows laptop (owner, 2026-10-06). **One machine runs it at a time**: the lists are plain files the workers rewrite, so the Mac stops before Windows starts and the other way round. **The commands are the same on both machines** (`scripts/search-ctl.mjs` picks browser paths, profile folders, keep-awake and process handling from the OS it runs on):

| Command | What it does |
|---|---|
| `npm run search:browsers` | opens the search browsers **in the background** (owner, 2026-10-08: they never take focus: macOS `open -g -j` and then the app is hidden, Windows minimized, Linux `--start-minimized`; the workers open their tabs in the background too) on ports 9223 (Opera), 9224 (Brave), 9225 (Edge), and their **second, independent instances** 9227 (Opera2), 9228 (Brave2), 9229 (Edge2) on google.com, **all in a private window (Opera/Brave/their "2" twins) or with extensions off (Edge/Edge2)** (each already listening is left alone), and prints which answer; `--all` also opens Chrome (9222) and Chrome2 (9226). Add `--exclude brave` to skip Brave (and only Brave, not Brave2) without launching it. |
| `npm run setup` | **checks this machine and installs only what is missing** (Node.js 20+, Python 3, Git, Opera, Brave, Edge, the npm packages, Playwright's Chromium; Homebrew on the Mac, winget on Windows, a hint on Linux). Anything already installed is left alone, never reinstalled; `-- --check` only reports, `-- --all` adds the spare Chrome. Windows: `scripts\windows\setup.ps1` (installs Node, Python and Git if missing, then runs the same command); Mac: `sh scripts/mac/setup.sh` |
| `npm run search:start` | starts the supervisor detached and hidden, keeps the machine awake (Windows: `powercfg` never sleep on AC; macOS: `caffeinate` for as long as the supervisor lives), then shows the status. On macOS it hides the managed browser apps again after workers attach, since attaching can surface them. It refuses, and says why, when a supervisor already runs, when the search cache (below) is missing, or when a debugging port does not answer (it names the port). Pass the same `--exclude brave` to leave its worker out. |
| `npm run search:status` | supervisor and worker pids, the ports, found/unfound/review counts, the last supervisor log lines |
| `npm run search:stop` | stops the supervisor FIRST, then every worker, then checks nothing is left (exit 1 if something is); `-- --close-browsers` (or `node scripts/search-ctl.mjs stop --close-browsers`) also closes the search browsers |
| `node scripts/search-ctl.mjs trim` | **the memory rule** (below): closes browsers that are not search browsers, but always preserves the owner's personal Brave; `--all` closes search browsers too, `--dry` only counts |

`scripts/windows/setup.ps1` (one-time installs) is Windows-only; `scripts\windows\start-browsers.ps1` and `start-search.ps1 [-Status|-Stop]` are thin wrappers that run the same commands. **First-run checks on Windows done 2026-10-07** (status, port check and stop against the four open browsers); the full start has not yet run on real Windows: do the first-run check at the end of this section and report what differs.

**Memory rule and one-click files (owner, 2026-10-07: "I don't need any browser for myself, manage them yourself").** Five headed browsers previously left about 0.4 GB free on the 16 GB laptop, tabs stopped answering, and search engines rested. Per the owner's later request, the pool now includes the four installed Chromium browsers plus headless Firefox on macOS; free disk still caps worker concurrency (under 1 GB pauses all workers).

**Current state, not just the designed capability (2026-10-13):** this Mac's 2 GB swap can't sustain the doubled
8-10 worker setup below plus `--concurrency 4` — it caused two forced shutdowns overnight (2026-10-12/13) before a
real bug in `search-ctl.mjs`'s `--exclude` flag was found and fixed (it silently did nothing, so the supervisor kept
trying to run every worker and crash-looped on the ones with no browser up). The search runs conservatively right
now: 3 workers (opera/brave/edge, `--exclude opera2,brave2,edge2,chrome2,firefox2,chrome,firefox`), managed by a
detached, session-local watchdog script (not committed — lives in a scratch directory for the session that set it
up) that stops it on real memory danger (pressure/swap, not raw load average, which is noisy from unrelated system
activity) and restarts it once calm, with event-driven idle-worker detection (watches the supervisor's own
`"<name>: finished"` log lines) rather than a blind timer. The doubled-capacity design below is real and tested, just
not what's running today on this machine — a machine with more free memory could run it as documented.

**Doubled capacity (owner, 2026-10-12): a second, independent instance of each engine.** `chrome2`/`opera2`/`brave2`/`edge2` (and a second headless Firefox worker on macOS) run alongside the originals: same installed app, a second launch with its own profile folder and its own fixed debugging port (`scripts/lib/browser-specs.mjs`), never the owner's personal everyday browser windows. The supervisor doubles its shard count and splits it in half — the first half for the original five, the second half for their "2" twins — so the extra workers search previously-uncovered rows instead of redoing the same shard. Each "2" instance is fully independent: it does not require its "1" counterpart to be up (per the owner, Brave's original port 9224 may stay down while Brave2 on 9228 runs on its own).
1. **Eight attached browser workers plus two headless Firefox workers on macOS** (Opera, Brave, Edge, Chrome and their "2" twins, plus Firefox/Firefox2; the supervisor's `WORKERS` list). Windows/Linux run the eight debugging-port browsers (no Firefox). Chrome and Chrome2 open only with `--all`; Firefox/Firefox2 use Playwright's separately installed runtime and are not normal Firefox.app windows.
2. **Private window, no extensions** for the attached search browsers (`--private` Opera, `--incognito` Brave, `--disable-extensions`): extensions are the biggest idle memory. Edge stays a normal window (its InPrivate window hides the tabs the workers open: tested 2026-10-07). A private window forgets cookies on close, so accept each browser's cookie banner once after `search:browsers`.
3. **Other browsers are closed when memory is tight; personal Brave is always preserved**: the supervisor runs `node scripts/search-ctl.mjs trim` (at most every 10 minutes) when free memory is under 0.8 GB on Windows (1.5 GB on Linux; macOS: pressure level or swap), and `scripts\windows\search-start.bat` runs it first. It kills browser processes (chrome, opera, msedge, firefox) that are not in the process tree of a search browser (started with `--remote-debugging-port` and the `rh-search` profile) or a managed Firefox search worker, but never Brave or its child processes. Claude Desktop, VS Code and Edge WebView2 are never matched. A few processes may refuse to close (access denied): they are left.
4. **Idle tabs are closed** (owner, 2026-10-07: "close tabs that are not in use"): workers open search tabs directly at a search URL, never as blank placeholders. A blank tab is closed on the next supervisor sweep (every 5 minutes), immediately if another tab exists; if it is the only tab, a Google home page is opened before it is closed. A booking page is closed as soon as it is read. Browser start pages and google.com's home page are closed after sitting unchanged for two sweeps. Worker results pages are kept. `search-stop.bat` closes the search browsers altogether.
5. **No extra load next to the workers**: no parallel hand-check agents or second scripts driving the same browsers while the workers run (2026-10-07: four agents on the same browsers got nothing done).
6. **Do not try ReadyBoost** (a USB drive as cache): Windows turns it off on an SSD, and a flash drive is slower than the laptop's disk anyway. The cure for short memory is fewer processes (this rule), not a faster pagefile. More RAM (a 32 GB laptop) would be the real fix.

One-click files for Windows in `scripts\windows\`: `search-start.bat` (trim, browsers, start), `search-stop.bat` (stop and close the search browsers), `search-status.bat`, `search-trim.bat [--all|--dry]`. They only run the commands above, from the repo folder, whatever the current directory. The same commands work on macOS by npm or `node scripts/search-ctl.mjs`.

**New Windows machine or reinstall**: `scripts\windows\setup.ps1` (installs Git, Node, Python, the browsers, npm packages, Playwright's Chromium), unpack the search cache (`rh-search-cache.tgz`, "Move it over"), double-click `search-start.bat`. Nothing in the code depends on this machine's user name or drive.

**Browsers needed** (the search drives these browsers over a debugging port, one worker per browser; Opera must stay in the set; Chrome is the optional spare):

| Browser | Port | Installed by `setup.ps1` (winget id) | Usual path |
|---|---|---|---|
| Google Chrome | 9222 | `Google.Chrome` | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Opera | 9223 | `Opera.Opera` | `%LOCALAPPDATA%\Programs\Opera\opera.exe` |
| Brave | 9224 | `Brave.Brave` | `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` |
| Microsoft Edge | 9225 | part of Windows | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| Chrome2 (2nd instance) | 9226 | same app as Chrome | same exe, its own `rh-search\chrome2` profile |
| Opera2 (2nd instance) | 9227 | same app as Opera | same exe, its own `rh-search\opera2` profile |
| Brave2 (2nd instance) | 9228 | same app as Brave | same exe, its own `rh-search\brave2` profile |
| Edge2 (2nd instance) | 9229 | same app as Edge | same exe, its own `rh-search\edge2` profile |

Also installed: Node.js LTS, Python 3, Git, the repo's npm packages and Playwright's own Chromium (`verify_seen.mjs` uses it for the fast page checks; it never searches). Each browser runs with its own profile folder (Windows `%LOCALAPPDATA%\rh-search\<name>`, macOS `~/Library/Application Support/rh-search/<name>`, Linux `~/.local/share/rh-search/<name>`; Chrome 136+ ignores a debugging port on your everyday profile): open google.com in each once, sign in if you like, and use them normally for a day; a brand-new profile is challenged more. Captchas: solve them yourself, the worker waits; nothing here evades a block.

**Move it over**
1. On the machine that runs it now: `npm run search:stop` (supervisor first, then the workers, then it checks nothing is left), then commit and push the lists: `git add docs/booking-links scripts/stays/ota-links.tsv scripts/stays/booking-stays.tsv`, commit, push. Also pack the search's cache (gitignored, 5 files, about 5 MB): `tar -czf rh-search-cache.tgz -C scripts/stays .cache/stays.json .cache/haridwar/stays.json .cache/places/places.json .cache/places/all-stays.json .cache/places/ota-links.tsv`, and copy the archive over (AirDrop, USB, cloud drive).
2. On Windows: install Git, `git clone` the repo (or `git pull`), then in PowerShell from the repo folder: `powershell -ExecutionPolicy Bypass -File scripts\windows\setup.ps1`. Unpack the cache: `tar -xzf rh-search-cache.tgz -C scripts\stays`.
3. `npm run search:browsers -- --all` (opens the four attached browsers on ports 9222-9225, prints which answer), then `npm run search:start`. On macOS install the Playwright Firefox runtime once with `npx playwright install firefox`. `npm run search:status` shows counts and workers.
4. Back to the other machine later: `npm run search:stop`, commit and push the lists, `git pull` there. `merge_found.sh` (the step that puts links on the site) runs on either machine: `scripts/stays/merge_found.sh` on the Mac, `bash scripts/stays/merge_found.sh` from Git Bash on Windows (use Git Bash, not a bare `bash` from PowerShell, which can be WSL). It finds Python itself through `scripts/py.mjs` (`python3` on macOS, `python` or `py -3` on Windows; there is no override), so no export is needed. BigQuery stays off unless asked.

**What Windows will ask you to approve (once each)**
| When | What you see | Do |
|---|---|---|
| `setup.ps1` | UAC "Do you want to allow this app to make changes" for each winget install | Yes |
| `setup.ps1` | PowerShell execution policy | run with `-ExecutionPolicy Bypass` as shown |
| first `node` run | Windows Defender Firewall "allow node.js on private networks" (it only talks to localhost) | Allow, private networks only |
| first start of each browser | welcome / default-browser / sync pages | close them; keep the window open |
| first search per engine | cookie banner, sometimes a captcha | accept / solve it yourself |
| `npm run search:start` | none; on Windows it sets "never sleep on AC" with `powercfg` | keep the charger in |
| Claude Code on that laptop (only if you babysit with it) | a prompt per new command | allow the list below once ("don't ask again") |

Claude Code allow-list for that laptop (paste into `.claude\settings.local.json` of the repo; these only run the search, the checks and read the lists):
```json
{ "permissions": { "allow": [
  "Bash(node scripts/stays/*)", "Bash(python scripts/stays/*)", "Bash(python3 scripts/stays/*)", "Bash(npm test)", "Bash(npm run *)",
  "Bash(git status*)", "Bash(git diff*)", "Bash(git pull*)", "Bash(git add docs/booking-links*)", "Bash(git commit*)", "Bash(git push*)",
  "Bash(npm run search:*)", "Bash(tar *)", "Read(docs/**)", "Read(scripts/**)" ] } }
```
A prompt that waits more than four minutes stalls its lane: keep the pending list in `scripts/stays/.cache/booking-search-*/pending-approvals.md` and approve in bulk when you are back.

**First-run check on Windows** (report any line that differs): `node --version` (20+), `node scripts/py.mjs --version` (3.10+; it picks `python3`, `python` or `py -3` and forces UTF-8), `node scripts/stays/verify_seen.mjs --limit 1` prints a line, `node scripts/py.mjs scripts/stays/prune_unfound.py --dry` prints a count, `npm run search:browsers` shows eight "ready" (chrome/opera/brave/edge and their "2" twins), `npm run search:start` then `npm run search:status` shows eight workers (chrome, opera, brave, edge, chrome2, opera2, brave2, edge2) and the log grows, and `docs\booking-links\found.tsv` has no `\r` (the `.gitattributes` keeps LF).
