# Prompt for Antigravity: find booking pages for stays without one

Paste everything below the line into Antigravity (opened on this repo).

---

You're helping rishikeshhomestays.com find the booking-site page of each stay in `docs/antigravity/no-link-stays.tsv` (1,396 stays in Rishikesh and Haridwar, best first: work top to bottom). Read `CLAUDE.md` and `docs/HANDOFF.md` first, and add a row for yourself in `.agents/coordination.md` (Active Claims) claiming `docs/antigravity/results-*.tsv` only.

For each stay:
1. Search Google for `<name> <city>` plus the platform name, one platform at a time in this order: MakeMyTrip, Goibibo, Agoda, Booking.com, Airbnb, EaseMyTrip, Hotels.com/Expedia, Trip.com, Cleartrip, Yatra, OYO/Treebo/FabHotels.
2. Open the candidate property page in your browser. Accept it ONLY if the page itself shows the same property name (allow small spelling differences, but not a different hotel that shares a word) AND the same town (Rishikesh area: Tapovan, Laxman Jhula, Ram Jhula, Swarg Ashram, Muni Ki Reti, Shivpuri, Neelkanth road, Raiwala, Narendra Nagar; Haridwar area: Har Ki Pauri, Kankhal, Jwalapur, Bhupatwala, BHEL/Ranipur, SIDCUL, Bahadrabad). A city/search-results page, a platform homepage or a "sold out/no longer available" page does not count.
3. One link per platform at most; up to 3 platforms per stay is plenty. If nothing matches, record `none`.

Write results to `docs/antigravity/results-<your-batch>.tsv` (tab-separated, no header), one line per link found or per stay with nothing:
```
key<TAB>verified<TAB><Platform><TAB><property page URL without tracking params><TAB>page title as shown: "<title>"
key<TAB>none<TAB>-<TAB>-<TAB>searched <platforms>; nothing matched
```
`key` is the first column of no-link-stays.tsv, copied exactly. Platform names exactly: Booking.com, MakeMyTrip, Goibibo, Agoda, Airbnb, EaseMyTrip, Hotels.com, Expedia, Trip.com, Cleartrip, Yatra, OYO, Treebo, FabHotels.

Rules:
- Don't edit any other file in the repo; don't commit or push. Claude merges your results after its own checks (scripts/stays/postcheck_matches.py, browser re-check where possible).
- Go at a human pace. If Google shows a captcha or "unusual traffic", stop and wait; never use proxies or tricks to get around it.
- Don't copy photos, prices or reviews from the platforms — only the page URL and title.
- Save progress often (append to the results file) so a stop loses nothing.
