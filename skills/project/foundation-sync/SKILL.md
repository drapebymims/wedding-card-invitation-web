---
name: foundation-sync
description: Keep this project in sync with the foundation repo — check for newer skills/pain-points, pull improvements, and feed project learnings back upstream. Use when starting any task in a derived project, after hitting a new trap, or periodically as hygiene. Trigger words: "check for updates", "sync from foundation", "new trap", "feed back", "am I stale".
---

# Foundation Sync — One Source of Truth, Many Projects

`foundation/` owns the canonical knowledge: `docs/pain-points.md`, workflow skills,
templates, conventions. This project holds a synced copy plus project-local additions.
The contract: **foundation is upstream; this repo never edits synced files in place**.

## CHECK — am I stale?

```bash
bash scripts/share-skills.sh --check .
```

Reads `.foundation-sync` (stamp written at last sync) and compares against the
foundation remote's HEAD. Reports ✓ current / ✗ stale / ? never-synced. Works for
public AND private remotes (gh credentials). Run it:

- before starting any non-trivial task in this repo,
- weekly-ish during active work,
- whenever foundation announces an update.

## PULL — refresh from foundation

Run from a foundation clone (or set `FOUNDATION_DIR=/path/to/foundation`):

```bash
cd <foundation> && scripts/share-skills.sh <this-project-dir>
```

This refreshes skills + canonical docs and rewrites the stamp. Overwritten copies land
in `.foundation-sync-backup/<timestamp>/`. If this project's `docs/pain-points.md`
diverged (project-local rows), the tool writes `pain-points.foundation-latest.md`
BESIDE it instead — merge manually, APPEND-only (see below).

## PUSH BACK — feed learnings upstream

Hit a trap that cost real debugging time?

1. Fix it here first.
2. Add the row to THIS repo's `docs/pain-points.md` at the next free number — never
   overwrite existing rows (#67: overwriting once erased upstream lessons).
3. Promote it to foundation: edit `<foundation>/docs/pain-points.md` with the same row
   content (generalized — no project-specific paths), commit + push foundation.
4. Re-run PULL so the stamp and canonical table align.
5. If the fix changes a template/skill/convention, update foundation's matching file in
   the same visit — one PR-shaped change, not scattered edits.

## Rules

- Synced files (`skills/project/*`, canonical `docs/pain-points.md`) are owned by
  foundation. Local customization belongs in THIS repo's AGENTS.md or project-local
  rows — never by editing the synced copies (your edits would be silently replaced).
- Forks stay forks deliberately: if this project diverges on purpose, say so in its
  AGENTS.md and let the `-latest.md` side-file accumulate until you choose to merge.
- After any structural change to skills/docs in foundation, bump reality by running a
  full sync across siblings once — stamps make staleness visible everywhere.

## Related

`docs/pain-points.md` #67 · `commit-discipline` skill · foundation `scripts/share-skills.sh`.
