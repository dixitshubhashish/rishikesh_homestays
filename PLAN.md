# PLAN.md

Working plan for the task in progress. Rule (owner, 2026-10-18): plan here first, then execute, so each step costs the fewest tokens. Overwrite this file for every new task; ticket status stays in `TICKETS.md`, results in the `AGENTS.md` ledger.

## Task: RH-BUG-12 accessibility (from the same PageSpeed report)

Findings to fix: select without a label, colour contrast, `tabindex` above 0, "accessibility tree not well-formed" (mobile 89, desktop 92).

| # | Step | Files | Risk | Check | Est. cost |
|---|------|-------|------|-------|-----------|
| 0 | Dropped from RH-BUG-11: the 331 KB stays-list HTML is only 35 KB gzipped on the wire, so no generator change is worth it | none | none | `gzip -c` | done |
| 1 | Name the home page `#city` select with `aria-labelledby` pointing at the existing, already translated "Destination / area" label (no new string, so no 22-language translation) | `index.html` | Low | attribute present, home screenshots unchanged, `npm test` | small |
| 2 | `tabindex` above 0: searched every root page, `hotels/stay.html` and `assets/js`: none in our code, so it comes from a third-party script (ads or a library) | none | none | grep | done |
| 3 | Contrast and "tree not well-formed": the report did not show which elements; finding them without axe-core or Lighthouse needs a new dev dependency (owner's OK) or the expanded rows of the report | none until known | none | ask the owner | blocked |

Not in this plan: Lighthouse install (owner's OK). Nothing committed until step 1 passes `npm test`.
