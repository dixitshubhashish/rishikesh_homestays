# Architecture

Static HTML/CSS/vanilla JS (no framework, no build step) plus a few Node API functions. The rules for working in it are in `CLAUDE.md`; this file is the map. The stays pipeline is in `scripts/stays/README.md`, the booking-link search in `docs/booking-links/RULES.md`.

## Files

```
index.html, 404.html                 home page, custom 404
<page>.html                          hand-made guide and lead pages, at the repo root (URL = file name)
hotels/                              our own listing page + the generated stays pages and hotels/stay.html
assets/css/styles.css                all site styles (tokens, components)
assets/css/whatsapp-widget.css       WhatsApp popup only
assets/js/analytics.js, ads.js       GA4 and AdSense, loaded by every page
assets/js/site.js, contact.js        backward-compat shims (ES modules)
assets/js/index.js                   old module entry point; no page loads it
assets/js/modules/                   the real source (table below)
assets/vendor/                       self-hosted flatpickr, libphonenumber, leaflet
assets/images/                       photos and art
api/                                 Vercel functions: contact, bigquery, geo, currency-rates, otp-*
server.js                            Express dev server (static files + /api routes + 301s + 404 catch-all)
scripts/stays/                       stays pipeline and booking-link search
scripts/search/build-index.mjs       builds assets/search/index.json, the header search index
scripts/indexnow.mjs                 IndexNow pings (run by .github/workflows/indexnow.yml after a push)
scripts/setup-bigquery.js            creates the enquiries table (idempotent)
vercel.json, _redirects              clean URLs and 301s (Vercel, Netlify)
sitemap.xml, llms.txt, llms-full.txt, robots.txt, ads.txt
tests/                               see docs/TESTING.md
```

`assets/js/abc.html` and `assets/css/abc.html` are empty tracked files with no purpose (safe to delete).

## Pages

- **Hand-made, repo root**: guides `about-rishikesh`, `places-to-visit`, `things-to-do-in-rishikesh`, `triveni-ghat`, `kedarnath-yatra`, `haridwar-kumbh-2027`, `driving-from-delhi-to-rishikesh`; lead pages `contact`, `homestays`, `list-your-homestay`, `bike-and-taxi-rental-in-rishikesh`, `thanks`, `404`.
- **Driving guides per NCR city** (generated, at the root): `driving-from-<city>-to-rishikesh` and `driving-from-<city>-to-haridwar` for `delhi` (Haridwar only: Delhi to Rishikesh is the hand-made master guide `driving-from-delhi-to-rishikesh`), `gurugram`, `noida`, `greater-noida`, `ghaziabad`, `faridabad`, `sonipat`, `meerut` (15 pages). `scripts/drives/build-pages.mjs` holds the config (`CITIES`: rounded km to each town, the way out of the city, when to leave) and builds each page from the master guide's head, header and footer; the master keeps its own tolls, festival, food and parking text, which the city pages link to instead of repeating. The master's `<!--drive:cities-->` region lists every page. Add a city: add it to `CITIES` (and the three lists the test names), run the script, then `npm run i18n:extract`, `npm run build:search`, `python3 scripts/stays/page_dates.py` and the sync steps. Distances are rounded to 10 km from several routing sources (they differ by 10-30 km): always "about". `tests/integration/drives.test.js` fails when the committed pages differ from what the script writes.
- **Footer sections** (generic): `scripts/stays/footer_links.py` writes the `<!-- footer-stays -->` block on every page: stays per city, then one section per **page family** found on disk by file name (`FAMILIES`: rentals → "Rentals in <town>", driving guides → "Driving to <town>"). A new page of a known family (a new city or vehicle) appears in every footer on the next run with no code change; a new kind of family is one `FAMILIES` entry (file-name pattern, grouping, heading and label). A section longer than `FOLD_AFTER` (12) links folds its tail behind a CSS-only "More (n)" toggle, so phones stay short while crawlers see every link. Run by every `build:stays` and by hand after adding generated pages.
- **Rental pages** (generated, at the root so the URL matches the file): `bike-rental-in-<city>`, `car-rental-in-<city>`, `taxi-rental-in-<city>` for `rishikesh` and `haridwar` (six pages). Bike, car and taxi are three separate aspects, never mixed on one page; one template switches them. `scripts/rentals/build-pages.mjs` holds the config (`PAGE`: title, description, hero, lead per kind and city; the Haridwar text; the FAQ) and builds each page from the hub `bike-and-taxi-rental-in-rishikesh.html`, whose `<!--rent:name-->…<!--/rent:name-->` regions are the parts that change (a page's own section, the form's options, the switch, the FAQ). Edit the config or those regions, run `node scripts/rentals/build-pages.mjs`, then `python3 scripts/stays/footer_links.py`; `tests/integration/rentals.test.js` fails when the committed pages differ from what the script writes. The switch (`.rental-switch`) is plain links: the three kinds for the city, the two cities for the kind. The footer lists them under "Rentals in Rishikesh / Haridwar" (`footer_links.py`). The hub keeps all of bike, taxi and self-drive and links to the six. A page sends its `city` (hidden input) with the enquiry; the form offers only that kind's services.
- **Hand-made, `hotels/`**: `advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh.html` (our own listing, `/hotels/<slug>`).
- **Generated, `hotels/`** (by `scripts/stays/build_pages.py`, never hand-edited): per city `best-<category>-in-<city>` (33 each: type, size and theme pages plus the master `best-hotels-in-<city>`), landmark pages `best-stays-near-<landmark>` (20), search-phrase pages named after Google searches (about 170, e.g. `/hotels/cheap-hotels-in-rishikesh`), and the single property page `stay.html` (`/hotels/stay?s=<slug>&c=<city>`, `noindex`). Category links are grouped (Accommodation type / By size / Themes & facilities) and sorted by count.
- **404.html**: full site header/footer, Rishikesh-themed copy, a phone/WhatsApp/email block, auto-redirect to `/` after 30 s with a cancel option. Vercel and Netlify serve it for any unmatched route; `server.js` has a catch-all at the end that does the same locally. Art: `assets/images/404/*-choti.webp` (manual checks in `docs/TESTING.md`).

## Script loading

- `site.js` and `contact.js` use `import`, so every page loads them as `<script type="module">`. As plain scripts they throw "Cannot use import statement outside a module" and nav/search/forms break silently.
- Vendor libraries (`flatpickr`, `libphonenumber`, `leaflet`) are classic `<script src>` tags placed **before** the module scripts, because they expose `window.flatpickr` / `window.libphonenumber` / `window.L`. Leaflet loads only when a map scrolls into view.
- `analytics.js` comes right after `<meta charset>`, then the AdSense meta + `ads.js`.
- Then the theme head snippet: `<meta name="theme-color">` and an inline script that sets `<html data-theme>` from `localStorage['rh-theme']` (light while unset) before the stylesheets, so there is no flash of the wrong theme. Every page also has one `<button class="theme-toggle" data-theme-toggle>` in the header, before the menu button. Generated stays pages copy both from `thanks.html`. `tests/integration/theme.test.js` checks every page.

## Modules (`assets/js/modules/`)

| Module | Exports / job |
|---|---|
| `data.js` | `AREAS`, `STAYS`: the hand-kept homestay cards (single source of truth). A `STAYS` entry with `detailUrl: "/hotels/<slug>"` gets a clickable card |
| `dom-helpers.js` | `qs`, `qsa`, `getSafe`, `addClass`, `removeClass`, `toggleClass`, `setAttr`, `getAttr`; all null-safe |
| `nav.js` | `setupNav`: mobile menu (hamburger) |
| `stays-renderer.js` | `createStayCard`, `renderStays`, `hydrateFilters`: homestay cards and filters on `homestays.html` |
| `search-form.js` | `setupQuickSearch`, `setupAreaDropdowns`, `setupDatePickers`: home search bar |
| `enquiry-prefill.js` | `setupEnquiryPrefill`, `applyListingParams`: reads URL params so a stay card can open the contact form with that stay preselected, and applies listing filters |
| `contact-form.js` | `setupContactForm`, `setupCounters`, `setupContactDatePickers`: main contact form (phone validation, flatpickr check-in/out with range rules, guest counters) |
| `validators.js` | `validatePhone` (via `window.libphonenumber`), `validateDateRange`, `validateRentalDateRange` (same-day allowed); shared by the forms and `api/contact.js` |
| `country-select.js` | Country-code `<select>` (flag, name, dial code) built only from libphonenumber metadata + `Intl.DisplayNames` (no hardcoded list); default country from `geo.js`, else India |
| `geo.js` | `detectCountryCode` via `/api/geo`; cached in memory per page and in `localStorage` for 24 h |
| `currency.js` | Approximate visitor-currency price (USD/EUR/GBP/AUD/CAD/JPY) via `/api/currency-rates`; shown next to the INR price, never instead of it; rounded up to the nearest 5 units |
| `button-loading.js` | `setButtonLoading` / `clearButtonLoading`: spinner + "-ing" label, disabled while busy; restores the exact original label from `data-original-label` |
| `whatsapp-widget.js` | Floating WhatsApp popup: name/phone/dates/guests/pets form, formatted booking message, stores the enquiry via `/api/contact`, opens WhatsApp. `WHATSAPP_PHONE` lives here. **Shareable link** that opens the form at once (Instagram bio, stories, social posts): `https://rishikeshhomestays.com/whatsapp` (302 to `/?whatsapp=open` in `vercel.json`, `_redirects`, `server.js`; other query parameters such as `utm_source` are kept by `server.js`). Any page also takes `?whatsapp=open` or `#whatsapp`. Opened that way the drawer never idles shut and no attention effects run |
| `whatsapp-link.js` | `buildWhatsAppLink`: `wa.me` on mobile (opens the app), `web.whatsapp.com/send` on desktop (an open WhatsApp Web session gets the message in one hop); `enhanceStaticWhatsAppLinks()` rewrites a page's static `wa.me` links |
| `theme-toggle.js` | `setupThemeToggle` (called by `site.js`): dark/light switch, stores `rh-theme`, keeps `aria-pressed`, `color-scheme` and the theme-color meta in step, fires `rh-themechange`. Phase 1 is opt-in (`FOLLOW_SYSTEM = false`); phase 2 follows the system setting while nothing is stored (one line here, one in the head snippet) |
| `ota-lead-gate.js` | Name + phone modal before outbound booking-site links on `hotels/` pages; waits for `/api/contact` to acknowledge (spinner) before opening the link |
| `email-otp.js` | `setupEmailVerification`: optional email OTP on the enquiry form (hidden when the server has no `OTP_SECRET`) |
| `host-form.js` | `setupHostForm`: List Your Homestay form (`host_application`) |
| `enquiry.js` | **The one place an enquiry is sent**: `postEnquiry(payload)` (POST `/api/contact`, resolves `{…server JSON, ok, status}`), the `SOURCES` names and the booking-site click-through source helpers. Contact, rental, host, WhatsApp widget, booking lead gate and stay popup all call it; each keeps its own fields and validation. A test fails if any other module posts to `/api/contact` itself |
| `rental-form.js` | Bike & Taxi Rental form: country-code phone, flatpickr dates, notes required for cars/taxis, `rental_enquiry` payload, WhatsApp prefill |
| `hero-slideshow.js` | Home hero slider |
| `page-tabs.js` | Tabs (Places / Restaurants on `places-to-visit`) |
| `stays-index.js` | Lists on the generated pages (reads `#sx-root[data-city]`): search/filter (`k:` type, `t:` theme, `b:` bedrooms), `ruleMatches` (mirror of the search-phrase rules), `mixHtml` (own stays mixed in), `shownCount` ("View all" fold), View property |
| `stays-index-data.js`, `stays-index-data-haridwar.js` | Generated data per city (`STAYS_INDEX`, `STAYS_INDEX_META`, `STAYS_OWN`); never hand-edit |
| `stay-page.js` | Property page (reads `?s=` and `?c=`): facts, lead popup → one booking redirect, WhatsApp, sidebar (our homestays + grouped "More stays in …"), Leaflet map (not for `gm` stays: "View on Google Maps") |
| `landmark-map.js` | Lazy Leaflet map on landmark pages |
| `site-search.js` | `setupSiteSearch` (called by `site.js`): header search button + panel; pure `tokenise`, `similarity`, `wordSimilarity`, `score`, `search`, `highlight` (see Site search below) |
| `affiliate-links.js` | The only place for affiliate IDs: `CJ_PID` 101895722, `CJ_BOOKING_LINK_ID` 17293139 (approved 2026-10-07; the search widget in `ads.js` keeps 17323528), `affiliateLink(site, url)` wraps a Booking.com page in `https://www.kqzyfj.com/click-<PID>-<LINK>?url=<page>`. `build_pages.py` reads the constants from this file; the Node scripts import it |

`assets/js/index.js` imports `nav`, `search-form`, `stays-renderer` and `enquiry-prefill` and runs them on `DOMContentLoaded`, but no page loads it; pages use the `site.js` shim.

## Site search

The magnifier button in every page's header (injected by `site-search.js` before the theme toggle, so no HTML page carries it) opens a search panel over the page: up to 8 results grouped Pages / Stays, matched words highlighted, ↑/↓/Enter/Esc, and a "No results" line linking to `/contact`.

- **Index**: `assets/search/index.json` (committed; a `.gitignore` exception, since `*.json` is ignored). Built by `npm run build:search` (`scripts/search/build-index.mjs`), which `npm run build:stays` runs at the end; rebuild it after editing a hand-made page's title, description or headings. It holds every page at the root and in `hotels/` without a robots `noindex` (`p`: hand-made pages give title, meta description and h2/h3 headings with their anchor; generated stays pages give their `<h1>` and title), then every stay of both cities (`s`: name `n`, area `a`, kinds `k`, `id`, city `c`), our own stays (`STAYS_OWN`, `o: 1`, own URL `u`) first. Other stays open `/hotels/stay?s=<id>&c=<city>`. Heading anchors: the heading's id, else its tab panel when hidden on load (`places-to-visit#restaurants`), else a `#:~:text=` fragment. About 360 KB raw, 70 KB gzipped.
- **Loading**: fetched on the button's first focus / hover / click, never on page load.
- **Fuzzy rule**: text is lowercased, Latin accents and punctuation stripped, split into words; query stop words (in, the, of…) dropped. A query word matches an index word when `1 - distance / longer length` ≥ 0.70 (Levenshtein, an adjacent swap counting as one edit), or matches the start of a longer word the same way (scored × 0.95), so "trivn" finds Triveni, "ganag" Ganga, "hotal" Hotel. Words with digits match only exactly or as a prefix (207 ≠ 2027). Fields are weighted (title / name 1, other title parts 0.85, area / kind 0.8, description 0.6; a heading must match on its own text).
- **Ranking**: more query words matched first, then match quality, then pages before headings before stays, then the shorter title; our own stays get +0.15. Each group keeps up to 3 places among the best-matching tier, at most 3 results come from one page, and weaker matches only fill in when the best tier is short.
- **Styles**: the "Site search" block at the end of `styles.css` (theme tokens only, so dark needs no extra rules). On phones (≤ 460px) the site name wraps to two lines so the three header buttons fit.
- Visible strings are English literals in the module; the i18n catalogue translates them.

## Top-level scripts

- **`analytics.js`**: GA4 (gtag.js), measurement ID `G-L82BSZMRLW` (the site's only Google tag; GTM removed 2026-09-30). Owner opt-out: `?baba=<phrase>` sets a `localStorage` flag + `ga-disable-<ID>`; `?baba=wapas` resumes. Only the phrase's SHA-256 is in the code.
- **`ads.js`**: AdSense, publisher `ca-pub-7016219170450293` (also in `/ads.txt`). Per page type (`PLAN`):
  - The owner's rule (2026-10-05): never an ad in the first screen at any width, never one that blocks or slows the reader (not between a heading and its content, not in a form, not beside a Book / Enquire / WhatsApp / View property / Submit button, no sticky ad over content on phones, no layout shift). Never more than 3 ads on screen at once at any width. In-content ads (in-article, display, in-feed) keep at least one screen height of page between them (an ad counts as at least 280px tall); one that can't is dropped. Every placement checks it starts below the first screen; the Multiplex grid needs the footer at least 1.5 screens down. Nothing is re-placed on resize or re-render.
  - homepage: nothing above "Plan beyond the room" (`<section data-ad-start>`): an in-feed card closing that section's guide cards (`.rh-ad-slot[data-ad="infeed"]`), the grid above the footer, and rails on ≥ 1580×900 windows that show only once that section reaches the top and only when there's at least half a screen of scrolling before the grid (today there isn't, so the homepage has no rails);
  - guide pages: in-article ads at hand-placed anchors (`<div class="rh-ad-slot" data-ad="article" [data-min-width="N"]>`, at natural breaks in the copy); an in-feed card at a row boundary of the first card list of 5+ cards not marked `data-no-ad` (a second one in lists of 12+: places to visit; unit `infeedPhoto` for photo cards, `infeedText` for text cards); a sticky 300×600 under `.side-panel` at 1381–1579px (wrapped in `.rh-side-col`); grid; rails at ≥ 1580×900;
  - stays lists (every `/hotels/*` page except `stay` and our own listing: category, landmark and search-phrase pages): one in-article ad at the page's `.rh-ad-slot[data-ad="display"]` after the lists; a sticky block under the filters from 901px (`.sx-side.has-ad`, 300 wide from 1280px); **a minor break after every ~15-20 stays across all category groups** (owner, 2026-10-08; `sxbreaks()`: 15 rows, more on tall windows so two never share a screen; between two rows as a full-width `<li class="sx-break">` or between two groups; at most 8 per page, AdSense requests for them capped at 6 per page view, re-placed after a filter or "View all" re-draw) that alternates a text in-feed AdSense unit with a **Booking.com banner** (`bookingBanner()`: our own HTML, one link marked "Sponsored" (`rel="sponsored"`) through our CJ deep link to **our own Booking.com property pages** (`OWN_BOOKING` in `ads.js`: Advaitam; Yoga Retreat at the Ganges ("Yoga Retreat at The Ganges in Rishikesh" on Booking.com) in every second banner on a page), so the visitor starts at our stay and searches the rest there; its CJ ids equal `affiliate-links.js`, checked by `tests/modules/ads-mix.test.js`); the Booking.com search widget and the grid above the footer. **The mix**: a fair coin flipped once per page view (`coin()`, `crypto.getRandomValues`, no id or storage, so every refresh is a fresh 50/50; written to `<html data-ad-mix="booking-first|adsense-first">`) decides whether the sidebar shows the Booking.com banner and the breaks start with AdSense, or the reverse; at ≥ 1860px a right rail (300px) carries the kind the sidebar does not, and landmark pages (no sidebar) get an AdSense left rail from ≥ 1580×900 plus the Booking.com right rail from ≥ 1860. Never beside a View property button (a break is a full-width divider between rows).
  - lead pages (`LEAD`): at most one ad well below the main action (nothing within 400px below the last form / booking panel / WhatsApp or submit button): the grid on `/homestays` (only ≥ 1381px, where the form sits beside the cards); the in-article anchor before the FAQ on the rental page. `/hotels/stay`, our own listing (`/hotels/advaitam-…`), contact, list-your-homestay, thanks and 404 get none (owner 2026-10-06: no rival hotels under our booking buttons).
  - Rails (160/300 × 600, fixed in the margins) need ≥ 1580px wide and ≥ 900px tall, never show with a sidebar ad, and hide over the grid/footer, whenever the in-content ads in view would make more than 3 ads on screen (both rails + two in-content ads), while the WhatsApp drawer is open (`body.whatsapp-drawer-open`; the drawer itself is unchanged and still pushes the page aside), and the right rail also wherever it would cover the WhatsApp hint bubble (`#whatsapp-nudge`, `.whatsapp-btn-hint`) on short windows.
  - Sticky sidebar ads rely on `html, body { overflow-x: clip }` (`hidden` made body a scroll container and broke every `position: sticky`).
  - The Booking.com iframe widget (`PLACE.widget`, one instance per page: its id is fixed) sits above the footer on home, guides, stays lists, the six `*-rental-in-*` pages and the 404 page (found by `<html data-i18n-page="404">`, since it answers any address); never on `/homestays`, contact, thanks, list-your-homestay, report-a-bug, `/hotels/stay` or our own listing (no rival hotels where guests book or enquire with us). The banner text is English only (ads.js is not in the UI extraction).
  - Never on the live site for the owner's opted-out browsers. On localhost every unit is a labelled preview box; automated browsers get none unless the URL has `?adpreview=1`.
  - Units are in `UNITS`. AdSense's AMP code translates: `mcrspv` → `autorelaxed`, `rspv` → `auto`. The site isn't AMP: never paste `amp-ad` / `amp-auto-ads`.

## CSS

- One file, `styles.css`. Tokens on `:root`: `--ink` text, `--river` primary action, `--leaf` / `--marigold` / `--clay` accents, `--paper` / `--panel` backgrounds, `--sky`, `--line`, `--muted`, `--shadow`, `--radius`, `--max` (1180px content width), `--hero-gradient-a/b/c`, `--hero-panel-bg`.
- Components: `.btn` (`-primary`, `-secondary`, `-whatsapp`), `.card` / `.homestay-card` / `.info-card`, `.hero` / `.section` / `.container`, `.field` / `.tag-row` / `.filters`.
- Mobile-first, flex and grid, `min()` / `max()` / `clamp()` instead of fixed widths. Single-column resets use `minmax(0, 1fr)`, never a bare `1fr` (see `CLAUDE.md`).

## API (`api/`)

### `POST /api/contact` (`contact.js`)

Input (JSON): `name`, `phone` (E.164, `+<code><number>`), `email`, `details`, `preferred_stay`, `stay_name`, `area`, `coming_from_city`, `check_in`, `check_out`, `adults`, `children`, `guests_total`, `people`, `pets` (`none|dogs|cats`), `pet_count`, `service`, `pickup_point`, `email_verified`, `source`.

Output: `{ "success": true, "message": "Thank you! We will contact you shortly.", "enquiryId": "<uuid>" }`, or an error JSON.

It:
1. Requires name, phone and details; checks the phone with `libphonenumber-js` (the browser already normalised it; this is defence in depth) and the date range with `validateDateRange`.
2. Stores the enquiry in BigQuery (`api/bigquery.js`, `insertEnquiry`) with its `source`: `website_form` (contact page), `whatsapp_widget`, `ota_redirect_<platform>` (lead gate), `stay_redirect_<site>` / `stay_enquiry` (stay-page popup), `host_application` (List Your Homestay), `rental_enquiry` (rental page; subject "Rental enquiry: <name> → <service>", same-day rentals allowed).
3. Sends one branded HTML email via Resend (logo, WhatsApp button, book-direct pitch). With a guest email: the guest is `to` and `CONTACT_EMAIL` is `cc` (one reply-all thread). Without: internal-only to `CONTACT_EMAIL`.
4. **Stay-popup leads** (`stay_*`) are internal-only, even with a guest email. Subject "Stay lead: <name> (<n> guests) → <stay>", with a **"WhatsApp <name> now"** button: `wa.me/<guest phone>` with an opener that asks for their dates, offers our own homestays, and pitches booking direct ("skip the booking-site commission") with one random Rishikesh treat from `SAVED_COMMISSION_IDEAS` (Chotiwala, rafting, Triveni Ghat offering, yoga, chai & jalebis, Kunjapuri, Parmarth diyas, Ayurvedic massage, Tapovan cafes). It never names the listing they clicked (`stay_name` is for us only): the stays pages exist to sell our own homestays.

### Others

- `bigquery.js`: client + `insertEnquiry(row)`. Credentials from `GOOGLE_APPLICATION_CREDENTIALS` (file path, local) or `GOOGLE_APPLICATION_CREDENTIALS_JSON` (inline JSON, Vercel). Table from `BIGQUERY_DATASET` / `BIGQUERY_ENQUIRIES_TABLE` (default `rishikesh_homestays.enquiries`, day-partitioned on `created_at`, created by `scripts/setup-bigquery.js`).
- `geo.js` (`GET /api/geo`): on Vercel, the free `x-vercel-ip-country` header (no external call); locally, `ipwho.is` (free, no key), cached in memory 24 h.
- `currency-rates.js` (`GET /api/currency-rates`): fawazahmed0/currency-api via jsDelivr (no key), cached 24 h; a small static table if the fetch fails.
- `otp-status.js`, `otp-send.js`, `otp-verify.js` + `otp-helpers.js`: optional email OTP. Stateless: the code is derived from `OTP_SECRET` + email + expiry and sent via Resend. Never blocks an enquiry; without `OTP_SECRET` the verify UI never appears.

## Data pipeline (summary)

`scripts/stays/` (details in its README): crawl → `process.py` (areas, types, tags, bedrooms, permanent `listing_id`; Google Maps places via `import_google_stays.py`) → booking links (browser search in `google_ota_search.mjs` with `ota-match.mjs` + `ota-evidence.mjs`, see `docs/booking-links/RULES.md`; older matchers `booking-match.mjs`, `verify_candidates.mjs`, `guess_booking_slugs.mjs`, `sitemap_candidates.py` + `verify_platform.mjs`) → `postcheck_matches.py` → `merge_ota.py` → `ota-links.tsv` → `build_pages.py` (pages, footers via `footer_links.py`, search-phrase pages via `search_pages.py`, dates via `page_dates.py`, sitemap, `llms.txt`, `llms-full.txt`) → BigQuery (`push_bigquery.mjs` → `market_properties` + view `stays_sheet`; `push_places.mjs` → `places_lodging`, internal only). `refresh.py` re-crawls on a schedule.

## Hosting

Vercel is primary (`vercel.json`: `cleanUrls`, 301s, the `api/` functions). Netlify config (`_redirects`) is kept for parity, but there is no `netlify.toml` or functions folder, so on a plain Netlify static deploy `/api/*` (forms, lead popup) would not run.

## Design notes

- Modular for testability, single responsibility, reuse across pages and room to grow; shims kept so existing pages keep working.
- No bundler: native ES modules, fast iteration; one CSS file, no request waterfall; modules cached by the browser separately.
- Ideas not taken up yet: a production build step (minify), TypeScript, state management, web components.
