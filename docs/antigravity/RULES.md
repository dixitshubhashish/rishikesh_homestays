# Rules: finding booking pages for stays (Antigravity / any helper agent)

Read this whole file before starting, and re-read it if you're unsure. These rules exist because wrong links send guests to the wrong hotel and cost the owner bookings; a missing link costs nothing (the site still captures the lead).

## 0. Quick start (one screen)

**What to search** — for each row of `docs/antigravity/no-link-stays.tsv`, top to bottom, one Google search per platform (copy the stay's `name` and `city` exactly; drop words like "Hotel" only if nothing comes up):

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
| Your results | `docs/antigravity/results-<batch>.tsv` (e.g. `results-ag1.tsv` for rows 1–200), tab-separated, no header, appended as you go (format: section 5) |
| Your claim + final counts | a row in `.agents/coordination.md` → "Active Claims" |
| Anything else in the repo | **nothing** — read-only for you |

**One line per result:**
```
<key>	verified	<Platform>	<url>	page title as shown: "<title>"
<key>	none	-	-	searched: <platforms>; nothing matched
```

## 1. The job

Input: `docs/antigravity/no-link-stays.tsv` — 1,396 stays in Rishikesh and Haridwar that have no confirmed booking-site page yet, sorted **best first** (most reviews, rated, priced). Work **top to bottom**; quality first, small homestays later.

Columns: `key, name, city, area, type, rating, reviews, price_from_inr`.

For each stay, find its own property page on booking sites, using Google search plus your browser.

## 2. Before you start

1. Read `CLAUDE.md` and `docs/HANDOFF.md`.
2. Add a row in `.agents/coordination.md` → "Active Claims": agent name, "Find booking pages for docs/antigravity/no-link-stays.tsv rows A–B", files `docs/antigravity/results-<batch>.tsv`, status `active`. Mark it `complete` with counts when done.
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

## 5. Output format (exact)

File: `docs/antigravity/results-<batch>.tsv` — UTF-8, **tab-separated, no header**, append as you go.

One line per link found:
```
<key><TAB>verified<TAB><Platform><TAB><url><TAB>page title as shown: "<title>"
```
One line for a stay where nothing matched on any platform:
```
<key><TAB>none<TAB>-<TAB>-<TAB>searched: <platforms tried>; nothing matched
```

- `key`: copied exactly from column 1 of `no-link-stays.tsv`. Never invent or change keys.
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
- **Do not create files outside `docs/antigravity/results-<batch>.tsv`** (no helper scripts in the repo root or anywhere else in the repo). Scratch work belongs outside the repo.
- **A `verified` line needs a page you opened in the browser** and whose visible title/heading you copied. A search-result snippet or title is not enough.
- **A `none` line means you opened and checked candidates on the platforms listed**; list only the platforms you actually checked. Never write `none` because a search failed, was rate-limited or returned nothing.
- If something errors or gets blocked, stop and say so in your coordination row; do not mark stays `none` to keep moving.

## 8. When you finish a batch

Append nothing else to the results file. Update your row in `.agents/coordination.md`: rows covered, `verified` lines, stays with at least one link, `none` stays, any captcha stops. Then the owner tells Claude, which merges with: `scripts/stays/postcheck_matches.py` (drops pages shared by differently named stays or in the wrong town) → browser re-check where possible → `merge_ota.py` → rebuild pages → BigQuery.
