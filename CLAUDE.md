# Rishikesh Homestays

A modern hospitality platform for discovering premium homestays in Rishikesh, India.

## Multi-Agent Coordination

When working alongside Codex or another agent, read `AGENTS.md` and `.agents/coordination.md` before editing. Claim the files or task you are working on, avoid overlapping active claims, and update the coordination ledger with changes, verification, and handoff notes when finished. The coordination file is the shared source of truth; it is file-based synchronization, not live messaging.

## 🏗️ Architecture

**Frontend:** Static HTML5/CSS3/Vanilla JS (no framework, no build step)
- `index.html` — Main landing page
- `pages/` — Dedicated pages (homestays, about-rishikesh, places-to-visit, things-to-do, contact, thanks, triveni-ghat)
- `assets/css/styles.css` — Main site styles
- `assets/css/whatsapp-widget.css` — WhatsApp widget popup styles
- `assets/js/site.js` / `assets/js/contact.js` — backward-compat shims that import from `assets/js/modules/` and re-export onto `window`. Both are real ES modules (they use `import`), so every page loads them with `<script type="module" src="...">` — **never as a plain `<script src="...">`**, or the browser throws `Cannot use import statement outside a module` and silently breaks nav/search/forms on that page.
- `assets/js/modules/` — the actual modular source (see ARCHITECTURE.md for full breakdown). Notable ones:
  - `data.js` — AREAS/STAYS data
  - `whatsapp-widget.js` — floating WhatsApp popup: name/phone/dates/guests/pets form, builds a formatted booking message, stores the inquiry via `/api/contact`, and opens WhatsApp
  - `whatsapp-link.js` — device-aware WhatsApp link builder: `wa.me` on mobile (opens the app), `web.whatsapp.com/send` on desktop (skips the wa.me interstitial so an already-open WhatsApp Web session gets the message in one hop); also rewrites every static `wa.me` link on a page via `enhanceStaticWhatsAppLinks()`
  - `validators.js` — shared phone validation (via `window.libphonenumber`) and check-in/check-out date-range validation, used by both the WhatsApp widget and the main contact form
  - `country-select.js` — builds the country-code `<select>` (flag + name + dial code) purely from `libphonenumber-js` metadata + `Intl.DisplayNames` (no hardcoded country list), and auto-detects the visitor's country via IP geolocation (`ipapi.co`, 2.5s timeout, falls back to India)
  - `contact-form.js` — main contact form: phone validation, flatpickr check-in/check-out with range enforcement, counters
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
  - Stores inquiry in Supabase `enquiries` table, tagged with `source` (`website_form` from the contact page, `whatsapp_widget` from the WhatsApp popup)
  - Sends tabular email to `CONTACT_EMAIL` via Resend
  - Sends confirmation email to guest (if email provided)
  - Returns success/error JSON

**Database:** Supabase (PostgreSQL)
- Table: `enquiries` — stores homestay booking inquiries with guest details, dates, preferences, and `source`

**Email:** Resend — transactional email service

**Hosting:** Netlify (static export; redirects defined in `_redirects`)

## 📁 Key Files to Edit

- **Contact Email:** `api/contact.js` → from/to addresses in the Resend calls
- **Property/Site Data:** `assets/js/modules/data.js` — AREAS and STAYS listings (the single source of truth; `site.js` just re-exports it)
- **WhatsApp Number:** `WHATSAPP_PHONE` const in `assets/js/modules/whatsapp-widget.js`, and the `wa.me/...` hrefs in `index.html` (hero button, footer social icon) / `pages/contact.html`
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
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
RESEND_API_KEY=<your-resend-api-key>
CONTACT_EMAIL=hello@rishikeshhomestays.com
PORT=3000
```

`.env`, `node_modules/`, and other local-only files are git-ignored (see `.gitignore`). Do not commit `.env` — rotate any keys that were ever committed in the past.

## 🔑 Dependencies

Runtime:

- **express** — Web server
- **dotenv** — Environment variables
- **body-parser** — Parse form submissions
- **@supabase/supabase-js** — Database + auth
- **resend** — Email service
- **libphonenumber-js** — server-side phone number validation in `api/contact.js` (the browser also uses this library, but via the self-hosted bundle in `assets/vendor/libphonenumber/`, not this npm install)

Dev-only (their browser bundles are copied into `assets/vendor/` and committed — see that folder — so the npm packages themselves aren't needed at runtime):

- **flatpickr** — source of `assets/vendor/flatpickr/flatpickr.min.{js,css}`
- **jsdom** — DOM helper tests

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
- **Modular JavaScript** — Use `assets/js/modules/` for new features (see ARCHITECTURE.md)
- **Data centralization** — Homestays and areas defined in `assets/js/modules/data.js`
- **Form validation** — Both frontend (contact-form module) and backend (`api/contact.js`)
- **Optimize images** — Use tools like ImageOptim before committing media files
- **Backward compatibility** — Keep `site.js` and `contact.js` shims for existing HTML

## 📊 Current State

- 6 main pages + homepage
- Contact form with email & database storage
- Responsive design, SEO-optimized
- Static hosting on Netlify
- ~10 untracked media files in working directory (ChatGPT screenshots, rafting video)
