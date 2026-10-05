# Finding booking pages for our stays: how it works

Every stay on the site's stays pages gets a **View property** button that, after the lead popup, sends the guest
to the stay's own page on a booking site. This folder holds the search for those pages. A wrong link sends a guest
to the wrong hotel; a missing link costs little (the lead is still captured), so **when in doubt, it is not a match**.

## 1. The lists (this folder)

| File | What is in it |
|---|---|
| `all.tsv` | stays never searched yet; deleted on 2026-10-05 once every stay had been searched (never recreate it) |
| `found.tsv` | confirmed booking pages: `key, status, platform, url, note, name, city, source`; the note says why it matched |
| `unfound.tsv` | stays without a confirmed page, by `status`: `retry` (search again), `none` (searched well; not on a booking site, or only closed listings: the log starts `closed listing:`), `manual` (the name cannot identify it), `duplicate` (a second entry of a place already linked), `review` (only the owner can decide) |
| `review.tsv` | the owner's checklist: the page, what it shows, and why it is doubtful |

Rows move between the lists only through `scripts/stays/google_ota_search.mjs` (workers) and `scripts/stays/record_manual.mjs`
(checks by hand), under a lock, written atomically. Never edit and save these files while workers run: an editor's stale copy
would undo their work (an open editor tab may also show an old copy: close and reopen it).

## 2. When a page is this stay

The page must be that site's **property page** (not a search, city or list page), **live** (a closed listing redirects or says
"no longer available"), and pass the name and the place:

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

- **Workers**: `scripts/stays/search_supervisor.mjs` keeps them running (one per browser, two in Opera, the steadiest), restarts
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

## 4. Onto the site

Found links reach the stays pages only when merged: `scripts/stays/postcheck_matches.py` → `merge_ota.py` → the places pipeline
(`push_places.mjs`, `import_google_stays.py`) → `process.py` → `build_pages.py` → `push_bigquery.mjs`, then a commit and push.
Booking.com links get the CJ affiliate wrapper on the way (`assets/js/modules/affiliate-links.js`); never add `aid=`.
