# Rishikesh Homestays

A Rishikesh & Haridwar travel guide (rishikeshhomestays.com) whose job is to sell our own homestays over third-party listings.

## 📚 Documentation Map

Each topic has one home; other files link to it instead of repeating it.

- `docs/HANDOFF.md`: **start here in a new session**. Goal, live numbers, owner to-dos, how to run the pipelines, hard-won rules.
- `CLAUDE.md` (this file): the rules and where things live.
- `docs/ARCHITECTURE.md`: files, pages, every JS module, ads plan, CSS tokens, the API contracts (`/api/contact` sources and email flow, geo, currency, OTP).
- `docs/TESTING.md`: running and writing tests, what each test file covers, the last full run, the 404-artwork manual checks.
- `scripts/stays/README.md`: the stays pipeline (crawl, process, build, page rules, listing ids, BigQuery, Google Maps places).
- `docs/booking-links/RULES.md`: the booking-link search (lists, match rules, workers, merge).
- `README.md` (public summary), `AGENTS.md` (rules for other agents) and `CLAUDE.md` stay at the repo root by convention.
- `PROGRESS.md`: dated shipped/pending log. Stays at the root while in-flight tasks in `.agents/coordination.md` read and write it; check that file before moving it.
- `.agents/coordination.md`: the live multi-agent ledger.

Keep it this way: update the doc that owns a topic, don't add new `.md` files for results or notes (test runs go in `docs/TESTING.md` "Last full run", state in `docs/HANDOFF.md`, history in `PROGRESS.md`).

## Multi-Agent Coordination

Codex and other agents work here too. Follow `AGENTS.md`: read `.agents/coordination.md` before editing, claim your files or task, avoid active claims, and record changes, verification and handoff notes when done. It is file-based, not live messaging. As of 2026-10-05 only Claude holds claims (the owner released every Codex and other-agent claim); another agent starts with a new claim.

## 🏗️ Where things live

Full map in `docs/ARCHITECTURE.md`. The rules:

**Pages and URLs**
- Hand-made content and guide pages live **at the repo root** next to `index.html` (`/contact` → `contact.html`), not in a `pages/` folder. The URL must match the file 1:1: Vercel's `cleanUrls` (and Netlify's pretty URLs) only map a clean URL to a `.html` file at the *same* path, and a `vercel.json` rewrite to a file in another folder (`/contact` → `/pages/contact.html`) silently 404s in production while working on the local `server.js`. Old `/pages/<slug>` URLs 301 to the root URL in `server.js`, `vercel.json` and `_redirects`: keep all three in sync when adding or renaming a page, and verify new routes on the deployed site, not only locally.
- `hotels/` holds our own hand-made listing pages (`/hotels/<slug>`, currently Advaitam) and the generated stays pages. A `STAYS` entry in `data.js` with `detailUrl: "/hotels/<slug>"` gets a clickable card.
- `404.html` is served for any unmatched route (Vercel/Netlify convention; `server.js` has a catch-all at the end for local dev).

**Generated stays pages** (`scripts/stays/`, details in its README; numbers in `docs/HANDOFF.md`)
- Two cities, Rishikesh (default) and Haridwar (config `scripts/stays/cities.py`, `--city <key>` on every step). Category pages `hotels/best-<category>-in-<city>.html`, landmark pages `hotels/best-stays-near-<landmark>.html`, search-phrase pages (one per row of `scripts/stays/search-pages.tsv`, address and `<h1>` = the searcher's exact phrase, never reworded), and the property page `hotels/stay.html` → `/hotels/stay?s=<slug>&c=<city>` (`noindex`; without `s` it redirects to the city's list).
- **Never hand-edit** these pages or `assets/js/modules/stays-index-data*.js`. Change the scripts, then `npm run build:stays` (Haridwar, then Rishikesh) and `npm run check:stays`. The build deletes only its own outputs (its `best-*` pages, `stay.html`, dropped phrase pages, old root-level copies), never hand-made pages.
- The search-phrase rule language is mirrored in `stays-index.js` (`ruleMatches`): change both together.
- Old root URLs (`/best-…`, `/stay`) 301 to `hotels/` in `vercel.json`, `_redirects` and `server.js`: keep all three in sync.
- Our own 3 stays (`OWN` in `build_pages.py`) are pinned and mixed into every list (on Haridwar pages labelled as in Rishikesh); never treat them as third-party. Linked stays come next; category pages fold the rest behind "View all".
- **View property** → lead popup (name/phone/email → `/api/contact`), then one redirect to the stay's verified booking page (`scripts/stays/ota-links.tsv`), or WhatsApp. The stays pages exist to sell our homestays: lead first, booking site second.
- Every page's footer lists every category page of both cities between `<!-- footer-stays -->` markers, written by `footer_links.py` (run by every build).
- Every stay has a permanent numeric `listing_id` (`scripts/stays/listing-ids.tsv`; ours are 1–3; never reused) plus its text `slug`.
- Google Maps stays (`gm`) show "View on Google Maps" instead of our map, are never pinned and stay off landmark pages; only places with a confirmed booking page (a real property page, never a booking-site homepage) are listed.
- Sitemap `<lastmod>` moves only when a page's content changes (`page_dates.py`, `page-dates.tsv`); after a push that changes `sitemap.xml`, `.github/workflows/indexnow.yml` pings IndexNow. The key file `998dc5c32f318e29058c994927f39486.txt` at the root proves ownership: **never delete or rename it**.
- BigQuery `places_lodging` (the Google Maps sweep, with phones) is **internal only**; the site never reads it. `market_properties` / view `stays_sheet` hold the directory snapshots. `.github/workflows/stays-refresh.yml` re-crawls on an adaptive 7 → 56 day gap.

**Scripts every page must load**
- `<script async src="/assets/js/analytics.js"></script>` immediately after `<meta charset>`: **add it to any new page** (`tests/integration/analytics.test.js` checks every root and `hotels/` page and fails on a hardcoded Google tag ID). GA4 is the only Google tag (`G-L82BSZMRLW`, in `analytics.js`); GTM was removed 2026-09-30: never add both, or page views double-count. Owner opt-out `?baba=<phrase>` (`?baba=wapas` resumes): only the phrase's SHA-256 is in the code; never commit the phrase.
- Then `<meta name="google-adsense-account" …>` + `<script async src="/assets/js/ads.js"></script>` (generated pages copy `thanks.html`'s head). `ads.js` decides ads per page type (plan in `docs/ARCHITECTURE.md`): guides, home and stays lists get ads, lead/booking pages none, the top of every page none. Add units to `UNITS`; the site isn't AMP, so never paste `amp-ad` / `amp-auto-ads`.
- Then the **theme head snippet**: `<meta name="theme-color" content="#fbfaf5">` + the inline script that sets `<html data-theme>` from `localStorage['rh-theme']` (light while unset) before the stylesheets, and one `<button class="theme-toggle" data-theme-toggle …>` in the header before the menu button. **Add both to any new page** (copy them from `thanks.html`, which the generated pages copy too); `tests/integration/theme.test.js` checks every page. `assets/js/modules/theme-toggle.js` (started by `site.js`) wires the button. The dark theme is opt-in for now (phase 1); following the system setting is a one-line change in the module and the snippet, after the owner's screenshot review.
- **Colours are tokens:** light values on `:root` in `styles.css`, dark ones in the single `:root[data-theme="dark"]` block at the end (`whatsapp-widget.css` has `--wa-*`). Never add a light colour literal for a surface or text; use a token so dark follows. `tests/visual/theme.test.js` checks no-flash, the toggle, contrast and overflow in both themes; `node tests/visual/screens.js shoot|compare` gives screenshots (`--ui` opens drawer, WhatsApp popup, date picker, map, booking gate) and a pixel diff for refactors that must not change the look. `page_dates.py` ignores `<head>` and the site header of hand-made pages, so edits there never re-date a page (`--reseed` after changing that rule keeps the dates).
- `assets/js/site.js` and `contact.js` are ES modules (backward-compat shims over `assets/js/modules/`): load them with `<script type="module" src="…">`, **never a plain `<script src>`**, or the browser throws "Cannot use import statement outside a module" and nav/search/forms break silently.
- Vendor libraries in `assets/vendor/` (flatpickr, libphonenumber, leaflet) are self-hosted (no CDN) and loaded as classic `<script src>` **before** the module scripts that use their globals.

**Affiliate links**
- `assets/js/modules/affiliate-links.js` is the single place for affiliate IDs (CJ publisher `CJ_PID` 101895722, Booking.com APAC link `CJ_BOOKING_LINK_ID` 17323528) and `affiliateLink(site, url)`. Every Booking.com link (site, BigQuery `booking_link`, `stays_sheet`) is a CJ deep link to the same property page. Never append `?aid=` (7854081 was Booking.com APAC's CJ advertiser ID, not ours).
- Booking.com's old affiliate widgets (`flexiproduct.js`) are retired (every product redirects to a 400): don't use them.

**Backend** (contracts in `docs/ARCHITECTURE.md`)
- `api/contact.js` (POST `/api/contact`): validates name/phone/details, phone (E.164) and dates server-side, stores the enquiry in BigQuery with its `source`, sends one Resend email. Always use `process.env.CONTACT_EMAIL`; never hardcode the address. Stay-popup leads (`source` `stay_*`) are internal-only and the WhatsApp opener never names the listing the guest clicked.
- ⚠️ The `resend` SDK does not go through a stubbed `globalThis.fetch`: running the handler locally with the real `.env` sends real email. Mock `Resend` or unset `RESEND_API_KEY` when testing.
- `api/bigquery.js`: credentials from `GOOGLE_APPLICATION_CREDENTIALS` (local key file `credentials/bigquery-service-account.json`, gitignored, never commit it) or `GOOGLE_APPLICATION_CREDENTIALS_JSON` (the full JSON, on Vercel, since functions can't read a local path). `scripts/setup-bigquery.js` creates the `enquiries` table (safe to re-run).
- Also `api/geo.js`, `api/currency-rates.js`, `api/otp-*.js` (optional email OTP; never blocks an enquiry).

**Hosting**: Vercel is primary (`vercel.json`). Netlify (publish dir `.`, no build command, `_redirects`) is kept for parity, but has no functions config, so `/api/*` would not run there.

## 📁 Key Files to Edit

- **Property cards / areas:** `assets/js/modules/data.js` (`AREAS`, `STAYS`; the single source of truth)
- **Stays pages:** `scripts/stays/` (then rebuild), never the generated output
- **WhatsApp number:** `WHATSAPP_PHONE` in `assets/js/modules/whatsapp-widget.js` and the `wa.me/...` links in `index.html` (hero, footer) and `contact.html`. WhatsApp is 80500 91290 only; 9027212484 is a second call number, keep it.
- **Contact email:** `CONTACT_EMAIL` env var; from/to in the Resend calls in `api/contact.js`
- **Contact form logic:** `assets/js/modules/contact-form.js`
- **GA4 ID:** `GA_MEASUREMENT_ID` in `assets/js/analytics.js`; **AdSense units:** `UNITS` in `assets/js/ads.js`
- **Styling:** `assets/css/styles.css` (site) / `assets/css/whatsapp-widget.css` (widget)
- **Hero images:** `assets/images/`

## 🚀 Local Development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # see docs/TESTING.md
```

`.env` (template in `.env.example`):
```
RESEND_API_KEY=<your-resend-api-key>
CONTACT_EMAIL=hello@rishikeshhomestays.com
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=credentials/bigquery-service-account.json
# GOOGLE_APPLICATION_CREDENTIALS_JSON={...}   (Vercel instead of the file path)
BIGQUERY_DATASET=rishikesh_homestays
BIGQUERY_ENQUIRIES_TABLE=enquiries
OTP_SECRET=                                   (optional; empty = no email OTP)
```

`.env`, `node_modules/`, `credentials/` and all `*.json` except `package.json`, `package-lock.json` and `vercel.json` are git-ignored. Never commit `.env` or the BigQuery key; rotate any key that was ever committed.

## 🔑 Dependencies

Runtime: **express**, **dotenv**, **body-parser**, **@google-cloud/bigquery**, **resend**, **libphonenumber-js** (server-side phone check; the browser uses the vendored bundle).

Dev-only (their browser bundles are copied into `assets/vendor/` and committed): **flatpickr**, **leaflet**, **jsdom** (DOM tests), **playwright** (real-browser visual test `tests/visual/no-horizontal-overflow.test.js`, part of `npm test`; jsdom can't do CSS layout. Also used for ad hoc screenshots: keep it installed).

After upgrading, re-copy the bundles:

```bash
cp node_modules/flatpickr/dist/flatpickr.min.{js,css} assets/vendor/flatpickr/
cp node_modules/libphonenumber-js/bundle/libphonenumber-min.js assets/vendor/libphonenumber/
cp node_modules/leaflet/dist/{leaflet.js,leaflet.css} assets/vendor/leaflet/ && cp node_modules/leaflet/dist/images/* assets/vendor/leaflet/images/
```

## 💡 Development Rules

- **One CSS file**: `assets/css/styles.css`.
- **Modular JavaScript**: new features go in `assets/js/modules/`; keep the `site.js` / `contact.js` shims.
- **Data centralization**: homestay cards and areas only in `data.js`; stays data only from `scripts/stays/`.
- **Validate forms twice**: in the browser (form modules, `validators.js`) and in `api/contact.js`.
- **Optimize images** before committing (WebP, sensible sizes).
- **Image credits**: never publish them and don't keep them in the repo (owner, 2026-10-05): no `CREDITS.md` files, credit lines or credit comments.
- **Responsive grid tracks**: use `minmax(0, 1fr)`, never a bare `1fr`, for any mobile single-column reset (`.search-grid`, `.guide-grid`…). A bare `1fr` keeps a min-content floor, so one wide descendant (an embed, a big image) blows the column past the screen; this shipped once and clipped a whole page on mobile. `tests/visual/no-horizontal-overflow.test.js` guards it.
- **No paid Google API calls** (Places) without the owner's OK; BigQuery reads/writes are fine.
- Commit only when asked.
