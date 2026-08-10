---
name: bootstrap-project
description: Stand up a brand-new project from the foundation repo. Use when starting any new project — triage the project nature, pick the matching patterns and design language, scaffold the repo, and walk the SOP. Trigger words: "start a new project", "bootstrap", "new repo", "foundation".
---

# Bootstrap a New Project from Foundation

Every new project starts here. The goal: get from "idea" to a deployed, convention-aligned
repo with the smallest correct footprint — no gold-plating, no invented patterns.

## Step 1 — Triage the project nature

Before anything else, answer these questions (write the answers down):

1. **What is it?** storefront / marketing site / web dashboard / mobile app / CMS-backed
   content site / API-only / internal tool / ecommerce
2. **Who is the audience?** public, customers, staff/admin, kids, developers — this drives
   the design language choice.
3. **What content changes and how often?** If a non-technical admin edits content daily,
   static export + rebuild is painful — plan for a CMS or client-side fetching instead.
4. **Do we need accounts/payments/admin?** auth (Cognito), payments (Stripe/ToyyibPay),
   admin role-gated routes.
5. **What's the data shape?** roughly how many tables/domains → how many services
   (1 service is fine for small projects; split microservices only past ~2–3 domains).

## Step 2 — Pick the patterns (from the nature)

| Nature | Frontend | Service shape |
|---|---|---|
| Catalog/storefront | Next.js static export | public + admin handlers |
| Web dashboard | Vite SPA (or Next + client filters) | public + auth + admin |
| Mobile app | React Native / Expo | microservice per domain |
| CMS-backed | static export + seed/backfill scripts | CMS → Postgres → public API |
| API-only / internal | none (or minimal Vite) | public/auth only |

Read `docs/architecture.md` for the full blueprint. Do NOT redesign the stack — the
template is deliberately one shape with switches.

## Step 3 — Pick the design language

Load `@skill design-style` — it walks you through choosing from the vendored catalog in
`skills/design-system/` (67 MIT design languages) based on the audience. Never invent a
new look per task.

## Step 4 — Scaffold the repo

```bash
./scripts/scaffold-project.sh <project-name>
```

This copies this repo to a new directory, renames placeholders (`wedding-card-invitation-web`/`wedding_card_invitation_web_common`),
and prints next steps. Then:

1. `git init && git add -A && git commit -m "chore: scaffold from foundation"` in the new dir.
2. Fill in project identity: README, `.env.example`, `terraform.tfvars.<stage>`, root
   `package.json` name, `amplify.yml` appRoot.
3. Copy the design language choice: `cp -R <foundation>/skills/design-system/<slug> <project>/.opencode/skills/design-system/` (or per your agent tool's skills dir).

## Step 5 — Walk the SOP

Open `docs/sop.md` in the new project and follow Phase A → B → C:

- **A (one-time)**: AWS account + IAM → region/DB conventions → Terraform (0-destroy plan)
  → shared layer → GitHub + Amplify
- **B (per service)**: migrations before code → service skeleton → deploy + verify
- **C (per release)**: frontend app → deploy → verification suite → promote

## Step 6 — Handoff to the team/agent

Update the project's `AGENTS.md` with the concrete stack, service list, DB names, and
deploy commands (copy the generic AGENTS.md and fill in specifics). Add the first
`docs/ROADMAP.md` with the nature's phasing.

## Guardrails

- **No invented architecture.** If a need doesn't fit the template, write it down as a
  deliberate divergence with a reason — then decide whether to feed it back into
  `foundation/` (update `templates/`, `docs/architecture.md`, `docs/pain-points.md`).
- **No secrets.** All `.env.example` values are placeholders. Never commit credentials.
- **Smallest correct footprint.** One service until there are 2–3 domains. Static export
  until you need interactivity. No CI until there are tests worth running.
- **Migrations before code. Layer layout sacred. `terraform plan` shows 0 destroys.**
