# PLAN.md

Working plan for the task in progress. Rule (owner, 2026-10-18): plan here first, then execute, so each step costs the fewest tokens. Overwrite this file for every new task; ticket status stays in `TICKETS.md`, results in the `AGENTS.md` ledger.

## Task: RH-BUG-11 third pass (every other page type), with mobile and laptop checks

Measured 2026-10-18 (Playwright, throttled Pixel 5, local server). Guide `/things-to-do-in-rishikesh`: LCP 6.9 s, 1.56 MB (hero 447 KB, a below-the-fold photo 529 KB). Rental page: LCP 5.0 s, hero 265 KB, `libphonenumber` 179 KB. Stays list: 0.9 MB, LCP 2.3 s (the list HTML itself is 331 KB). 72 images over 150 KB weigh 23.5 MB in total; nearly every page loads one or two of them.

Biggest win for the least work: shrink those images **in place** (same file names), so no HTML, generator, sitemap or translation changes are needed.

| # | Step | Files | Risk | Check | Est. cost |
|---|------|-------|------|-------|-----------|
| 1 | **Done.** Baseline screenshots, 8 pages at phone 390 px and laptop 1440 px | scratchpad only | none | `node tests/visual/screens.js shoot` | small |
| 2 | **Done** (63 of 72 files replaced, 21.0 MB to 11.9 MB, 9 kept). Re-encode every WebP over 150 KB: max 1600 px wide (1400 for `*-mobile*`), quality 68, keep only if at least 15% smaller; PNG/JPG over 100 KB left alone (listed for the owner) | `assets/images/**` | Low: same picture, softer detail | file-size table | small |
| 3 | **Done** (under 0.07% of pixels differ, hero crops identical by eye on phone and laptop). Compare screenshots with step 1, look at the guide, rental and stays pages by eye on phone and laptop | scratchpad | none | `screens.js compare` + view 4 images | small |
| 4 | **Done**, `npm test` 1,726 of 1,726. Re-measure bytes and LCP on guide, rental, stays list (phone and laptop); run the visual tests for overflow and theme (`tests/visual/*`, part of `npm test`) | none | none | Playwright numbers, `npm test` | small |
| 5 | **Changed and done.** The vendor scripts are already at the end of `<body>`; what slowed rental and guide pages was a hero found only after the CSS arrived, so a hero `<link rel="preload">` went into the 6 master pages (guide, about, Kumbh, Kedarnath, delhi driving guide, rental hub) and the rental and driving build scripts regenerated their copies | 6 master pages, generated copies | Low | measured, `npm test` | done |
| 6 | **Done.** Close out: `TICKETS.md`, `AGENTS.md` ledger, one line in `docs/ARCHITECTURE.md` (image sizes, headers, deferred third parties) | docs | none | `npm test` | small |

Not in this plan: the 331 KB stays-list HTML (generator change, bigger), minify (new dependency), Lighthouse install (needs the owner's OK), accessibility (RH-BUG-12). Nothing is committed until asked.
