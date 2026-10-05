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
scripts/indexnow.mjs                 IndexNow pings (run by .github/workflows/indexnow.yml after a push)
scripts/setup-bigquery.js            creates the enquiries table (idempotent)
vercel.json, _redirects              clean URLs and 301s (Vercel, Netlify)
sitemap.xml, llms.txt, llms-full.txt, robots.txt, ads.txt
tests/                               see docs/TESTING.md
```

`assets/js/abc.html` and `assets/css/abc.html` are empty tracked files with no purpose (safe to delete).

## Pages

- **Hand-made, repo root**: guides `about-rishikesh`, `places-to-visit`, `things-to-do-in-rishikesh`, `triveni-ghat`, `kedarnath-yatra`, `haridwar-kumbh-2027`, `driving-from-delhi-to-rishikesh`; lead pages `contact`, `homestays`, `list-your-homestay`, `bike-and-taxi-rental-in-rishikesh`, `thanks`, `404`.
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
| `whatsapp-widget.js` | Floating WhatsApp popup: name/phone/dates/guests/pets form, formatted booking message, stores the enquiry via `/api/contact`, opens WhatsApp. `WHATSAPP_PHONE` lives here |
| `whatsapp-link.js` | `buildWhatsAppLink`: `wa.me` on mobile (opens the app), `web.whatsapp.com/send` on desktop (an open WhatsApp Web session gets the message in one hop); `enhanceStaticWhatsAppLinks()` rewrites a page's static `wa.me` links |
| `theme-toggle.js` | `setupThemeToggle` (called by `site.js`): dark/light switch, stores `rh-theme`, keeps `aria-pressed`, `color-scheme` and the theme-color meta in step, fires `rh-themechange`. Phase 1 is opt-in (`FOLLOW_SYSTEM = false`); phase 2 follows the system setting while nothing is stored (one line here, one in the head snippet) |
| `ota-lead-gate.js` | Name + phone modal before outbound booking-site links on `hotels/` pages; waits for `/api/contact` to acknowledge (spinner) before opening the link |
| `email-otp.js` | `setupEmailVerification`: optional email OTP on the enquiry form (hidden when the server has no `OTP_SECRET`) |
| `host-form.js` | `setupHostForm`: List Your Homestay form (`host_application`) |
| `rental-form.js` | Bike & Taxi Rental form: country-code phone, flatpickr dates, notes required for cars/taxis, `rental_enquiry` payload, WhatsApp prefill |
| `hero-slideshow.js` | Home hero slider |
| `page-tabs.js` | Tabs (Places / Restaurants on `places-to-visit`) |
| `stays-index.js` | Lists on the generated pages (reads `#sx-root[data-city]`): search/filter (`k:` type, `t:` theme, `b:` bedrooms), `ruleMatches` (mirror of the search-phrase rules), `mixHtml` (own stays mixed in), `shownCount` ("View all" fold), View property |
| `stays-index-data.js`, `stays-index-data-haridwar.js` | Generated data per city (`STAYS_INDEX`, `STAYS_INDEX_META`, `STAYS_OWN`); never hand-edit |
| `stay-page.js` | Property page (reads `?s=` and `?c=`): facts, lead popup → one booking redirect, WhatsApp, sidebar (our homestays + grouped "More stays in …"), Leaflet map (not for `gm` stays: "View on Google Maps") |
| `landmark-map.js` | Lazy Leaflet map on landmark pages |
| `affiliate-links.js` | The only place for affiliate IDs: `CJ_PID` 101895722, `CJ_BOOKING_LINK_ID` 17323528, `affiliateLink(site, url)` wraps a Booking.com page in `https://www.anrdoezrs.net/click-<PID>-<LINK>?url=<page>`. `build_pages.py` reads the constants from this file; the Node scripts import it |

`assets/js/index.js` imports `nav`, `search-form`, `stays-renderer` and `enquiry-prefill` and runs them on `DOMContentLoaded`, but no page loads it; pages use the `site.js` shim.

## Top-level scripts

- **`analytics.js`**: GA4 (gtag.js), measurement ID `G-L82BSZMRLW` (the site's only Google tag; GTM removed 2026-09-30). Owner opt-out: `?baba=<phrase>` sets a `localStorage` flag + `ga-disable-<ID>`; `?baba=wapas` resumes. Only the phrase's SHA-256 is in the code.
- **`ads.js`**: AdSense, publisher `ca-pub-7016219170450293` (also in `/ads.txt`). Per page type (`PLAN`):
  - guide pages: side rails + one mid-article display (after the 2nd section) + a Multiplex grid above the footer;
  - homepage: rails + grid;
  - stays lists (every `/hotels/*` page except `stay` and our own listing: category, landmark and search-phrase pages): rails + one display at the page's `.rh-ad-slot` after the lists (landmark pages have no slot) + grid;
  - lead/booking pages (stay page, contact, homestays, our own listing, list-your-homestay, rental, thanks, 404): none.
  - Never more than 4 ads on a wide screen, 2 on a phone. The top of every page is ad-free: rails (160/300 × 600, fixed in the margins) only on windows ≥ 1580px, only after the first screen, hidden over the footer. Never on localhost or for the owner's opted-out browsers.
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
