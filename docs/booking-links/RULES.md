# Rules: finding booking pages for stays (any helper agent)

> **Current flow (2026-10-04):** Claude's `scripts/stays/google_ota_search.mjs` workers do this search and move rows between `all.tsv`, `found.tsv` and `unfound.tsv` in this folder; the match rules below are coded in `scripts/stays/ota-match.mjs`. A helper agent takes stays from `all.tsv`, writes only its own `results-<batch>.tsv` here, and never touches the three lists.

Read this whole file before starting, and re-read it if you're unsure. These rules exist because wrong links send guests to the wrong hotel and cost the owner bookings; a missing link costs nothing (the site still captures the lead).

## 0. Quick start (one screen)

**What to search** — for each row of `docs/booking-links/all.tsv`, top to bottom, one Google search per platform (copy the stay's `name` and `city` exactly; drop words like "Hotel" only if nothing comes up):

| Platform | Google query |
|---|---|
| MakeMyTrip | `site:makemytrip.com "<name>" <city>` |
| Goibibo | `site:goibibo.com "<name>" <city>` |
| Agoda | `site:agoda.com "<name>" <city>` |
| Booking.com | `site:booking.com "<name>" <city>` |
| Airbnb | `site:airbnb.co.in "<name>" <city>` (also try airbnb.com) |
| EaseMyTrip | `site:easemytrip.com "<name>" <city>` |
| Hotels.com / Expedia | `site:hotels.com "<name>" <city>` · `site:expedia.co.in "<name>" <city>` |
| Trip.com, Cleartrip, Yatra | `site:trip.com …` · `site:cleartrip.com …` · `site:yatra.com …` |
| OYO, Treebo, FabHotels | `site:oyorooms.com …` · `site:treebo.com …` · `site:fabhotels.com …` |
| Own website | `"<name>" <city> official website book` |

If the quoted name finds nothing, retry once without quotes. Stop after **3 good links** for a stay, or after all platforms.

**How to decide** — open each candidate in the browser; keep it only if it's that platform's **property page**, the **name** matches (same distinctive words, same unit) and the **town** matches (section 4). If unsure → skip.

**Where to write**

| What | Where |
|---|---|
| Your results | `docs/booking-links/results-<batch>.tsv` (e.g. `results-ag1.tsv` for rows 1–200), tab-separated, no header, appended as you go (format: section 5) |
| Your claim + final counts | a row in `.agents/coordination.md` → "Active Claims" |
| Anything else in the repo | **nothing** — read-only for you |

**One line per result:**
```
<key>	verified	<Platform>	<url>	page title as shown: "<title>"
<key>	none	-	-	searched: <platforms>; nothing matched
```

## 1. The job

Input: `docs/booking-links/all.tsv` — 1,396 stays in Rishikesh and Haridwar that have no confirmed booking-site page yet, sorted **best first** (most reviews, rated, priced). Work **top to bottom**; quality first, small homestays later.

Columns: `key, name, city, area, type, rating, reviews, price_from_inr`.

For each stay, find its own property page on booking sites, using Google search plus your browser.

## 2. Before you start

1. Read `CLAUDE.md` and `docs/HANDOFF.md`.
2. Add a row in `.agents/coordination.md` → "Active Claims": agent name, "Find booking pages for docs/booking-links/all.tsv rows A–B", files `docs/booking-links/results-<batch>.tsv`, status `active`. Mark it `complete` with counts when done.
3. Pick a batch name (e.g. `ag1` for rows 1–200, `ag2` for 201–400 …) so several runs never write the same file.

## 3. How to search

- Google: `<name> <city>` + platform name, e.g. `The Hosteller Rishikesh Upper Tapovan makemytrip`.
- Platforms, in this order (stop after 3 good links for one stay):
  MakeMyTrip, Goibibo, Agoda, Booking.com, Airbnb, EaseMyTrip, Hotels.com, Expedia, Trip.com, Cleartrip, Yatra, OYO, Treebo, FabHotels.
- Also accept the stay's **own official website** if it has online booking — record platform `Direct`.
- Go at a human pace (a few seconds between searches). If Google shows a captcha or "unusual traffic": **stop, wait, then continue slowly**. Never use proxies, VPN hopping, multiple accounts, or anything to get around blocks.

## 4. When a page counts as a match (all must be true)

1. You **opened the page in the browser** (not just a search snippet).
2. It is that platform's **property page** — not a city/search-results list, not the homepage, not a "similar hotels" page, not a deal/blog page.
3. The **property name matches**: same distinctive words (small spelling differences, "Hotel" vs no "Hotel", or the town added are fine). Sharing one common word is NOT a match ("Ganga View Homestay" ≠ "Hotel Ganga View Residency"). A different unit of the same brand is NOT a match ("2BHK" vs "1BHK"; "Zostel Tapovan" vs "Zostel Laxman Jhula").
4. The **town matches**:
   - Rishikesh area: Rishikesh, Tapovan, Laxman/Lakshman Jhula, Ram Jhula, Swarg Ashram, Muni Ki Reti, Shivpuri, Neelkanth road, Raiwala, Narendra Nagar, Yamkeshwar/Mohanchatti.
   - Haridwar area: Haridwar/Hardwar, Har Ki Pauri, Kankhal, Jwalapur, Bhupatwala, BHEL/Ranipur, SIDCUL, Bahadrabad, Motichur.
5. The page is **live** (not "no longer available", not a 404). "Sold out for your dates" is fine.

If in doubt, it is **not** a match. Record nothing for that platform.

### 4a. The place decides (owner, 2026-10-05)

Names may be loose ("fuzzy to a high extent is fine") when **the place itself** confirms the page; a similar name somewhere else is never the stay. `scripts/stays/ota-evidence.mjs` applies this for both the automatic search and checks by hand (`scripts/stays/record_manual.mjs`):

- Name fits (rule 3) → match, unless the page's own map pin (Booking.com shows one) is over 2 km from our pin → `review.tsv`.
- Name close (its distinctive words, spelling slips allowed) **and** the page's pin within 250 m of ours, or the page shows the stay's PIN code and one of its own address words (village, street) → match, with that evidence in the note.
- Name close and the pin within 1 km → `review.tsv`; close in every word but nothing on the page to check the place → `review.tsv`.
- A page that already belongs to another stay: pins within 250 m and a close name → this row is a **duplicate** of that stay (`unfound.tsv` status `duplicate`, never listed twice); within 2 km → `review.tsv`; further → a different place.
- Real cases: "Krishn Kunj home Stay" vs Booking's Krishna Kunj Homestay, 2.6 km apart: different places. "Aranyam In the Village Homestay" vs Booking's Aranyam, 24 km apart: different. "MUSKAN RIVER RESORT" vs Agoda's "The Muskan Camp & Resort", same village and PIN on the page: the same place.

### 4b. How the search runs now

- Booking sites tried, in order, when the first does not turn the stay up: Booking.com, Agoda, Airbnb, (Hostelworld for hostels, OYO for OYO-branded names), Goibibo, MakeMyTrip, Expedia, Hotels.com, Cleartrip, Trip.com, EaseMyTrip. MakeMyTrip and Goibibo pages usually refuse automated browsers: noted, never forced.
- Each result is read with its title and snippet, not only its address (an Airbnb address is just a number, an Agoda address often differs from the name), the top results first; the page is scrolled, then "More results" / the next page read, only when nothing near the top looks like the stay.
- A results page with nothing like the stay is repeated on up to two other engines (Google, Bing, Brave Search, DuckDuckGo) before the stay is put aside; scrolling goes on until something that looks like the stay shows up.
- `scripts/stays/search_supervisor.mjs` keeps one worker per browser running (Opera, Chrome, Edge; Brave and Firefox left out while memory is short), restarts crashed or stalled ones, and pauses everything when the disk is almost full. Each worker paces itself: 1.5x slower after a challenge, 10% faster after 15 clean pages.
- Stays the automatic search cannot settle are checked by hand in the owner's Chrome (Claude in Chrome): its Google Maps booking options, Google with scrolling (Bing or DuckDuckGo after a CAPTCHA, never solved), one booking site at a time, recorded only through `record_manual.mjs`; a second agent re-opens every link accepted and sends wrong ones back to `review.tsv`.

## 5. Output format (exact)

File: `docs/booking-links/results-<batch>.tsv` — UTF-8, **tab-separated, no header**, append as you go.

One line per link found:
```
<key><TAB>verified<TAB><Platform><TAB><url><TAB>page title as shown: "<title>"
```
One line for a stay where nothing matched on any platform:
```
<key><TAB>none<TAB>-<TAB>-<TAB>searched: <platforms tried>; nothing matched
```

- `key`: copied exactly from column 1 of `all.tsv`. Never invent or change keys.
- `Platform`: exactly one of `Booking.com`, `MakeMyTrip`, `Goibibo`, `Agoda`, `Airbnb`, `EaseMyTrip`, `Hotels.com`, `Expedia`, `Trip.com`, `Cleartrip`, `Yatra`, `OYO`, `Treebo`, `FabHotels`, `Direct`.
- `url`: the property page URL **without** tracking/affiliate parameters (cut everything after `?` except where the platform needs it to identify the property, e.g. Airbnb `/rooms/<id>` needs nothing after `?`; MakeMyTrip `hotelId=` must stay). Never add `aid=` or any affiliate code (we add ours).
- Last column: the page's visible title or main heading, in quotes, so a human can check the match.
- No tabs or newlines inside fields. One stay may have several `verified` lines (different platforms) — never two lines for the same platform.

Example:
```
the-hosteller-rishikesh-upper-tapovan	verified	MakeMyTrip	https://www.makemytrip.com/hotels/the_hosteller_rishikesh_upper_tapovan-details-rishikesh.html	page title as shown: "The Hosteller Rishikesh, Upper Tapovan"
tourist-rest-house	none	-	-	searched: MakeMyTrip, Goibibo, Agoda, Booking.com, Airbnb; nothing matched
```

## 6. Don'ts

- Don't edit any other file (no pages, no `scripts/stays/ota-links.tsv`, no generated files); don't commit or push. Claude merges your results after its own checks.
- Don't copy photos, prices, reviews or descriptions from any platform — only the URL and title.
- Don't create bookings, accounts, or fill forms on the platforms.
- Don't fabricate: if you didn't open the page, it's not `verified`.

## 7a. Hard no's learned from the first run (read twice)

- **Do not write or run scripts that call search engines or search libraries** (no `duckduckgo_search`, no scraping of Google/Bing/DDG result pages in code). Use the browser/search tool the way a person would, one stay at a time.
- **Do not create files outside `docs/booking-links/results-<batch>.tsv`** (no helper scripts in the repo root or anywhere else in the repo). Scratch work belongs outside the repo.
- **A `verified` line needs a page you opened in the browser** and whose visible title/heading you copied. A search-result snippet or title is not enough.
- **A `none` line means you opened and checked candidates on the platforms listed**; list only the platforms you actually checked. Never write `none` because a search failed, was rate-limited or returned nothing.
- If something errors or gets blocked, stop and say so in your coordination row; do not mark stays `none` to keep moving.

## 8. When you finish a batch

Append nothing else to the results file. Update your row in `.agents/coordination.md`: rows covered, `verified` lines, stays with at least one link, `none` stays, any captcha stops. Then the owner tells Claude, which merges with: `scripts/stays/postcheck_matches.py` (drops pages shared by differently named stays or in the wrong town) → browser re-check where possible → `merge_ota.py` → rebuild pages → BigQuery.
