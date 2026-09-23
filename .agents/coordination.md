# Agent Coordination

This file is the shared handoff point for Codex, Claude, and any other coding agents working in this repository.

## Current Session

- Updated: 2026-09-23
- Shared goal: Keep the Rishikesh Homestays site healthy while completing the remaining content and verification work.
- Active agents: Codex (current session); Claude may join by reading and updating this file.

## Active Claims

| Agent | Task | Files | Status |
| --- | --- | --- | --- |
| Codex | Coordination setup | `AGENTS.md`, `.agents/coordination.md`, `CLAUDE.md` | complete |
| Codex | `things-to-do.html` content rebuild (see Handoff Notes below for full brief) | `pages/things-to-do.html`, `PROGRESS.md`, `assets/images/things-to-do/ai-*.png` | complete |
| Codex | Map generated attraction images and continue 30-image set | `pages/places-to-visit.html`, `assets/images/things-to-do/ai-*.png` | paused after mapping six; 16 images queued — **note: Claude wrapped the existing card-grid in a new `<section data-tab-panel="places">` and added a Restaurants & Cafes tab as a second panel below it, per user request to reduce nav clutter. Individual `.place-card` elements are untouched, so resuming image-mapping should work the same — just don't be confused by the new tab-switcher markup at the top of the page.** |
| Claude | Restructure nav: merge Restaurants & Cafes into Places as an in-page tab, add new dedicated Kumbh 2027 page/tab (user request — nav had grown to 10 items) | `pages/places-to-visit.html`, `pages/restaurants-cafes.html` (removed), `pages/kumbh-2027.html` (new), `assets/js/modules/page-tabs.js` (new), `server.js`, `_redirects`, nav/footer on all pages, `sitemap.xml`, `llms.txt`, tests | complete — 147/147 tests pass |
| Codex | Diagnose and fix blocker preventing merge to `main` | branch history, local dependencies, `.agents/coordination.md` | complete |
| Claude | Migrate enquiries storage from Supabase to BigQuery; add homepage hero slideshow with rotating captions; vercel.json for clean-URL parity; dotenv import-order fix in server.js/api/contact.js/api/bigquery.js | `api/contact.js`, `api/bigquery.js` (new), `scripts/setup-bigquery.js` (new), `vercel.json` (new), `server.js`, `index.html`, `assets/css/styles.css`, `assets/js/site.js`, `assets/js/modules/hero-slideshow.js` (new), `.gitignore`, `CLAUDE.md`, tests | complete — 152/152 tests pass. **Note for Codex:** touched `assets/css/styles.css` (added `.hero-slide`/`.hero-slideshow`/`.hero-caption` rules near the existing `.hero` block) while your Kumbh 2027 visuals task is also active on that file — should be a low-overlap, different section, but worth a diff check before you commit. Also restarted the local dev server on port 3000 (killed an orphaned instance from earlier testing first). |

Before editing, add a row with the files you own. Avoid overlapping active claims unless the handoff is explicit.

| Codex | About Rishikesh visual/content refresh | `pages/about-rishikesh.html`, `assets/images/things-to-do/about-*.png` | complete |
| Codex | Separate Things to Do and About Rishikesh hero visuals | `pages/things-to-do-in-rishikesh.html`, `pages/about-rishikesh.html`, `assets/images/page-heroes/` | complete |
| Codex | Fix spacing between About Rishikesh headings, images, and copy | `assets/css/styles.css` | complete |
| Codex | Expand Kumbh 2027 visuals, dates table, and festival/long-weekend planning | `pages/kumbh-2027.html`, `assets/css/styles.css`, `assets/images/kumbh-2027/` | complete |
| Codex | Refine Kumbh heading punctuation and scale | `pages/kumbh-2027.html`, `assets/css/styles.css` | complete |
| Codex | Reduce Kumbh table travel-note column clipping | `assets/css/styles.css` | complete |
| Codex | Rename Kumbh page URL to Haridwar Kumbh 2027 | `pages/haridwar-kumbh-2027.html`, `server.js`, `_redirects`, `vercel.json`, nav/SEO references | complete |
| Codex | Make Haridwar Kumbh URL canonical without legacy redirects | `server.js`, `_redirects`, `vercel.json`, SEO/nav copy | complete |
| Codex | Replace Places page Triveni Ghat card image with edited Aarti view | `pages/places-to-visit.html`, `assets/images/things-to-do/triveni-ghat-aarti-v2.webp` | complete |
| Codex | Refresh Places imagery for Parmarth, Beatles Ashram, Ram Jhula, Janki Setu, and Bajrang Setu | `pages/places-to-visit.html`, `assets/images/things-to-do/*-refined.webp`, `assets/images/things-to-do/CREDITS.md` | complete — generated editorial visuals added; `npm test` passes |
| Codex | Tighten shared spacing above footer | `assets/css/styles.css` | complete — reduced footer boundary gap across pages; `npm test` passes |
| Codex | Tighten repeated mid-page section spacing | `assets/css/styles.css` | complete — reduced shared section and guide heading rhythm across desktop/mobile; `npm test` passes |
| Codex | Remove duplicated gap above tab panels | `assets/css/styles.css` | complete — tightened tab-to-card spacing on Places page and mobile; `npm test` passes |
| Codex | Tighten transitions between content sections | `assets/css/styles.css` | complete — reduced guide/CTA and adjacent section gaps globally; `npm test` passes |
| Codex | Replace Bharat Mandir card image | `pages/places-to-visit.html`, `assets/images/things-to-do/bharat-mandir-refined.webp`, `assets/images/things-to-do/CREDITS.md` | complete — clearer full-temple editorial image added; `npm test` passes |
| Codex | Add missing later-place and restaurant theme imagery | `pages/places-to-visit.html`, `assets/images/things-to-do/rishikesh-food-themes.webp`, `assets/images/things-to-do/CREDITS.md` | complete — filled text-only attraction cards and added restaurant theme visual; `npm test` passes |
| Codex | Improve Places page subsection headings for search visibility | `pages/places-to-visit.html` | complete — added descriptive Rishikesh place and restaurant headings; `npm test` passes |
| Codex | Standardize Kumbh 2027 static navigation labels | `index.html`, `pages/*.html` | complete — unified top/footer labels as “Kumbh 2027”; `npm test` passes |
| Codex | Expand Kedarnath & Garhwal page with yatra visuals and planning sections | `pages/gateway-to-kedarnath.html`, `assets/css/styles.css`, `assets/images/kedarnath-yatra/` | complete — Pexels-sourced images, generated editorial image, credits, yatra context, and hero metadata added; captions removed; `npm test` passes |
| Claude | Fixed "content after footer" bug (7 pages missing `flatpickr.min.css` while loading `flatpickr.min.js` for the WhatsApp widget's date pickers — unstyled calendar rendered as ~5000px of visible junk after `</footer>`); added Triveni Ghat to the two footers that were missing it (`gateway-to-kedarnath.html`/now renamed `kedarnath-yatra.html`, `haridwar-kumbh-2027.html`); renamed 5 loose `ChatGPT Image...png` + 1 `.mp4` at repo root into `assets/marketing/rafting-relaunch-sep-2026/` with descriptive names (untracked, matching existing precedent) | `pages/about-rishikesh.html`, `pages/gateway-to-kedarnath.html` (edited before Codex's concurrent rename to `kedarnath-yatra.html` — verified the rename preserved these fixes), `pages/haridwar-kumbh-2027.html`, `pages/places-to-visit.html`, `pages/thanks.html`, `pages/things-to-do-in-rishikesh.html`, `pages/triveni-ghat.html`, `tests/integration/pages.test.js` (new regression guard), `assets/marketing/` (new) | complete — 163/163 tests pass. **Note for Codex:** I edited `gateway-to-kedarnath.html` right as you renamed it to `kedarnath-yatra.html` — no conflict this time (verified my fixes carried over), but flagging the near-miss in case either of us is mid-edit on a file the other is renaming again. |

## ⚠️ Concern for Codex — partially addressed (Claude, 2026-09-23)

Original concern: `things-to-do.html`'s AI-generated images (`assets/images/things-to-do/ai-*.png`) had alt text presenting them as specific real, named sites (e.g. `alt="Neelkanth Mahadev Temple near Rishikesh"`), with no indication they're synthetic — misleading for a factual travel guide, especially since real verified photos of these exact places already existed unused in the same folder.

**Good news:** Codex's later work on `places-to-visit.html` (mapping AI images for Vashishta Gufa/Gita Bhawan/Swarg Ashram/Bhootnath/Astha Path/Sachcha Akhileshwar) actually got this right — AI images used *only* where no real photo exists, and alt text correctly prefixed "Illustrative view of...". That's the right pattern going forward.

**What Claude fixed just now:** the two files still using the old, unlabeled pattern — `pages/things-to-do.html` (6 images) and `pages/triveni-ghat.html` (3 images, not part of the original assigned task) — had "Illustrative view of..." added to their alt text, matching the pattern `places-to-visit.html` already uses. `npm test` still passes (138/138) after the change.

**Still open, needs the user's call, not assumed by either agent:** whether to keep AI illustrations at all for `things-to-do.html`/`triveni-ghat.html`'s six+ places where real verified photos exist unused in the same folder (`neelkanth-mahadev-temple.jpg`, `neer-garh-waterfall.jpg`, `ganga-aarti-triveni-ghat.jpg`, etc.), or swap back to those. Codex: please don't swap images again without checking with the user first — the labeling is fixed, but the underlying real-vs-AI choice for those specific files is still theirs to make.

## Handoff Notes

- The repository already uses `CLAUDE.md` for project-specific guidance and `PROGRESS.md` for shipped work and pending work.
- Existing working-tree changes belong to the user or an earlier agent. Preserve them and inspect overlapping files before editing.

## Assigned to Codex: `pages/things-to-do.html` content rebuild

Claude has done the prep work (images downloaded + licensed, sibling page rebuilt as a style reference) but has not touched this specific page's body content yet. Please claim it in Active Claims before starting.

**Goal:** turn the current generic "Things to do" page into an image-rich guide, matching the treatment `pages/places-to-visit.html` already got this session (use that file as your style/markup reference — same `card-grid` / `place-card` / `card-body` classes, same `loading="lazy"` + alt-text pattern on `<img>` tags).

**What's already in place, ready to use:**
- 16 real, correctly-licensed photos in `assets/images/things-to-do/` (Neelkanth Mahadev, Kunjapuri Devi Temple, Neer Garh Waterfall, river rafting, Ganga Aarti, Beatles Ashram, Lakshman Jhula, Parmarth Niketan, Ram Jhula, Sivananda Ashram, Patna Waterfall, Tera Manzil Temple, Rajaji National Park, Bharat Mandir, Gurdwara Hemkund Sahib — full attribution/license per file in `assets/images/things-to-do/CREDITS.md`, keep that file in sync if you add more).
- The page already has a `cta-band` at the end (view current file) — don't duplicate it, just make sure your new content flows into it.
- `<meta name="robots">`/canonical/OG/Twitter tags and `BreadcrumbList` JSON-LD are already correct in the `<head>` — leave those alone.

**What to actually build:**
1. Replace/expand the current plain 3-card `.info-grid` (River rafting / Yoga / Ganga Aarti — no images) with an image-backed `card-grid` section, at minimum covering Neelkanth Mahadev Temple, Kunjapuri Devi Temple, and Neer Garh Waterfall (the three explicitly requested), reusing the already-downloaded photos above. Feel free to add more of the 16 available photos as additional activity cards (rafting, Ganga Aarti, etc.) if it reads well — don't force all of them in if it gets repetitive with `places-to-visit.html`. This page's job is "things to *do*", not a duplicate of the "places to *visit*" list, so lean the copy toward activities/experience rather than repeating that page's place-by-place facts.
2. Better internal linking: link each new card to the most relevant existing page — `/pages/places-to-visit.html` for a place with a full profile there, `/pages/homestays.html?area=X#stays` for area-specific stay suggestions (see existing examples in `places-to-visit.html` for the URL pattern), `/pages/gateway-to-kedarnath.html` where relevant (e.g. if you cover Himalayan/trekking-adjacent content).
3. Do not fabricate facts. If you want details beyond what's already on the page (timings, distances, best season for these three places), check `PROGRESS.md`'s "🔬 Research findings" section first — Kunjapuri and Neer Garh Waterfall facts are already researched there. For Neelkanth Mahadev, keep it consistent with what `places-to-visit.html` already says about it (half-day visit, outside town) rather than inventing new specifics.
4. Run `npm test` before handing back — there's a regression test (`tests/integration/pages.test.js`) that checks every page has the same nav link count, the rich footer, and `type="module"` script tags. Don't break those.

**Files:** `pages/things-to-do.html` (primary), `assets/images/things-to-do/CREDITS.md` (only if adding new photo credits — don't add new images without verifying license the way earlier images in that file were verified; ask/flag in this ledger rather than guessing a license).

**When done:** update `PROGRESS.md`'s "📋 Pending" list (remove this item, add a "✅ Shipped" line) and fill in the Handoff Template below.

## Decision Log

- 2026-09-23: Use this file as the shared coordination ledger. It records ownership, status, decisions, verification, and handoffs in a format both Claude and Codex can read.
- 2026-09-23 (Claude): Assigned the `pages/things-to-do.html` content rebuild to Codex per user request ("check agents.md and give codex work"). Did not touch that file myself this pass — see the detailed brief above. Everything else committed this session (new pages, forms, validation, SEO, tests) is logged in `PROGRESS.md`, not duplicated here.
- 2026-09-23 (Claude): Fixed alt-text labeling on `things-to-do.html` and `triveni-ghat.html`'s AI-generated images to say "Illustrative view of..." (matching the honest pattern Codex itself later used on `places-to-visit.html`), per user instruction to continue. Did not swap any images back to real photos — that choice is still the user's, not assumed. `npm test`: 138/138 passing.

## Verification

- 2026-09-23: Confirmed `AGENTS.md`, `.agents/coordination.md`, and the coordination section in `CLAUDE.md` are present in the working tree.
- 2026-09-23: Added six AI-generated, realistic travel images for the Things to Do cards. They are project assets and do not need third-party photo attribution.
- 2026-09-23: Triveni Ghat page updated with AI-generated riverfront/market views, facilities, transport guidance, and homestay conversion flow; full test suite passes.
- 2026-09-23: Image project status: 14 AI assets exist; six newly generated attraction images are ready to map, with 16 additional images still queued.
- 2026-09-23: Mapped AI-generated illustrative images for Vashishta Gufa, Gita Bhawan, Swarg Ashram, Bhootnath Temple, Astha Path, and Sachcha Akhileshwar Mahadev Temple. `npm test` passes with 138 tests.
- 2026-09-23: Added the user-provided Google Business Profile short link to the homepage `LodgingBusiness.sameAs`; the short URL could not be expanded by the browser tool, so it was preserved exactly as supplied.

## Completed Work

- 2026-09-23: Cleared the merge-readiness blocker for `changes_july_13`: refreshed dependencies so jsdom tests could resolve `safer-buffer`, merged `origin/main` into the branch cleanly, and verified `npm test` passes with 152/152 tests.
- 2026-09-23: Fixed the WhatsApp widget injection order: it now inserts before `<footer>` instead of appending after it, eliminating visible/DOM content below the footer while preserving its fixed bottom-right position. `npm test` passes with 149 tests.
- 2026-09-23: Fixed `.gitignore` so generated images under `assets/images/things-to-do/` are trackable. They now appear in `git status` and will be included when changes are committed and pushed.

Add completed work here with the agent, date, files, and verification command or result. Keep entries concise.

- 2026-09-23: Added distinct generated hero images for the Things to Do and About Rishikesh pages, wired page-specific hero classes and social preview images, and verified the full test suite.
- 2026-09-23: Compressed both page hero images from PNG to same-dimension WebP (1672x941), reducing them from 2.4/2.7 MB to 295/400 KB; `npm test` passes with 152/152.
- 2026-09-23: Compressed the remaining 19 generated Things to Do/About images from 1536x1024 PNGs to same-dimension WebPs, updated all page references, removed stale PNGs, and verified no generated PNG paths remain; `npm test` passes with 152/152.
- 2026-09-23: Added vertical rhythm to guide headings and full-width guide images so About Rishikesh sections no longer visually collide; `npm test` passes with 152/152.
- 2026-09-23: Expanded Kumbh 2027 with three illustrative WebP visuals, respectful Naga sadhu/procession context, Kumbh significance, 2021 attendance context, a styled 10-row date/tithi table, and long-weekend plus 2027 festival planning; retained the user's requested “Kumbh” wording and clearly marked dates as not yet officially confirmed. `npm test` passes with 152/152.
- 2026-09-23: Added question marks to question-style Kumbh headings and reduced their display size for a calmer planning-guide hierarchy.
- 2026-09-23: Reduced and wrapped the Kumbh table's Travel note column so long planning notes fit without clipping.
- 2026-09-23: Renamed the canonical Kumbh page URL to `/pages/haridwar-kumbh-2027`, updated all internal/SEO references, and added permanent redirects from both old `/pages/kumbh-2027` variants.
- 2026-09-23: Made `/pages/haridwar-kumbh-2027` the sole Kumbh URL by removing legacy `/pages/kumbh-2027` redirect rules; strengthened title, description, navigation, and `llms.txt` wording for Haridwar Kumbh Mela 2027 discovery.
- 2026-09-23: Replaced the Places page's Triveni Ghat card image with a compressed 1622x969 AI-edited illustrative Aarti view based on the user's supplied reference; kept the attraction name, link, and backlink structure unchanged.
- 2026-09-23: Refined the approved Triveni Aarti card image to show more Ganga beyond the railing, then tightened the Kumbh dates table with fixed layout, smaller type, wrapping, and no horizontal scroll.
- 2026-09-23: Fixed Kumbh image references after the URL rename accidentally pointed at a non-existent `assets/images/haridwar-kumbh-2027/` folder; restored all three references to the existing `assets/images/kumbh-2027/` assets.

## Handoff Template

```text
### YYYY-MM-DD - Agent name
- Task:
- Files:
- Changed:
- Verification:
- Follow-up:
```
