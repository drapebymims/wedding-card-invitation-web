# Vendored: bergside/awesome-design-skills

- **Source URL:** https://github.com/bergside/awesome-design-skills
- **Vendored commit:** f631a09b4fcc0166f2e2c1a8c81906ef680c57e8
- **Vendored date:** 2026-06-28
- **License:** MIT (Copyright (c) 2026 Bergside) — the LICENSE file is included at `skills/design-system/LICENSE`
- **Count:** 67 skills
- **Purpose:** curated design-system skill files (SKILL.md + DESIGN.md per skill) for agentic coding tools

## Contents

`skills/design-system/` holds 67 skill folders (each containing `SKILL.md` and
`DESIGN.md`), plus `index.json` and `LICENSE`. Files are preserved verbatim from
upstream — do not edit `SKILL.md` or `DESIGN.md` contents (keep the
`TYPEUI_SH_MANAGED_START`/`END` markers, frontmatter, and license fields intact).

## Re-sync instructions

To update this vendored copy to the latest upstream:

1. Run `scripts/sync-design-skills.sh` — it clones upstream, replaces
   `skills/design-system/`, and updates this file's SHA/date.
   (Manual equivalent: `git clone --depth 1 https://github.com/bergside/awesome-design-skills <tmp>`,
   replace `skills/design-system/` with `<tmp>/skills/*` folders plus
   `<tmp>/skills/index.json` and `<tmp>/LICENSE`, then update the commit SHA and
   vendored date above.)
2. Verify the folder count is still 67 and every folder still contains both
   `SKILL.md` and `DESIGN.md`.
3. Do not copy `registry-examples/` or anything else.
