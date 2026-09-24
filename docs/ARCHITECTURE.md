# Architecture Overview

## Project Structure

```
rishikesh_homestays/
├── assets/
│   ├── css/
│   │   └── styles.css              # All styling (design tokens, components)
│   ├── js/
│   │   ├── index.js                # Main entry point (ES modules)
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
