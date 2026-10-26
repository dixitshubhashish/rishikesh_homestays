# PLAN.md

Working plan for the task in progress. Rule (owner, 2026-10-18): plan here first, then execute, so each step costs the fewest tokens. Overwrite this file for every new task; ticket status stays in `TICKETS.md`, results in the `AGENTS.md` ledger.

## Task: RH-FEAT-9 more content pages (owner, 2026-10-24: "start on this")

Goal: the AIIMS long-stay page and more landmark pages, using only verified facts (coordinates from OSM with a source, no guessed distances).

| # | Step | Files | Risk | Check | Est. cost |
|---|------|-------|------|-------|-----------|
| 1 | AIIMS long-stay page = one search-phrase row `Long stay near AIIMS Rishikesh`, rule `kitchen & near:aiims-rishikesh:3` (49 stays, 48 linked, counted from the built data on 2026-10-24; MIN_PAGE is 5, so it is real, not thin) | `scripts/stays/search-pages.tsv` | Low | rebuild Rishikesh, `check:stays`, page has its own facts/FAQ from `page_content()` | small |
| 2 | Landmark candidates: two research agents verify OSM coordinates + one fact each (Rishikesh, Haridwar/Dehradun/Mussoorie); anything doubtful is dropped | none (read-only) | none | each coordinate has a source URL | agents |
| 3 | Add only landmarks with 5+ stays in range to `landmarks.tsv` (source column filled, `max_km` where road distance differs) | `scripts/stays/landmarks.tsv` | Low | count stays in range before adding | small |
| 4 | Rebuild (`--city` per step, one city at a time: the Mac is short of memory), `npm run check:stays`, footer sync, i18n extract/status/sync (new strings only), search index | generated pages | Medium | `npm test`, visual tests when the Mac is idle | medium |

Not in scope: hand-edits of generated pages; an AdSense risk to watch: new templated pages must pass the MIN_PAGE gate (RH-BUG-13).
