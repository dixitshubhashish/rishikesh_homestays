# Progress Tracker

Self-tracking log so work doesn't get lost across a long session. Update this file whenever a feature ships or a bug is found.

## ✅ Shipped — page rename + SEO gap audit

- **`pages/things-to-do.html` renamed to `pages/things-to-do-in-rishikesh.html`** (URL keyword reinforcement for search). All ~48 internal link references updated across every page, `sitemap.xml`, `llms.txt`. Old URLs (both `/pages/things-to-do` and `/pages/things-to-do.html`) 301-redirect to the new one in both `server.js` (local dev) and `_redirects` (Netlify production) — nothing that was ever indexed or bookmarked breaks.
- **SEO gap audit across every page**, checking: sitemap completeness vs actual files (✅ complete, `thanks.html` correctly excluded as `noindex`), image alt-text coverage (✅ every image on every page has non-empty alt text), broken internal links (✅ none found, verified programmatically), duplicate titles/descriptions (✅ none), heading structure (✅ exactly one `<h1>` per page), `lang` attribute (✅ present everywhere).
- **Found and fixed 3 real gaps**: `kedarnath-yatra.html`'s title was 64 characters (Google truncates past ~60, would have cut off "Itineraries" mid-word) — shortened to 55. Two meta descriptions (`places-to-visit.html` at 164 chars, `list-your-homestay.html` at 166 chars) exceeded Google's ~160-char display limit and would render with an ellipsis cutoff — both trimmed to fit while keeping the key info.
- **Added `og:locale`** (was missing on every single page) — a minor but real gap for how Facebook/LinkedIn and some crawlers interpret language/region when rendering link previews.

152/152 tests passing, all 11 pages verified 200, all old URLs verified redirecting correctly.

## 🐛 Bug fixed — Places/Restaurants tabs never activated at all

**Root cause**: `setupPageTabs` was imported into `assets/js/site.js` but never actually called inside the `DOMContentLoaded` handler — a plain "wired the import, forgot the invocation" mistake. The tab buttons and panels existed and were styled correctly, but the JS that makes clicking them do anything never ran on any page. This is exactly why the "Places to Visit" button showed no active-state styling even by default — `activate()` never fired at all.

Fixed by adding the missing `setupPageTabs();` call. Also fixed two smaller, real issues found while debugging:
- The auto-popup "shown" flag was written only when the 20-second timer *fired*, not when it started — meaning a visitor browsing between several pages (spending 20+s on each) could see the popup/nudge re-trigger fresh on every page, not just once per session. Now claimed immediately.
- Switching tabs didn't adjust scroll position — since Places (22 cards) and Restaurants (a handful) have very different heights, switching while scrolled down could strand the visitor in blank space. Now smoothly scrolls back to the tab switcher on every click.

**New regression test** (`tests/modules/site-shim.test.js`) specifically guards against this class of bug going forward: it statically checks that every named import in `site.js` is actually referenced again in the file (not just imported and forgotten), and specifically that `setupPageTabs()` is called inside the `DOMContentLoaded` handler, not just imported.

**Follow-up bug once tabs actually worked**: huge empty gap between the tab buttons and the panel content below. The tab-switcher's wrapping `<section class="section">` and the panel section right after it both carry the shared `.section`/`.guide-section` rule's `padding: 82px 0`, so their paddings stacked into ~164px of pure whitespace. Fixed by adding a `.page-tabs-section` class that zeroes just that section's bottom padding (needed `!important` since a later mobile-breakpoint rule on the same selector would otherwise win by source order).

152/152 tests passing.

## ✅ Shipped

- **Modular JS architecture** — `assets/js/modules/*`, with `site.js`/`contact.js` as backward-compat shims (now correctly loaded as `type="module"` everywhere — see Bugs Fixed).
- **WhatsApp popup widget** (`whatsapp-widget.js`) — name/phone/dates/adults/children/pets/message form, opens WhatsApp with a formatted plain-text message, saves to DB via `/api/contact` with `source: whatsapp_widget`.
- **Device-aware WhatsApp linking** (`whatsapp-link.js`) — `wa.me` on mobile (opens app), `web.whatsapp.com/send` on desktop (one hop if WhatsApp Web is already open). Rewrites every static `wa.me` link on a page too.
- **Phone validation** (`validators.js` + `country-select.js`) — real per-country validation via `libphonenumber-js` (self-hosted, `assets/vendor/libphonenumber/`), country dropdown built from library metadata + `Intl.DisplayNames`, IP-based auto-detect (`ipapi.co`, fallback India). Validated client-side and server-side (`api/contact.js`).
- **Date-range validation + calendar** — flatpickr (self-hosted, `assets/vendor/flatpickr/`) on check-in/check-out, check-out forced after check-in, both client and server validated.
- **Main contact form** (`pages/contact.html` / `contact-form.js`) — now also opens WhatsApp with a formatted message (email + "coming from city" included) on submit, in addition to the existing DB save.
- **Mobile responsiveness pass** — 16px inputs (no iOS zoom), ≥36-44px touch targets, popup max-height fixed for short viewports, verified breakpoints collapse before phone widths.
- **SEO / AI-search compliance** — canonical tags, OG/Twitter cards, `BreadcrumbList` + `LodgingBusiness`/`WebSite` JSON-LD on every page, `sitemap.xml` with `lastmod`/`priority`, `llms.txt` added, `thanks.html` set `noindex`.
- **Footer consistency bug fixed** — every page now uses the same rich footer (brand/contact/social/nav columns) that only `index.html` used to have; `thanks.html` had no footer *and* no `site.js` at all — both fixed.
- **Real photos sourced** — 9 real, appropriately-licensed (CC/public-domain, Wikimedia Commons, verified per-file via EXIF/description) photos downloaded to `assets/images/things-to-do/`: Neelkanth Mahadev, Kunjapuri Devi Temple, Neer Garh Waterfall, river rafting, Ganga Aarti, Beatles Ashram, Lakshman Jhula, Parmarth Niketan, Ram Jhula. Full attribution in `assets/images/things-to-do/CREDITS.md` (required for CC BY-SA compliance).
- **`places-to-visit.html` fixed** — all 6 place cards were cycling through only 3 generic stock photos via CSS `nth-child` selectors (not real photos of each place). Replaced with real `<img>` tags per place, each with correct alt text; added on-page photo-credit line linking to CREDITS.md.
- **Country dropdown label fixed** — was showing full country names ("India (+91)") which clipped in the narrow select box; now shows compact ISO code format ("🇮🇳 IN +91") with full name in a `title` tooltip.

## 🐛 Bugs found and fixed

- `site.js` / `contact.js` contain `import` statements but were loaded via plain `<script src>` on every page → silent `SyntaxError`, broke nav/search/forms site-wide. Fixed: all loaded as `type="module"`.
- WhatsApp FAB icon SVG path was malformed (rendered as a blob, not the WhatsApp logo). Fixed with a verified path.
- WhatsApp message used emoji (🏠) and unicode bullets (•) that rendered as a broken "tofu" character on some WhatsApp clients. Fixed: plain ASCII (`-` bullets, no emoji) in all WhatsApp-bound messages.
- Instagram footer link used `instagram.com` instead of canonical `www.instagram.com/rishikesh.homestays`. Fixed.
- **Footer inconsistency** (see above) — fixed.
- **`country-select.js` dropdown appeared empty** — root cause was a missing `<script src="assets/vendor/libphonenumber/libphonenumber-min.js">` tag on the pages that use it. Fixed on `index.html` and `contact.html`.
- **Favicon missing on every page except the homepage** — only `index.html` had the `<link rel="icon">`/`<link rel="manifest">` tags. Added to all 9 subpages, plus copied `assets/images/logo.ico` to `/favicon.ico` at the site root as a fallback (browsers/crawlers check that conventional path regardless of the `<link>` tag).
- **"Plan my stay" nav CTA unreadable on its own page** — on `pages/contact.html`, the CTA link carries `aria-current="page"` (it points to that same page). The generic `.site-nav a[aria-current="page"]` rule (higher specificity than `.nav-cta` alone) was overriding the button's dark background with a light one, while `color: #fff !important` still forced white text — white-on-light-blue, unreadable. Also found and cleaned up a second, unrelated bug in the same CSS block: three separate `.nav-cta` rule sets had accumulated over time with directly conflicting `color`/`background` values (one setting `color: var(--river)` — dark green — which fought the `!important` white from another rule), plus a dead hover rule immediately shadowed by a later one. Consolidated into one clear set of rules.

## ✅ Shipped — clean URLs & mobile menu

- **`.html` no longer shows in the address bar.** `server.js` now 301-redirects any `.html` URL to its clean equivalent (`/pages/contact.html` → `/pages/contact`) and serves the clean URL by mapping it to the matching file on disk. `_redirects` carries the same two-way mapping for the Netlify production deploy (redirect old → new, then rewrite new → the actual `.html` file so the browser bar never shows the extension). All ~300 internal links across every page, `sitemap.xml`, and `llms.txt` updated to the extensionless form. Fixed one edge case along the way: `/index.html` was redirecting to `/index` instead of `/`.
- Also cleaned up `pages/contact.html`'s form tag: dropped the stale `data-netlify="true"` (this form hasn't used Netlify Forms since it was rebuilt to POST to `/api/contact` via `fetch`) and updated its native `action` fallback to the clean URL.
- **Mobile menu made more discoverable** — was an icon-only hamburger square; now a pill-shaped button with the hamburger icon *and* a "Menu" text label, per user request for something "more visible on mobile."
- Added regression tests: every page's internal links must never contain `.html`, and every page must declare a favicon.

## ✅ Shipped — About Rishikesh depth + new Restaurants & Cafes page

- **`pages/about-rishikesh.html` rewritten with real depth**: history/religious significance (name origins, Mahabharata/Ramayana references, Raghunath Temple, Adi Shankaracharya's 9th-century visit), how the Beatles' Feb 1968 stay is credited with putting Rishikesh on the global yoga map, its adventure-tourism identity, a Rishikesh-vs-Haridwar comparison (~25 km apart, different character), and a section on Haridwar's Kumbh Mela with 2027 as the next expected gathering — deliberately hedged (no fixed 2027 dates stated, since those are astrologically set and confirmed close to the event; sourced via web research, not fabricated).
- **New page: `pages/restaurants-cafes.html`** — the vegetarian/alcohol-free municipal rule explained (not just stated), food-style categories (Israeli, German bakery, organic/health, local thali, riverside cafes), area clusters (Laxman Jhula–Tapovan strip vs Ram Jhula/Swarg Ashram vs Triveni Ghat), and ~10 real, named cafes/restaurants with what they're actually known for. **No images used** — researched specifically for this page and confirmed no verified Wikimedia photo exists of Rishikesh's cafe scene (a "Beatles cafe" hit was actually an unrelated derelict building, rejected).
- Both additions wired into nav/footer on every page, `sitemap.xml`, `llms.txt`, and `_redirects`.

## ✅ Shipped — nav consolidation (10 items → cleaner structure)

The nav had grown to 10 top-level items and looked cluttered. Consolidated:

- **Restaurants & Cafes merged into Places to Visit** as an in-page tab (new `assets/js/modules/page-tabs.js`, hash-deep-linkable — `/pages/places-to-visit#restaurants` opens directly to that tab). The standalone `pages/restaurants-cafes.html` page was removed; both its old clean URL and `.html` URL 301-redirect to the new location (`server.js` for local dev, `_redirects` for Netlify).
- **New dedicated `pages/haridwar-kumbh-2027.html` page**, split out of the paragraph that was in `pages/about-rishikesh.html` (which now has a short teaser + link instead, avoiding duplicate content). Includes the specific 2027 Shahi Snan dates the user asked to pull from a tour-operator source, but explicitly labeled "reported, not officially confirmed" — cross-checked against Wikipedia, which still lists 2033 as the next Kumbh under the strict 12-year cycle, and that discrepancy is disclosed on the page rather than picking one source silently.
- Net nav count unchanged (still 10), but now: Restaurants & Cafes is discoverable as a tab within Places (not a competing top-level item), and Kumbh 2027 — a genuinely time-sensitive, high-interest topic — gets its own dedicated page instead of being buried mid-paragraph in About Rishikesh.
- `sitemap.xml`, `llms.txt`, `server.js`, `_redirects`, and nav/footer across all pages updated consistently. 9 new/updated tests added (147/147 passing), including regression guards that the old restaurants-cafes URL is gone from every internal link and that the tab markup exists.

## ✅ Shipped — WhatsApp widget bug fix + site-wide rollout

- **Fixed: submit button was invisible without scrolling.** The popup was one long scrollable box (header included), and "Send on WhatsApp" was the very last thing inside the form — easy to never see at all, per the user's screenshot. Restructured so only the middle content scrolls: header and a new fixed footer (containing the submit button) stay pinned via `flex-shrink: 0` on a proper flex-column popup, with `flex: 1 1 auto; min-height: 0` on the scrolling body. The button itself moved from inside `<form>` to the fixed footer, wired via the standard HTML `form="whatsapp-form"` attribute (no JS changes needed — the existing submit listener still fires correctly, verified with a jsdom functional test).
- **Widget rolled out to all 11 pages, not just the homepage.** Added the widget stylesheet, both vendor scripts (flatpickr + libphonenumber), and the init snippet to the 10 pages that were missing them — checked each one individually so pages that already had the vendor scripts for their own forms (contact, homestays, list-your-homestay) didn't get duplicates.
- 2 new regression tests added: every page must load the widget + its dependencies, and the submit button must live in the footer, not nested inside the form. 149/149 tests passing.

## 🔔 Also shipped — WhatsApp auto-popup

- **Desktop**: after 20 seconds on a page, the WhatsApp widget auto-opens (once per browser session, never if the visitor already interacted with it manually).
- **Mobile**: deliberately does *not* auto-open the full form — that's the kind of intrusive mobile interstitial Google's own mobile-usability guidelines flag, and it just feels spammy on a small screen. Instead, the FAB pulses briefly and a small dismissible "💬 Need help planning your stay?" bubble appears next to it for ~8 seconds, tap to open the full form, otherwise it fades without blocking any page content.
- Verified via a functional smoke test (jsdom + shortened delay in a throwaway copy, not the shipped file): desktop opens the popup, mobile shows the nudge with the pulse class — confirmed both branches actually fire correctly.

## ⚠️ Flagged to user — partially fixed, one choice still open

- Codex's `things-to-do.html` rebuild used AI-generated images with alt text presenting them as specific real named sites (no "illustrative" qualifier), unlike Codex's later, more careful work on `places-to-visit.html` (AI only for photo-gaps, clearly labeled "Illustrative view of..."). Claude fixed the labeling on `things-to-do.html` and `triveni-ghat.html` to match that same honest pattern — see `.agents/coordination.md` for the full note.
- **Still open, needs your call**: whether to keep the AI illustrations on `things-to-do.html`/`triveni-ghat.html` for places where real verified photos already exist unused in `assets/images/things-to-do/` (Neelkanth Mahadev, Neer Garh Waterfall, Ganga Aarti), or swap back to those. Not assumed either way.

## ⚠️ Known issue — misidentified form (my mistake, needs correcting)

There are **two different enquiry forms** on this site, and I initially enhanced the wrong one:

1. `pages/contact.html` — the main "Send enquiry" / "Plan my stay" form. **This is the one I upgraded** with country-aware phone validation, flatpickr dates, and WhatsApp-message-on-submit.
2. `pages/homestays.html` sidebar — headed **"Ask for a shortlist"** (this is what the user meant when asking about "Ask for a shortlist"). This form is still the old, basic version: free-text "Dates" field, no phone validation, no country code, and — importantly — **it submits via Netlify Forms (`data-netlify="true"`, action `/pages/thanks.html`), not `/api/contact`, so it never reaches Supabase at all.**

**Next step:** rebuild the `pages/homestays.html` "Ask for a shortlist" form to match `contact.html`: country-code phone validation, flatpickr check-in/check-out, email field, "coming from city" field, submit to `/api/contact` (so it actually saves to the DB), and open WhatsApp with the same formatted-message pattern.

## ✅ Also shipped (new pages)

- **`pages/list-your-homestay.html`** — new host-onboarding page (Airbnb-style "list with us"): benefits, how-it-works steps, requirements, and an application form (`host-form.js`) that validates phone, opens WhatsApp with a formatted application message, and saves to `/api/contact` with `source: host_application`.
- **`pages/kedarnath-yatra.html`** — new page positioning Rishikesh as the Char Dham/Garhwal gateway: route/distance to Kedarnath, registration note, best season, distances to Badrinath/Gangotri/Yamunotri/Auli/Valley of Flowers, sample itinerary, practical tips. Content researched and fact-checked via web search; flagged uncertain figures (exact km, yearly registration process, temple open/close dates) as "verify current" rather than stated as fixed.
- Both new pages added to nav (all pages), footer (all pages), `sitemap.xml`, and `llms.txt`.
- Country dropdown now shows compact `🇮🇳 IN +91` format instead of full names that clipped in the select box (full name in `title` tooltip).
- Removed visible on-page photo-credit line per request; attribution kept as HTML comments per image + `CREDITS.md` (keeps CC BY-SA compliance without a visible line).

- [x] **Fixed "Ask for a shortlist" form (`pages/homestays.html`)** — was submitting via Netlify Forms (`data-netlify="true"`, action `/pages/thanks.html`) with zero phone/date validation, never reaching Supabase. Rebuilt to reuse the exact `contact-form.js` module (same field IDs as `contact.html`'s form): country-aware phone validation, flatpickr check-in/check-out, email + coming-from-city fields, opens WhatsApp with formatted message, saves to `/api/contact`. This was the actual form the user meant by "Ask for a shortlist" all along.

- [x] **`pages/places-to-visit.html` expanded to 22 places** — added the 6 originally-researched places that never got cards (Kunjapuri, Sivananda Ashram, Patna Waterfalls, Vashishta Gufa, Gita Bhawan, Swarg Ashram) plus 10 new ones from the 30-place TripAdvisor research (Bharat Mandir, Tera Manzil Temple, Bhootnath Temple, Gurdwara/Hemkund Sahib Trust, Astha Path, Sachcha Akhileshwar Mahadev Temple, Shatrughna Temple, Chilla Canal Viewpoint, Janki Pul, Rajaji National Park). 13 of 22 have real verified photos; the other 9 are text-only cards (no image fabricated) since no correctly-verified photo could be found — user said images can be supplied later if needed. Meta description updated to reflect the expanded count.

## 📋 Pending

- [x] Rebuilt the Restaurants & Cafes venue list with ten identifiable, source-documented photos: Little Buddha, Om Freedom, The 60's Cafe, Shambala, Devraj, The Arches, Ramana's Organic Cafe, Pure Soul, Bistro Nirvana, and Chotiwala. All card assets are optimized 900x600 WebP files; the two ambiguous listings were replaced with verifiable venues. Also added a versioned WebP Rajaji National Park editorial safari scene with a jeep, Asian elephants, and spotted deer. Verified with `npm test` passing 225/225.
- [x] Rebuilt `pages/things-to-do.html` with six experience-led image cards, internal links, and consistent AI-generated realistic travel photography.
- [x] Synced `things-to-do-in-rishikesh.html` first-time experience cards with their correct images: Kunjapuri sunrise, Neer Garh Waterfall, river rafting, Ganga Aarti, and yoga/quiet had been shuffled across cards. Verified with `npm test` passing 225/225.
- [x] Refreshed `pages/about-rishikesh.html` with five visual story sections, improved area descriptions, and direct homestay links.
- ⚠️ **Flagged for user decision (Claude, 2026-09-23):** the images above are AI-generated (`ai-neelkanth-mahadev.png` etc.), but the alt text and cards present them as depicting specific real, named sites (Neelkanth Mahadev Temple, Kunjapuri, Neer Garh Waterfall, Ganga Aarti). This wasn't part of the original brief — real, verified Wikimedia photos for these exact places already exist unused in the same folder (`neelkanth-mahadev-temple.jpg`, `kunjapuri-devi-temple.jpg`, `neer-garh-waterfall.jpg`, `ganga-aarti-triveni-ghat.jpg`). Flagging rather than reverting unilaterally — Codex, please don't treat this as resolved until the user weighs in.
- [ ] Places explicitly excluded as too thin/unverified to publish as fact (see research findings above): Shri Satya Sai Ghaat, Vedic Dham - Ganga, Chandreshwar Mahadev Temple, Pabekh (nobody could determine what this even is) — add only if the user has first-hand info.
- [ ] Discoverability / "show up when people search 'rishikesh homestay'" — see recommendations below. Waiting on user's Google Business Profile details (exact name, address, phone, category, GBP link) to tighten NAP consistency in the schema.

## 🔬 Research findings: 30-place TripAdvisor list

Background research pulled TripAdvisor's Rishikesh attractions list (ranks 1-23 and 31-60 rendered; 24-30 didn't load — not guessed/fabricated). Already covered: Triveni Ghat, Vashishta Gufa, Parmarth Niketan, Neer Garh Waterfall, Kunjapuri, Sivananda Ashram, Lakshman Jhula, Patna Waterfalls, Beatles Ashram, Ram Jhula, Gita Bhawan, Swarg Ashram.

**New places with solid facts, ready to add** (skipping yoga schools/shops/spas — not comparable "places to visit" content): Bharat Mandir, Tera Manzil Temple, Bhootnath Temple, Gurdwara Sri Hemkund Sahib (Rishikesh branch), Astha Path (riverside promenade), Shri Sachcha Akhileshwar Mahadev Temple, Shatrughna Temple, View Point Chilla Canal, Janki Pul (3rd suspension bridge), Rajaji National Park (Chilla Zone — safaris).

**Verified images found** (Wikimedia Commons, CC BY-SA 4.0): Tera Manzil/Trayambakeshwar Temple, Rajaji National Park, Bharat Mandir, and a probable match for the Rishikesh Gurdwara.

**No verified image found** (after real effort — not guessing a wrong one): Bhootnath Temple, Gita Bhawan, Astha Path, Vashishta Gufa, Swarg Ashram (the precinct itself). These can go live as text-only cards, or wait for the user's own photos.

**Explicitly flagged as too thin/unverified to publish as fact** — do not add without a local site visit or better source: Shri Satya Sai Ghaat, Vedic Dham - Ganga, Chandreshwar Mahadev Temple, Pabekh (nobody could determine what this actually is).

## 🔎 Discoverability recommendations (not code — needs the business owner's action)

On-site SEO (JSON-LD, canonical, sitemap, llms.txt) is done, but ranking for "rishikesh homestay" competitively also depends on off-site signals I can't create from inside the codebase:

1. **Google Business Profile** — the single highest-leverage thing missing. A verified GBP listing (address, phone, photos, category "Homestay"/"Guest house") is what actually drives the local map pack and much of what Google's AI Overviews pull from for "near me"/local queries.
2. **Structured NAP consistency** — Name/Address/Phone identical across GBP, the website (already added via `LodgingBusiness` schema), and any directory listing.
3. **Listings on travel directories** — TripAdvisor, MakeMyTrip, Booking.com/Airbnb (even a "not bookable, contact us" listing), Justdial — these are exactly the kind of sources AI answer engines (ChatGPT, Perplexity, Google AI Overviews) cite for "best homestays in Rishikesh" style queries, more than the business's own site.
4. **Backlinks from Rishikesh-focused content** — travel bloggers, yoga-school partner pages, local tourism boards linking to rishikeshhomestays.com.
5. **Real customer reviews** — on Google Business Profile and any directory listing. This is something I will not fabricate — genuine reviews are also a ranking/trust signal for both Google and AI answer engines, and fake ones violate Google's policies and would be actively harmful if discovered.

None of the above needs code changes here — happy to help draft the actual directory listing copy/descriptions if useful.
