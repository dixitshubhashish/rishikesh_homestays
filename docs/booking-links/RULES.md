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
| `found-by-property.tsv` | **generated copy** of the found links, one row per property, the booking sites as columns (`booking_com_url`, `agoda_url`, …, Booking.com first): `slug` (our own, from the property's current name: lower case, letters, digits and hyphens only; a name shared by several properties adds the area, then the city, then a number, never a random suffix), `key`, `google_place_id` (the `g-` keys without the prefix), `listing_id`, names, city, area, lat/lng, a Maps link, `primary_ota`/`primary_url` (first site of `scripts/stays/ota-priority.tsv` that has a link) and `sources`. A new verified link goes into its site's column. **Close duplicates are merged** into one row (same booking-site page, or within 40 m with the same core name): the survivor is the stay the site lists, else the shortest readable name; it learns the Google place id, listing id, coordinates and any booking link it lacked, keeps the other keys in `alias_keys` and a different link of the same site in `other_urls`; `found-duplicates.tsv` lists what went where. Rows are sorted by city, then slug. No phone numbers (BigQuery `places_lodging` only). |
| `found-links.tsv` | the same links one per row with everything the lists hold (`key, slug, ota, rank, url, status, note, checked, source_file`) |
| `review.tsv` | the owner's checklist: the page, what it shows, and why it is doubtful |

Rows move between the lists only through `scripts/stays/google_ota_search.mjs` (workers) and `scripts/stays/record_manual.mjs`
(checks by hand), under a lock, written atomically. Never edit and save these files while workers run: an editor's stale copy
would undo their work (an open editor tab may also show an old copy: close and reopen it).

`python3 scripts/stays/prune_unfound.py` takes out of `unfound.tsv` every stay that is already listed (owner, 2026-10-06). It checks the booking page's **URL first**: a `duplicate` row whose log names a page a linked stay already has (another Google Maps listing of the same property, say a room type) is recorded in `found.tsv` under its own key with that same page (`source` says so; Booking.com stays the priority link), so the file shows the page for every listing; the site still lists the property once (`merge_found.sh` drops "page already belongs to"). Then: a `duplicate` row whose "same place as" stay is linked, any `retry`/`none`/`manual` row within 40 m of a linked stay with the same core name and size (1BHK/2BHK/studio) and the same numbers ("Army House 2" is not "Army House 4"), or a stay that has a link by now. `review` rows stay (the owner's checklist). Each removed row is kept with its reason in `duplicates-resolved.tsv`. Written under the lists lock, safe while the workers run; `--dry` shows what would go.

Both generated files come from `python3 scripts/stays/organise_found.py` (found.tsv + `scripts/stays/ota-links.tsv` + the Google Maps stays' links; the originals are never changed and nothing goes to BigQuery). The booking-site order lives in one file, `scripts/stays/ota-priority.tsv` (Booking.com first: the reliable pages; reorder there).

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

- **Workers**: `scripts/stays/search_supervisor.mjs` keeps them running (one per browser, two in Edge, the least blocked: 2026-10-06 logs show 2 all-engine stalls in 707 stays against Opera's 27 in 1,191; Opera runs one), restarts
  crashed or stalled ones, pauses all when the disk is under 3 GB (5 minutes at a time). Never more than three browsers on this
  Mac: a fourth filled the disk twice. Logs: `scripts/stays/.cache/booking-search-*/`.
- **Order**: never-searched stays first (`all.tsv`, split between workers), likeliest first (guest reviews and a price);
  then the deep re-check of `retry` rows; review rows are re-opened and settled with the current rules (`--review`).
- **Per stay**: a Google Maps place first reads its booking partners. Then searches: the name with its area, `site:booking.com`,
  one OR search for MakeMyTrip, Goibibo, Agoda, Trip.com and EaseMyTrip, then one site at a time (Agoda, Airbnb, Hostelworld for
  hostels, OYO for OYO names, Trip.com, EaseMyTrip, Goibibo, MakeMyTrip, Expedia, Hotels.com, Cleartrip). Every result is read
  with its title and snippet; the page is scrolled, then "More results" / the next page read, only when nothing near the top fits.
  A search with nothing like the stay is repeated on up to two other engines (DuckDuckGo finds the most, then Bing, Google,
  Brave Search).
- **Pages**: late titles are waited for; closed listings do not use up link slots (at most 3 per stay); a site is skipped for a
  stay only after two unreadable pages. MakeMyTrip and Goibibo often refuse automated browsers: never forced.
- **Pace and manners**: 6–12 s between searches, up to 1.5x slower after a captcha, faster after clean pages. A captcha is never
  solved and a block never worked around (no proxies, VPNs or Tor). One tab per engine, reused through its search box; booking
  pages are closed as soon as they are read; leftover and empty tabs are closed (never the owner's own tabs or windows).
- **By hand**: stays the workers cannot settle are checked in the owner's Chrome (Claude in Chrome, at most two agents per
  browser), recorded only through `record_manual.mjs` under the same rules; a second agent re-opens every link accepted.
  Directory and comparison sites (uttarakhand-hotels.com, tiket.com, Traveloka, Kayak, …) are skipped: they are not booking pages.

### Pages a search shows besides the stay (owner, 2026-10-06; auto-listing 2026-10-07)

Every results page shows other properties too. Per search the worker writes up to 6 booking-site property links to `seen-pages.tsv` (`harvest()` in `google_ota_search.mjs`; nothing is opened there). `scripts/stays/verify_seen.mjs` opens them **fast and in parallel** (headless, 8 at once, no images or styles, DOM-ready only, the bot check solved once per run: about 2 pages a second) and writes the name, the pin, the town and the evidence to `seen-pages-checked.tsv`: the JSON-LD lodging type (`ltype`), where the name came from (`name_src`: `ld` is the page's own data), the address `locality` and `postal`, `signals` (`rated` = a guest rating in the data, `bookable` = an availability or reserve button) and the `final_url` after redirects (a redirect to another page makes the state `redirected`). Only a pin within 25 km of Rishikesh or Haridwar counts, and **the town is the nearer of the two `cities.py` centres** (it used to be the first centre within 25 km, so a Haridwar page could be stored as Rishikesh; the centres are now the `cities.py` ones, a test keeps them equal). `--refresh-days N` re-opens `ok` pages that no stay of ours lists yet when they are older than N days or have no evidence. `scripts/stays/map_seen_pages.py` then maps each such page across by **distance only** (the city is worked out again from the pin): to the stay **without a link** within **200 m** of the page's pin that reads as the same place (or is the only one there), recorded in `found.tsv`; to a stay we **already list** as an *extra link* if its site has none yet; and a page that matches no stay we have goes to `new-properties.tsv`. The supervisor runs both every 30 minutes with `prune_unfound.py`.

**A new property is auto-listed (owner, 2026-10-07: "no listing in Rishikesh or Haridwar should be missed").** `scripts/stays/import_new_stays.py` (a step of `merge_found.sh`; the supervisor only runs its `--dry` for a status line) takes every row of `new-properties.tsv`, joins the page's evidence, and lists the ones that pass every check as a **new stay** with that booking link, like the Google Maps stays but with no `gm` flag (its pin is the booking page's own, so it gets our map, landmark pages and the normal order). Its identity lives in the committed, append-only registry `scripts/stays/booking-stays.tsv` (`process.py` reads it; slugs are permanent, never recomputed); its verified link is written to `ota-links.tsv` (commit both together, or a CI refresh would drop the stay). A candidate is listed only when **all** hold:
- the page was read `ok` (a pin from its own data, not dead, still the same property page after redirects);
- its site is `autolist=y` in `scripts/stays/ota-priority.tsv` (Booking.com, Agoda, MakeMyTrip, Goibibo, Trip.com, Expedia, Hotels.com, EaseMyTrip, OYO, Hostelworld; **not** Airbnb, whose pins are offset and listings single rooms, nor Trivago, a meta-search);
- the page's data has a lodging type and the name is from that data (not the browser title);
- the name is sane: 2-8 words, Latin script, not a list or marketing title ("best", "top 10", "hotels in", "reviews", "deals"), at least one distinctive word, and a word shared with the URL's slug;
- it is open for booking (an availability or reserve button, or a guest rating);
- the pin is within 25 km of the nearer centre (that centre is the city) and the page was read within 14 days.

Anything else is `held` with its reason in `new-properties-decisions.tsv` (one row per candidate: `url, platform, name, decision, why, slug, decided`; decisions `listed`, `extra_link`, `held`, `duplicate`, `out_of_scope`), never silently dropped. **Duplicates are blocked in this order**: (1) the page's **URL** (a URL a stay already has, in `found.tsv`, `found-links.tsv`, `ota-links.tsv`, the places' links, `review.tsv`, `duplicates-resolved.tsv` or a `duplicate` row of `unfound.tsv`, is never a new stay); (2) a **pin within 200 m and the same name and size** (1BHK is not 2BHK) against every stay we have: the site, the crawl, our own 3, **all** Google Maps places and the registry; (3) a **near miss** (the same pin test, a fuzzy name) is held, not listed: a wrong duplicate is worse than a delayed listing. The **same property on several sites is one stay**: Booking.com (first in `ota-priority.tsv`) is the primary link, the other sites are `extra_links`; a better-ranked page that arrives later swaps the primary (slug, name and listing id never change). A second page of one site for a stay we list is held. Read the held rows after the first dry run (`import_new_stays.py --dry --verbose`) before loosening a rule. **Reality check:** headless reads Booking.com pages well and little else (Agoda, Goibibo and MakeMyTrip are mostly blocked, Airbnb has no pin), so until the phase 2 reads exist (README, "Booking-found stays") the importer lists almost only Booking.com properties; `npm run report:coverage` shows this plainly.

## 4. Onto the site

`scripts/stays/merge_found.sh` is the one way verified links reach the site (never copy rows by hand). BigQuery is **off by default** (owner, 2026-10-06): the script writes the local files `push_places.mjs` makes but loads nothing; `--bigquery` loads `places_lodging`, and `push_bigquery.mjs` stays a separate step. The stays lists are then ordered by `order_stays()` (promising brands, one of each letter in turn, bad ratings behind "View all": CLAUDE.md).


Found links reach the stays pages only when merged: `scripts/stays/postcheck_matches.py` → `merge_ota.py` → the places pipeline
(`push_places.mjs`, `import_google_stays.py`) → `process.py` → `build_pages.py` → `push_bigquery.mjs`, then a commit and push.
Booking.com links get the CJ affiliate wrapper on the way (`assets/js/modules/affiliate-links.js`); never add `aid=`.

**Merge and push, step by step** (a merge is safe while the workers run; do the push when you decide to). BigQuery is its own, later step.
1. `scripts/stays/merge_found.sh --dry`: shows how many rows are new and which are dropped ("page already belongs to": another listing of a stay we already link), and what `import_new_stays.py --dry` would auto-list.
2. `scripts/stays/merge_found.sh`: snapshots `found.tsv`, merges, auto-lists the new properties (`import_new_stays.py`: the registry `scripts/stays/booking-stays.tsv` and their `ota-links.tsv` rows), rebuilds both cities and runs `check:stays`. Backups and inputs go to `scripts/stays/.cache/booking-search-*/merge-<date>/` (gitignored). It writes the local places files but loads **nothing** into BigQuery.
3. `npm test` (about 3 minutes, all must pass) and `npm run i18n:status` (every language "complete").
4. Only when the owner says so: `git add -A` (the lists in `docs/booking-links/` incl. `new-properties-decisions.tsv`, `scripts/stays/ota-links.tsv` **and `scripts/stays/booking-stays.tsv` together**, `scripts/stays/listing-ids.tsv`, the rebuilt `hotels/` pages, `assets/js/modules/stays-index-data*.js`, `sitemap.xml`, `llms*.txt`, `assets/search/index.json`, `i18n/`), commit, `git push`. A push that changes `sitemap.xml` pings IndexNow (`.github/workflows/indexnow.yml`) and Vercel deploys; check one new stay on the live site.
5. Later, only when the owner says so: `node scripts/stays/push_bigquery.mjs` (directory stays) and `merge_found.sh --bigquery` / `node scripts/stays/push_places.mjs` (Google Maps places).
`npm run report:coverage` (read-only, local files) shows what we list per city (directory / Google Maps / booking-found, linked and unlinked), the search's open work, the seen pages by state and site, what `new-properties-decisions.tsv` decided, and an estimate of what is still uncovered.
Never push from a second machine while the first still has unpushed list changes: the lists are plain files and a git merge of them is not safe (see §5, one machine at a time).

## 5. Running the search (Windows and macOS)

The search can move between the Mac and a Windows laptop (owner, 2026-10-06). **One machine runs it at a time**: the lists are plain files the workers rewrite, so the Mac stops before Windows starts and the other way round. **The commands are the same on both machines** (`scripts/search-ctl.mjs` picks browser paths, profile folders, keep-awake and process handling from the OS it runs on):

| Command | What it does |
|---|---|
| `npm run search:browsers` | opens the three search browsers **in the background** (owner, 2026-10-08: they never take focus: macOS `open -g -j` and then the app is hidden, Windows minimized, Linux `--start-minimized`; the workers open their tabs in the background too) on ports 9223 (Opera), 9224 (Brave) and 9225 (Edge) on google.com, **Opera and Brave in a private window, all three with extensions off** (each already listening is left alone), and prints which answer; `--all` also opens Chrome (9222), a spare the supervisor does not use |
| `npm run setup` | **checks this machine and installs only what is missing** (Node.js 20+, Python 3, Git, Opera, Brave, Edge, the npm packages, Playwright's Chromium; Homebrew on the Mac, winget on Windows, a hint on Linux). Anything already installed is left alone, never reinstalled; `-- --check` only reports, `-- --all` adds the spare Chrome. Windows: `scripts\windows\setup.ps1` (installs Node, Python and Git if missing, then runs the same command); Mac: `sh scripts/mac/setup.sh` |
| `npm run search:start` | starts the supervisor detached and hidden, keeps the machine awake (Windows: `powercfg` never sleep on AC; macOS: `caffeinate` for as long as the supervisor lives), then shows the status. It refuses, and says why, when a supervisor already runs, when the search cache (below) is missing, or when a debugging port does not answer (it names the port) |
| `npm run search:status` | supervisor and worker pids, the ports, found/unfound/review counts, the last supervisor log lines |
| `npm run search:stop` | stops the supervisor FIRST, then every worker, then checks nothing is left (exit 1 if something is); `-- --close-browsers` (or `node scripts/search-ctl.mjs stop --close-browsers`) also closes the search browsers |
| `node scripts/search-ctl.mjs trim` | **the memory rule** (below): closes every browser that is not a search browser; `--all` the search browsers too, `--dry` only counts |

`scripts/windows/setup.ps1` (one-time installs) is Windows-only; `scripts\windows\start-browsers.ps1` and `start-search.ps1 [-Status|-Stop]` are thin wrappers that run the same commands. **First-run checks on Windows done 2026-10-07** (status, port check and stop against the four open browsers); the full start has not yet run on real Windows: do the first-run check at the end of this section and report what differs.

**Memory rule and one-click files (owner, 2026-10-07: "I don't need any browser for myself, manage them yourself").** The laptop in use has 16 GB; five browsers with their extensions left about 0.4 GB free, tabs stopped answering, every search engine "rested" and the workers found a handful of links in three hours. So:
1. **Three workers, three browsers** (Opera, Brave, Edge; the supervisor's `WORKERS` list). Chrome is a spare. A fourth browser costs about 1 GB.
2. **Private window, no extensions** for the search browsers (`--private` Opera, `--incognito` Brave, `--disable-extensions` all three): extensions are the biggest idle memory. Edge stays a normal window (its InPrivate window hides the tabs the workers open: tested 2026-10-07). A private window forgets cookies on close, so accept each browser's cookie banner once after `search:browsers`.
3. **Every other browser is closed when memory is tight**: the supervisor runs `node scripts/search-ctl.mjs trim` (at most every 10 minutes) when free memory is under 0.8 GB on Windows (1.5 GB on Linux; macOS: pressure level or swap), and `scripts\windows\search-start.bat` runs it first. It kills browser processes (chrome, brave, opera, msedge, firefox) that are not in the process tree of a search browser (started with `--remote-debugging-port` and the `rh-search` profile), the owner's own windows included. Claude Desktop, VS Code and Edge WebView2 are never matched. A few processes may refuse to close (access denied): they are left.
4. **Idle tabs are closed** (owner, 2026-10-07: "close tabs that are not in use"): a booking page is closed the moment a worker has read it, and every 5 minutes the supervisor also closes a blank tab, a browser start page or google.com's home page that sat unchanged for two sweeps (never a browser's last tab, never a worker's results page). `search-stop.bat` closes the search browsers altogether.
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

Also installed: Node.js LTS, Python 3, Git, the repo's npm packages and Playwright's own Chromium (`verify_seen.mjs` uses it for the fast page checks; it never searches). Each browser runs with its own profile folder (Windows `%LOCALAPPDATA%\rh-search\<name>`, macOS `~/Library/Application Support/rh-search/<name>`, Linux `~/.local/share/rh-search/<name>`; Chrome 136+ ignores a debugging port on your everyday profile): open google.com in each once, sign in if you like, and use them normally for a day; a brand-new profile is challenged more. Captchas: solve them yourself, the worker waits; nothing here evades a block.

**Move it over**
1. On the machine that runs it now: `npm run search:stop` (supervisor first, then the workers, then it checks nothing is left), then commit and push the lists: `git add docs/booking-links scripts/stays/ota-links.tsv scripts/stays/booking-stays.tsv`, commit, push. Also pack the search's cache (gitignored, 5 files, about 5 MB): `tar -czf rh-search-cache.tgz -C scripts/stays .cache/stays.json .cache/haridwar/stays.json .cache/places/places.json .cache/places/all-stays.json .cache/places/ota-links.tsv`, and copy the archive over (AirDrop, USB, cloud drive).
2. On Windows: install Git, `git clone` the repo (or `git pull`), then in PowerShell from the repo folder: `powershell -ExecutionPolicy Bypass -File scripts\windows\setup.ps1`. Unpack the cache: `tar -xzf rh-search-cache.tgz -C scripts\stays`.
3. `npm run search:browsers` (opens the four browsers on ports 9222-9225, prints which answer), then `npm run search:start`. `npm run search:status` shows counts and workers.
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

**First-run check on Windows** (report any line that differs): `node --version` (20+), `node scripts/py.mjs --version` (3.10+; it picks `python3`, `python` or `py -3` and forces UTF-8), `node scripts/stays/verify_seen.mjs --limit 1` prints a line, `node scripts/py.mjs scripts/stays/prune_unfound.py --dry` prints a count, `npm run search:browsers` shows four "ready", `npm run search:start` then `npm run search:status` shows five workers (chrome, opera, brave, edge, edge2) and the log grows, and `docs\booking-links\found.tsv` has no `\r` (the `.gitattributes` keeps LF).
