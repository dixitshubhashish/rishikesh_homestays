# Multi-Agent Collaboration

This repository may be worked on by Codex, Claude, or other agents.

Before making changes:

1. Read `.agents/coordination.md` for the current work ledger.
2. Read `CLAUDE.md` and `PROGRESS.md` for project conventions and history.
3. Claim files or a clearly defined task in `.agents/coordination.md` before editing.

After making changes:

1. Update the coordination file with what changed, verification performed, and any handoff notes.
2. Keep claims narrow and release them when the task is complete.
3. Never overwrite another agent's active files without recording the handoff first.

The coordination file is the shared source of truth. It is file-based synchronization: agents must reread it before starting and after completing work. It does not provide live chat or automatic locking.

## Helper agents finding booking links (Antigravity etc.)

Read `docs/antigravity/RULES.md` before working on `docs/antigravity/no-link-stays.tsv`: exact output format, when a page counts as a match, pacing (no captcha workarounds), and what never to edit. Results go only to `docs/antigravity/results-<batch>.tsv`; Claude merges them.
