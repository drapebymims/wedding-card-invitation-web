---
name: commit-discipline
description: Branch model, conventional commits, secrets hygiene, and the knowledge loop for foundation-derived projects. Use when committing, pushing, choosing a branch, handling secrets/env files, or logging a new pain point. Trigger words: "commit", "push", "branch", "merge to main", "secret", ".env", "gitignore", "log this pain point".
---

# Commit Discipline — Branches, Secrets, Knowledge Loop

## Branch model

- `improvement-{name}` → `dev` (integration, auto-deploys) → `main` (live). Promotion to
  `main` is deliberate, after sign-off. NEVER push directly to `dev`/`main`; NEVER
  force-push shared branches (#9).
- Solo projects may run main-only — document the choice in the README so future
  contributors aren't surprised.
- Merge gates: pytest/flake8 green, `tsc --noEmit` + `next build`/`vite build` clean,
  `scripts/test-flow.sh` green on deploys.

## Commits

- Conventional commits, small and reviewable: `feat:` `fix:` `chore:` `docs:`
  `refactor:`.
- Static-export rebuild rule: pushing content/data changes to `dev` triggers the
  Amplify build — a merge IS a deploy. Say so in the commit body when it re-bakes pages.
- Migration commits are ordered BEFORE the code that queries the new columns, even when
  they land together.

## Secrets hygiene (check on EVERY commit)

- Credentials ONLY via Secrets Manager at runtime — grep staged diffs for passwords,
  ARNs, account IDs, live URLs before pushing (#13).
- `.env.example` holds placeholders only; `.env.local` / real `.env` never committed;
  no real values as code fallbacks (#16).
- Gitignore final forms: `*.tfvars` + `!terraform.tfvars.example` (#33, #62); vendored
  layer wheels ignored WITH the negation `!layers/**/python/python/*_common/` so the
  layer's own source stays tracked (#19, #57); session transcripts / scratch files
  (`out.txt`-style) ignored (#24).
- Web/Firebase SDK keys are public — security lives in server-side rules. That means
  money and state mutations are NEVER trusted from client-computed values; the server
  re-verifies amounts before marking anything paid (#66).
- Never treat a downloaded `-main` unzip as a working repo without `git init` first.

## The knowledge loop (rule 9)

Hit a new trap:

1. Fix it in the project.
2. APPEND a row to `docs/pain-points.md` at the NEXT FREE number — derived repos never
   overwrite existing rows (one sibling rewrote rows 41–42 in place and erased two
   upstream lessons, #67).
3. If the fix changes a template or convention, feed it back to `foundation/`.
4. After big updates, re-sync sibling copies (`cp docs/pain-points.md <sibling>/docs/`,
   preserving their appended rows).

## Pre-commit checklist

- [ ] `tsc --noEmit` + build clean; pytest green
- [ ] No secrets in diff (targeted grep: password/ARN/account-id/secret/token)
- [ ] Correct branch (not dev/main directly)
- [ ] Migration commit ordered before dependent code commit
- [ ] Scratch/transcript files excluded
- [ ] New trap encountered? Row appended to docs/pain-points.md

## Anti-patterns

- "Small change" straight onto `dev`.
- Force-push to undo a mistake.
- Real API URLs kept as source fallbacks "temporarily".
- Rewriting pain-point rows in place instead of appending.
- Committing client-computed totals as authoritative order values.

## Related

`docs/git-workflow.md`, `docs/pain-points.md` rows 9, 13, 16, 19, 24, 33, 57, 62,
66–67 · pairs with `aws-deploy`, `plan-first`.
