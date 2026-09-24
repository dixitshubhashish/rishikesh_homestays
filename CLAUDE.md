# Rishikesh Homestays

A modern hospitality platform for discovering premium homestays in Rishikesh, India.

## 📚 Documentation Map

- `README.md`, `CLAUDE.md`, `AGENTS.md` — stay at repo root (GitHub/Claude Code/Codex all read these by convention from the root).
- `.agents/coordination.md` — live multi-agent coordination ledger; stays under `.agents/` (see below).
- `docs/ARCHITECTURE.md` — module/file breakdown.
- `docs/TESTING.md` — how to run and write tests.
- `docs/TEST_RESULTS.md` — latest recorded test run output.
- `PROGRESS.md` — shipped/pending work log; stays at root for now since it's actively read/written by in-flight multi-agent tasks tracked in `.agents/coordination.md` — check that file before relocating it.

## Multi-Agent Coordination

When working alongside Codex or another agent, read `AGENTS.md` and `.agents/coordination.md` before editing. Claim the files or task you are working on, avoid overlapping active claims, and update the coordination ledger with changes, verification, and handoff notes when finished. The coordination file is the shared source of truth; it is file-based synchronization, not live messaging.

## 🏗️ Architecture

**Frontend:** Static HTML5/CSS3/Vanilla JS (no framework, no build step)
- `index.html` — Main landing page
- Content/guide pages (`homestays.html`, `about-rishikesh.html`, `places-to-visit.html`, `things-to-do-in-rishikesh.html`, `contact.html`, `thanks.html`, `triveni-ghat.html`, `kedarnath-yatra.html`, `haridwar-kumbh-2027.html`, `list-your-homestay.html`) live **at the repo root**, next to `index.html` — not in a `pages/` folder. They used to live under `pages/` with a matching `/pages/<slug>` URL; both the folder and the URL segment were dropped so the canonical URL matches the filename directly (`/contact` → `contact.html`), the same pattern `index.html` and `hotels/*.html` already use. This isn't just cosmetic: Vercel's `cleanUrls` (and Netlify's pretty-URL handling) only auto-map a clean URL to a `.html` file at the *same* path — a `vercel.json` **rewrite** pointing a root URL at a file in a different folder (e.g. `/contact` → `/pages/contact.html`) silently 404s in production despite working fine against the local `server.js` dev server, which is why the file location and the URL must match 1:1 rather than being bridged with a rewrite. `server.js` (local dev), `vercel.json`, and `_redirects` (Netlify) all 301-redirect any old `/pages/<slug>` request to the new root URL — keep all three in sync when adding/renaming a page, and always verify a new/changed route against the actual deployed URL, not just the local dev server.
- `hotels/` — Dedicated pages for individual bookable listings (still its own folder, with the segment in the URL — e.g. `/hotels/<slug>` maps to `hotels/<slug>.html`, unlike the root-level content pages above). Currently one: `advaitam-ganga-hill-view-luxury-3bhk-homestay-in-rishikesh.html`. A `STAYS` entry in `data.js` gets a clickable card (photo + title link to the page) by adding a `detailUrl: "/hotels/<slug>"` field; entries without one render as plain (non-linked) cards, same as before.
- `assets/css/styles.css` — Main site styles
- `assets/css/whatsapp-widget.css` — WhatsApp widget popup styles
- `assets/js/site.js` / `assets/js/contact.js` — backward-compat shims that import from `assets/js/modules/` and re-export onto `window`. Both are real ES modules (they use `import`), so every page loads them with `<script type="module" src="...">` — **never as a plain `<script src="...">`**, or the browser throws `Cannot use import statement outside a module` and silently breaks nav/search/forms on that page.
- `assets/js/modules/` — the actual modular source (see `docs/ARCHITECTURE.md` for full breakdown). Notable ones:
  - `data.js` — AREAS/STAYS data
  - `whatsapp-widget.js` — floating WhatsApp popup: name/phone/dates/guests/pets form, builds a formatted booking message, stores the enquiry via `/api/contact`, and opens WhatsApp
  - `whatsapp-link.js` — device-aware WhatsApp link builder: `wa.me` on mobile (opens the app), `web.whatsapp.com/send` on desktop (skips the wa.me interstitial so an already-open WhatsApp Web session gets the message in one hop); also rewrites every static `wa.me` link on a page via `enhanceStaticWhatsAppLinks()`
  - `validators.js` — shared phone validation (via `window.libphonenumber`) and check-in/check-out date-range validation, used by both the WhatsApp widget and the main contact form
  - `country-select.js` — builds the country-code `<select>` (flag + name + dial code) purely from `libphonenumber-js` metadata + `Intl.DisplayNames` (no hardcoded country list), and auto-detects the visitor's country via `geo.js` (falls back to India)
  - `geo.js` — shared IP-geolocation lookup used by both `country-select.js` and `currency.js`, backed by `/api/geo` (see below). Cached in-memory per page load and in `localStorage` for 24h, so a visitor's country is looked up at most once a day, not once per page.
  - `currency.js` — approximate visitor-currency price display (USD/EUR/GBP/AUD/CAD/JPY), backed by `/api/currency-rates`. Never replaces the INR price shown, only adds an approximate equivalent alongside it; rounds up to the nearest 5 units of the target currency.
  - `contact-form.js` — main contact form: phone validation, flatpickr check-in/check-out with range enforcement, counters
  - `button-loading.js` — shared busy-state helper (`setButtonLoading`/`clearButtonLoading`) used by every "-ing" submit button (contact form, host form, email OTP, OTA lead-gate) — shows a spinner + label, disables the button, and restores the exact original label afterward via a `data-original-label` attribute rather than a hardcoded string
  - `ota-lead-gate.js` — gates outbound links to third-party booking platforms (Airbnb/Booking.com/MakeMyTrip on the `hotels/` pages) behind a small name+phone modal; awaits a real `/api/contact` acknowledgement (spinner shown) before opening the external link, so the lead is actually captured before the guest leaves
- `assets/vendor/` — self-hosted third-party libraries (no CDN dependency, so the site works offline/behind restrictive networks):
  - `flatpickr/` — calendar date picker (check-in/check-out on both the contact form and WhatsApp widget)
  - `libphonenumber/` — Google's phone-number metadata library, used client-side for real per-country validation
  - Both loaded as plain `<script src="...">` (classic, not `type="module"`) **before** the `type="module"` scripts that use them, since they expose `window.flatpickr` / `window.libphonenumber` globals
- `assets/images/` — Property and hero images

**Backend:** Node.js/Express
- `server.js` — Dev server serving static files + API route
- `api/contact.js` — POST `/api/contact` handler that:
  - Validates form data (name, phone, details required)
  - Validates the phone number server-side using `libphonenumber-js` (expects E.164 — the frontend always normalizes to `+<countrycode><number>` before sending, so this is defense-in-depth, not the primary validation)
  - Validates check-in/check-out date range server-side (`validateDateRange` from `assets/js/modules/validators.js`)
  - Stores enquiry in BigQuery via `api/bigquery.js` (`insertEnquiry`), tagged with `source` (`website_form` from the contact page, `whatsapp_widget` from the WhatsApp popup, `ota_redirect_<platform>` from the OTA lead-gate, `host_application` from List Your Homestay)
  - Sends one branded HTML email (logo, WhatsApp CTA, book-direct pitch) via Resend. If the guest gave an email, they're the `to` and `CONTACT_EMAIL` is `cc`'d — one shared, reply-all-able thread instead of two disconnected emails. No guest email → internal-only notification to `CONTACT_EMAIL`. (`CONTACT_EMAIL` was defined in `.env` for a while but never actually read by the code — fixed; always reference `process.env.CONTACT_EMAIL`, don't hardcode the address again.)
  - Returns success/error JSON
- `api/bigquery.js` — BigQuery client + `insertEnquiry(row)`. Reads credentials from `GOOGLE_APPLICATION_CREDENTIALS` (local file path) or `GOOGLE_APPLICATION_CREDENTIALS_JSON` (inline JSON string, for Vercel). Dataset/table names come from `BIGQUERY_DATASET`/`BIGQUERY_ENQUIRIES_TABLE` (default `rishikesh_homestays.enquiries`).
- `scripts/setup-bigquery.js` — one-time/idempotent script that creates the dataset + `enquiries` table (schema + `created_at` day-partitioning). Re-run safely; skips creation if the table already exists.
- `api/geo.js` — GET endpoint backing `geo.js`. On Vercel, reads the free `x-vercel-ip-country` edge header (no external call, no latency). In local dev (no such header), falls back to `ipwho.is` (free, no API key/pricing tier), cached in-memory for 24h.
- `api/currency-rates.js` — GET endpoint backing `currency.js`. Fetches from [fawazahmed0/currency-api](https://github.com/fawazahmed0/currency-api) (open-source, GitHub-hosted, served as static JSON via jsDelivr — no API key, no pricing tier), cached server-side for 24h. Falls back to a small static rates table if the fetch ever fails.
- `api/otp-status.js` / `api/otp-send.js` / `api/otp-verify.js` — optional email OTP verification for the enquiry form, backed by `email-otp.js` + `otp-helpers.js`. Stateless (no storage) — the code is deterministically derived from `OTP_SECRET` + email + expiry, sent via Resend. Never blocks enquiry submission; if `OTP_SECRET` is unset, the verify-email UI simply never appears.

**Database:** Google BigQuery
- Table: `rishikesh_homestays.enquiries` — stores homestay booking enquiries with guest details, dates, preferences, and `source`
- Service account key lives at `credentials/bigquery-service-account.json` locally (gitignored — never commit it). On Vercel, paste the full JSON into the `GOOGLE_APPLICATION_CREDENTIALS_JSON` env var instead, since serverless functions can't read a local file path.

**Email:** Resend — transactional email service

**Hosting:** Vercel (primary — see `vercel.json` for clean-URL redirects) and Netlify (static export; redirects defined in `_redirects`, kept for parity)

## 📁 Key Files to Edit

- **Contact Email:** `api/contact.js` → from/to addresses in the Resend calls
- **Property/Site Data:** `assets/js/modules/data.js` — AREAS and STAYS listings (the single source of truth; `site.js` just re-exports it)
- **WhatsApp Number:** `WHATSAPP_PHONE` const in `assets/js/modules/whatsapp-widget.js`, and the `wa.me/...` hrefs in `index.html` (hero button, footer social icon) / `contact.html`
- **Hero Images:** Replace PNGs in `assets/images/`
- **Styling:** `assets/css/styles.css` (site-wide) / `assets/css/whatsapp-widget.css` (widget only)
- **Contact Form Endpoint:** `assets/js/modules/contact-form.js` — client-side submission logic, validation, date pickers

## 🚀 Local Development

```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

### Environment Variables (`.env`)
```
RESEND_API_KEY=<your-resend-api-key>
CONTACT_EMAIL=hello@rishikeshhomestays.com
PORT=3000
GOOGLE_APPLICATION_CREDENTIALS=credentials/bigquery-service-account.json
BIGQUERY_DATASET=rishikesh_homestays
BIGQUERY_ENQUIRIES_TABLE=enquiries
```

`.env`, `node_modules/`, `credentials/`, all other `*.json` files (except `package.json`/`package-lock.json`/`vercel.json`), and other local-only files are git-ignored (see `.gitignore`). Do not commit `.env` or the BigQuery service-account key — rotate any keys that were ever committed in the past.

## 🔑 Dependencies

Runtime:

- **express** — Web server
- **dotenv** — Environment variables
- **body-parser** — Parse form submissions
- **@google-cloud/bigquery** — Database (enquiries storage)
- **resend** — Email service
- **libphonenumber-js** — server-side phone number validation in `api/contact.js` (the browser also uses this library, but via the self-hosted bundle in `assets/vendor/libphonenumber/`, not this npm install)

Dev-only (their browser bundles are copied into `assets/vendor/` and committed — see that folder — so the npm packages themselves aren't needed at runtime):

- **flatpickr** — source of `assets/vendor/flatpickr/flatpickr.min.{js,css}`
- **jsdom** — DOM helper tests
- **playwright** — real-browser rendering for `tests/visual/no-horizontal-overflow.test.js` (jsdom doesn't run actual CSS layout, so it can't catch a page overflowing its viewport — only a real rendered browser can). That test spins up its own ephemeral static-file server on a random port and checks every page at mobile + laptop widths; it's part of `npm test`, no separate setup needed. Also used ad hoc during development for visual verification (screenshots, timing) — keep it installed even if no other automated test uses it yet.

If you upgrade `flatpickr` or `libphonenumber-js`, re-copy the built files:

```bash
cp node_modules/flatpickr/dist/flatpickr.min.{js,css} assets/vendor/flatpickr/
cp node_modules/libphonenumber-js/bundle/libphonenumber-min.js assets/vendor/libphonenumber/
```

## 📜 Netlify Deployment

- **Publish directory:** `.` (root)
- **Build command:** None (static files)
- **Custom domain:** rishikeshhomestays.com
- Contact form works via `/api/contact` route (may need serverless function adjustment for production)

## 💡 Development Rules

- **Keep CSS unified** — Single `assets/css/styles.css` for performance
- **Modular JavaScript** — Use `assets/js/modules/` for new features (see `docs/ARCHITECTURE.md`)
- **Data centralization** — Homestays and areas defined in `assets/js/modules/data.js`
- **Form validation** — Both frontend (contact-form module) and backend (`api/contact.js`)
- **Optimize images** — Use tools like ImageOptim before committing media files
- **Backward compatibility** — Keep `site.js` and `contact.js` shims for existing HTML
- **Responsive grid tracks** — use `minmax(0, 1fr)`, not a bare `1fr`, for any mobile single-column reset (`.search-grid`, `.guide-grid`, etc. in `styles.css`). A bare `1fr` still has an implicit min-content floor, so a single fixed-width descendant anywhere inside (an embed widget, an oversized image) silently blows the whole column out to that width instead of the screen's — this exact bug shipped once and clipped an entire page's text off-screen on mobile. `tests/visual/no-horizontal-overflow.test.js` guards against it, but don't reintroduce a bare `1fr` reset.

## 📊 Current State

- 6 main pages + homepage
- Contact form with email & database storage
- Responsive design, SEO-optimized
- Static hosting on Netlify
- ~10 untracked media files in working directory (ChatGPT screenshots, rafting video)
