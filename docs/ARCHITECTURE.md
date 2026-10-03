# Architecture Overview

## Project Structure

```
rishikesh_homestays/
├── assets/
│   ├── css/
│   │   └── styles.css              # All styling (design tokens, components)
│   ├── js/
│   │   ├── index.js                # Main entry point (ES modules)
│   │   ├── analytics.js            # GA4 gtag.js loader (measurement ID lives here)
│   │   ├── site.js                 # Backward compatibility shim
│   │   ├── contact.js              # Backward compatibility shim
│   │   └── modules/
│   │       ├── data.js             # Homestay and area data
│   │       ├── dom-helpers.js      # DOM utility functions
│   │       ├── nav.js              # Navigation toggle
│   │       ├── stays-renderer.js   # Stay card rendering & filtering
│   │       ├── search-form.js      # Search & area dropdown setup
│   │       ├── contact-form.js     # Contact form submission & counters
│   │       └── enquiry-prefill.js  # URL param handling
│   └── images/                     # Placeholder & actual images
├── pages/                          # HTML pages
│   ├── homestays.html
│   ├── contact.html
│   ├── things-to-do.html
│   ├── about-rishikesh.html
│   ├── triveni-ghat.html
│   ├── places-to-visit.html
│   └── thanks.html
├── api/
│   └── contact.js                  # Express API handler
├── index.html                      # Landing page
├── server.js                       # Express dev server
├── CLAUDE.md                       # Project documentation
└── docs/
    └── ARCHITECTURE.md             # This file
```

Note: this tree is illustrative of the original module layout, not a full current listing — see `CLAUDE.md`'s own Architecture section for the up-to-date file map (`hotels/`, `tests/`, `scripts/`, `docs/`, etc. have been added since).

## Module Breakdown

### `modules/data.js`
- **Purpose**: Central data store for static content
- **Exports**: 
  - `AREAS` — list of stay locations
  - `STAYS` — homestay listing data with properties
- **Usage**: Imported by renderer and search modules

### `modules/dom-helpers.js`
- **Purpose**: Reusable DOM query and manipulation utilities
- **Exports**: 
  - `qs()` / `qsa()` — query selectors
  - `addClass()` / `removeClass()` / `toggleClass()`
  - `setAttr()` / `getAttr()`
- **Benefit**: Consistent, safe DOM operations across modules

### `modules/nav.js`
- **Purpose**: Mobile navigation toggle
- **Exports**: `setupNav()`
- **Dependencies**: dom-helpers.js
- **Triggers**: On hamburger button click

### `modules/stays-renderer.js`
- **Purpose**: Render homestay cards and handle filtering
- **Exports**:
  - `createStayCard()` — generates card HTML
  - `renderStays()` — filters and renders grid
  - `hydrateFilters()` — populates dropdown options
- **Dependencies**: data.js, dom-helpers.js

### `modules/search-form.js`
- **Purpose**: Search bar and area dropdown setup
- **Exports**:
  - `setupQuickSearch()` — form submission handler
  - `setupAreaDropdowns()` — populate area selects
  - `setupDatePickers()` — date input interactions
- **Dependencies**: data.js, dom-helpers.js

### `modules/contact-form.js`
- **Purpose**: Contact form submission and guest counters
- **Exports**:
  - `setupContactForm()` — form validation and API call
  - `setupCounters()` — increment/decrement buttons
- **API Integration**: Posts to `/api/contact`

### `modules/enquiry-prefill.js`
- **Purpose**: URL parameter handling for enquiry forms
- **Exports**:
  - `setupEnquiryPrefill()` — prefill homestay name
  - `applyListingParams()` — apply filter from URL
- **Use Case**: Linking from stay card → contact form with stay pre-selected

## Initialization Flow

### Modern ES Modules (Future)
```javascript
// index.js - Import and orchestrate
import { setupNav } from './modules/nav.js';
import { setupContactForm } from './modules/contact-form.js';
// ... etc

document.addEventListener("DOMContentLoaded", () => {
  setupNav();
  setupContactForm();
  // ... initialize all modules
});
```

### Backward Compatibility (Current)
```
site.js / contact.js
  ↓ (import from)
modules/*.js
  ↓ (re-export to window)
HTML pages (can use old references)
```

## Design Decisions

### Why Modular?
1. **Testability** — Each module can be tested independently
2. **Maintainability** — Clear single responsibility
3. **Reusability** — Modules can be used across pages
4. **Scalability** — Easy to add new features without tangling code

### Why Backward Compatibility?
- Existing HTML files continue to work unchanged
- No disruption to deployed pages
- Gradual migration path to pure ES modules
- Falls back gracefully if old script references remain

### No Build Process
- Uses native ES modules directly
- Simple `<script type="module">` in HTML
- No webpack, rollup, or bundler needed
- Fast development iteration

## CSS Architecture

### Design Tokens (`:root`)
- `--ink` — text color
- `--river` — primary action color
- `--leaf`, `--marigold`, `--clay` — accent colors
- `--paper`, `--panel` — backgrounds
- `--shadow` — elevation
- `--radius` — border radius

### Component Patterns
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-whatsapp`
- `.card`, `.homestay-card`, `.info-card`
- `.hero`, `.section`, `.container`
- `.field`, `.tag-row`, `.filters`

### Responsive
- Mobile-first approach
- Flexbox and CSS Grid
- No fixed widths (uses `min()`, `max()`, `clamp()`)

## API Integration

### `/api/contact` — POST
**Input:**
```json
{
  "name": "string",
  "phone": "string",
  "email": "string (optional)",
  "preferred_stay": "string (optional)",
  "area": "string",
  "coming_from_city": "string",
  "adults": "number",
  "children": "number",
  "pets": "none|dogs|cats",
  "pet_count": "number",
  "details": "string"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Thank you! We will contact you shortly.",
  "enquiryId": "uuid"
}
```

**Actions:**
1. Validates required fields (name, phone, details)
2. Stores in BigQuery `enquiries` table
3. Sends email to admin via Resend
4. Sends confirmation to guest (if email provided)
5. Returns success/error response

## Performance Considerations

- **Minimal JS** — Only ~10KB of business logic
- **No Framework Overhead** — Vanilla JS runs fast
- **Single CSS File** — No waterfall requests
- **Static HTML** — Netlify can cache aggressively
- **Modular Imports** — Browsers cache modules independently

## Future Improvements

1. **Module Bundling** — Build step for production minification
2. **Unit Tests** — Jest/Vitest for each module
3. **TypeScript** — Type safety without overhead
4. **State Management** — If logic becomes more complex
5. **Component Library** — Reusable web components

## Migration Guide (Old → New)

### For Developers
Instead of editing one massive `site.js`, import specific modules:

```javascript
// Before
const AREAS = [...]; // 9 lines
const STAYS = [...]; // 60 lines
function setupNav() { ... } // 10 lines
// ... hundreds of lines mixed together

// After
import { AREAS, STAYS } from './modules/data.js';
import { setupNav } from './modules/nav.js';
// Each concern in its own place
```

### For HTML Pages
No changes required — backward-compatible shims ensure old references work.

But for new pages, prefer:
```html
<!-- Modern approach -->
<script type="module" src="/assets/js/index.js"></script>

<!-- Old approach (still works) -->
<script src="/assets/js/site.js"></script>
```

## File Size Comparison

| File | Lines | Purpose |
|------|-------|---------|
| site.js (old) | 212 | Everything mixed |
| **New Modular:** | | |
| data.js | 60 | Data only |
| dom-helpers.js | 35 | Utilities |
| nav.js | 12 | Nav logic |
| stays-renderer.js | 50 | Card rendering |
| search-form.js | 30 | Search UI |
| contact-form.js | 60 | Form handling |
| enquiry-prefill.js | 15 | URL params |
| **Total** | **262** | Better organized |

*Slightly larger combined, but much more maintainable.*

## Stays guide & revenue layer (2026-10)

The site is now a Rishikesh/Haridwar travel guide that sells the owner's own homestays first. On top of the modules above:

### Pages
- **Hand-made (repo root):** guides `about-rishikesh`, `places-to-visit`, `things-to-do-in-rishikesh`, `triveni-ghat`, `kedarnath-yatra`, `haridwar-kumbh-2027`, `driving-from-delhi-to-rishikesh`; lead pages `contact`, `homestays`, `list-your-homestay`, `bike-and-taxi-rental-in-rishikesh`, `thanks`, `404`; own listing `hotels/advaitam-…`.
- **Generated (`hotels/`, by `scripts/stays/build_pages.py`, never hand-edited):** `best-<category>-in-<city>` (type, size, theme categories for Rishikesh and Haridwar), `best-stays-near-<landmark>` (14), and the property page `stay.html` (`/hotels/stay?s=<slug>&c=<city>`). Category links are grouped (Accommodation type / By size / Themes & facilities) and sorted by count.

### Modules (`assets/js/modules/`)
| Module | Job |
|---|---|
| `stays-index.js` | Lists on the generated pages: search/filter (`k:` type, `t:` theme, `b:` bedrooms), our own stays mixed in, "View property" |
| `stays-index-data.js`, `stays-index-data-haridwar.js` | Generated data per city (never hand-edit) |
| `stay-page.js` | Property page: facts, lead popup → one booking redirect, WhatsApp, sidebar (our homestays, grouped "More stays in …"), Leaflet map (not for Google-sourced `gm` stays: "View on Google Maps") |
| `landmark-map.js` | Map on landmark pages (lazy Leaflet) |
| `affiliate-links.js` | **Only place for affiliate IDs**: CJ PID + Booking.com link id; `affiliateLink(site, url)` wraps Booking.com pages in the CJ deep link |
| `rental-form.js` | Bike & taxi rental enquiry form (phone/date validation, `rental_enquiry` payload, WhatsApp prefill) |
| `whatsapp-widget.js`, `whatsapp-link.js` | Floating WhatsApp popup; device-aware WhatsApp links |
| `contact-form.js`, `validators.js`, `country-select.js`, `geo.js`, `currency.js`, `button-loading.js`, `ota-lead-gate.js` | Shared form/phone/date/currency helpers (see CLAUDE.md) |

Top-level scripts: `assets/js/analytics.js` (GA4, owner opt-out) and `assets/js/ads.js` (AdSense: per page type, top of page ad-free, rails only on wide screens; lead pages none).

### Data pipeline (`scripts/stays/`, see its README)
crawl → `process.py` (areas, types, tags, bedrooms, permanent `listing_id`; also Google Maps places via `import_google_stays.py`) → booking-link matching (`booking-match.mjs` rule, `verify_candidates.mjs`, `guess_booking_slugs.mjs`, `sitemap_candidates.py` + `verify_platform.mjs`, `postcheck_matches.py`, `merge_ota.py` → `ota-links.tsv`) → `build_pages.py` (pages, sitemap, llms.txt) → BigQuery (`push_bigquery.mjs` → `market_properties` + view `stays_sheet`; `push_places.mjs` → `places_lodging`, internal, with phones).

### `/api/contact` sources
`website_form`, `whatsapp_widget`, `ota_redirect_<platform>`, `stay_*` (stay-page popup: internal-only email with a "WhatsApp <name> now" button), `host_application`, `rental_enquiry` (rental page: subject "Rental enquiry: <name> → <service>", same-day rentals allowed). All stored in BigQuery `enquiries`.
