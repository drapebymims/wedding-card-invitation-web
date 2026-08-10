---
name: plan-first
description: Hard planning gate before any multi-file or risky change in a foundation-derived project. Use before editing when a change touches 2+ files, the DB, infra, deploy config, or has unclear requirements. Trigger words: "plan this", "hard gate", "before we start", any multi-file change request.
---

# Plan First (Hard Gate)

This project enforces a planning gate for any non-trivial change. Skipping it is how
rework, broken deploys, and contract drift happen.

**Trigger:** any change that touches **2+ files**, the **database**, **infra/terraform**,
**deploy config**, or anything with **unclear requirements** → the gate applies. Small
one-file edits do not need the full ceremony.

## The gate (5 steps)

1. **Audit the current state.** Read the relevant files, the architecture
   (`docs/architecture.md`), conventions (`docs/conventions.md`), and pain points
   (`docs/pain-points.md`). Check the background job board — don't duplicate running work.

2. **Draft a plan.** Short and concrete:
   - **Goal** — what the change does, in one sentence.
   - **Scope** — files to touch, DB migrations, env vars, deploy impact.
   - **Contract impact** — does the API envelope or an endpoint's shape change? Update
     frontend consumers in the same change.
   - **Ordering** — migrations before code; layer before services; backend before frontend.
   - **Verification** — the specific checks that prove it works (tests, build, test-flow).

3. **Ask questions.** Surface the decisions you can't make safely yourself:
   - Ambiguous requirements → ask.
   - Contract choices with user-visible impact → ask.
   - Anything that diverges from the template → propose the divergence + reason, ask.

4. **Get approval.** Do not execute until the plan is accepted. For big changes, write the
   plan into `docs/` (an IMPROVEMENT_PLAN.md section or a dated plan file).

5. **Execute + verify.** Follow the plan exactly. Run the verification from the plan. If
   reality diverges from the plan, stop and re-confirm rather than improvising.

## What a good plan looks like

```markdown
## Plan: add product images to admin
- Goal: admins can upload/set-primary/delete product images.
- Scope:
  - infra/terraform/migrations/NNN_product_images.sql (new table)
  - services/<name>-service/... (S3 presign + CRUD + admin gate)
  - apps/web/... (admin UI section, axios service)
- Contract: new endpoints /admin/images (POST/PATCH/DELETE), envelope unchanged.
- Order: migration → layer (no change) → service → frontend.
- Verification: migrate + `serverless deploy --stage dev`, curl flow,
  `tsc --noEmit && next build`, test-flow green.
- Risk: presigned PUT to private bucket — follow storage pattern in architecture.md.
```

## Anti-patterns

- Jumping into edits because the change "seems simple" (it's multi-file → gate applies).
- Planning without reading the current state.
- Changing the API contract without updating the frontend in the same change.
- Executing before approval because the plan "seems obviously right".
