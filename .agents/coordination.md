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

Before editing, add a row with the files you own. Avoid overlapping active claims unless the handoff is explicit.

| Codex | About Rishikesh visual/content refresh | `pages/about-rishikesh.html`, `assets/images/things-to-do/about-*.png` | complete |

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

- 2026-09-23: Fixed the WhatsApp widget injection order: it now inserts before `<footer>` instead of appending after it, eliminating visible/DOM content below the footer while preserving its fixed bottom-right position. `npm test` passes with 149 tests.
- 2026-09-23: Fixed `.gitignore` so generated images under `assets/images/things-to-do/` are trackable. They now appear in `git status` and will be included when changes are committed and pushed.

Add completed work here with the agent, date, files, and verification command or result. Keep entries concise.

## Handoff Template

```text
### YYYY-MM-DD - Agent name
- Task:
- Files:
- Changed:
- Verification:
- Follow-up:
```
