# Multi-Agent Collaboration

This repository may be worked on by Codex, Claude, or other agents.

Before making changes:

1. Read `.agents/coordination.md` for the current work ledger.
2. Read `docs/HANDOFF.md` (start here: current state, owner to-dos, hard-won rules) and `CLAUDE.md` (project rules and where things live). `PROGRESS.md` is the dated history.
3. Claim files or a clearly defined task in `.agents/coordination.md` before editing. Old claims by Codex and other agents were released by the owner on 2026-10-05: none of them holds a file, so start with a new claim.

After making changes:

1. Update the coordination file with what changed, verification performed, and any handoff notes.
2. Keep claims narrow and release them when the task is complete.
3. Never overwrite another agent's active files without recording the handoff first.

The coordination file is the shared source of truth. It is file-based synchronization: agents must reread it before starting and after completing work. It does not provide live chat or automatic locking.

## Finding booking links for stays

Claude runs this search. The lists in `docs/booking-links/` (`found.tsv`, `unfound.tsv`, `review.tsv`) change only through `scripts/stays/google_ota_search.mjs` and `scripts/stays/record_manual.mjs`, under a lock: never edit or save them by hand, and never while workers run. Any agent asked to help reads `docs/booking-links/RULES.md` first (lists, match rules, pace, no captcha workarounds) and records checks only through `record_manual.mjs`. No paid Google API (Places) calls without the owner's OK; BigQuery read/write is fine.
