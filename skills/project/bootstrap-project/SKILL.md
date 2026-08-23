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
   content site / API-only / internal tool / ecommerce / **multi-tenant product**
   (one codebase, many clients) / **frontend-only** (portfolio, marketing, no backend)
2. **Who is the audience?** public, customers, staff/admin, kids, developers — this drives
   the design language choice.
3. **What content changes and how often?** If a non-technical admin edits content daily,
   static export + rebuild is painful — plan for a CMS or client-side fetching instead.
4. **Do we need accounts/payments/admin?** auth (Cognito), payments (Stripe/ToyyibPay/
   CHIP), admin role-gated routes.
5. **What's the data shape?** roughly how many tables/domains → how many services
   (1 service is fine for small projects; split microservices only past ~2–3 domains).
6. **Does it need a backend at all?** A portfolio or brochure site is **frontend-only**:
   skip the scaffold's AWS baggage (`services/`, `layers/`, `infra/`, `docs/sop.md`,
   `.env.example` Cognito/S3 vars) — see zahid-syuqri. A lead-gen site can run a
   **trimmed DB-less service** (SES-only, no RDS/Cognito) — see iqbar-proton.

## Step 2 — Pick the patterns (from the nature)

| Nature | Frontend | Service shape |
|---|---|---|
| Catalog/storefront | Next.js static export | public + admin handlers |
| Web dashboard | Vite SPA (or Next + client filters) | public + auth + admin |
| Mobile app | React Native / Expo | microservice per domain |
| CMS-backed | static export + seed/backfill scripts | CMS → Postgres → public API |
| API-only / internal | none (or minimal Vite) | public/auth only |
| Multi-tenant product | static export + `config/<tenant>.json` (WED) | one service, tenant as a column |
| Frontend-only (portfolio/marketing) | Next.js static export only | **no backend** — drop `services/`, `layers/`, `infra/` (zahid-syuqri) |
| Lead-gen / brochure | static export + WhatsApp-first CTAs | **trimmed DB-less service** (SES-only, iqbar-proton) |

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

This copies this repo to a new directory, renames placeholders (`REPO`/`repo_common`),
prunes ghost dirs, validates no placeholder or invalid-hyphen module names remain
(`travel-pelangi_common`-style names fail the build), and prints next steps. Then:

1. `git init && git add -A && git commit -m "chore: scaffold from foundation"` in the new dir.
2. **Verify the scaffold actually imports** before anything else: the shared-layer
   package must be `${SLUG}_common` (underscores) everywhere — docs that spell it with
   dashes produce unimportable modules agents then chase (#68).
3. **Customize the identity** (scaffold copies the template verbatim — a repo that still
   reads "Foundation — Project Starter" invites mis-scaffolding):
   - Rewrite the root `README.md` for the actual project.
   - Set the real name in `package.json` (it defaults to `"foundation"`).
   - Trim what the nature doesn't need (frontend-only → delete `services/`, `layers/`,
     `infra/`, backend env vars; lead-gen → skip DB/Cognito).
4. Fill in project identity: `terraform.tfvars.<stage>` (never committed), root
   `package.json` name, `amplify.yml` appRoot.
5. Copy the design language choice: `cp -R <foundation>/skills/design-system/<slug> <project>/.opencode/skills/design-system/` (or per your agent tool's skills dir).

### Cost/architecture reality checks (planning-stage estimates were wrong once)

Aurora ran ~2× over estimate ($45–55/mo real); Aurora needs PostgreSQL 16.3+ for
pgvector AND auto-pause together, and RDS Proxy breaks auto-pause entirely; Cognito free
tier is 10K MAU (not 50K); SES in ap-southeast-5 is API-only (no SMTP); VPC endpoints
~$15/mo each are unavoidable in private subnets; LLM-calling services must sit OUTSIDE
the VPC (#71). Price the footprint before promising timelines.

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
- **No secrets.** All `.env.example` values are placeholders. Never commit credentials or
  `terraform.tfvars` (pain point #33).
- **Smallest correct footprint.** One service until there are 2–3 domains. Static export
  until you need interactivity. No CI until there are tests worth running. **No backend
  until there's data to store** — frontend-only and DB-less service variants exist.
- **Migrations before code. Layer layout sacred. `terraform plan` shows 0 destroys.**
- **Customize the scaffold.** A derived repo must not read like the template: rewrite the
  root README and `package.json` name in the first commit (Step 4).
- **After scaffold, delete the AWS baggage the project doesn't need** (frontend-only →
  `services/`, `layers/`, `infra/`, backend env vars; see Step 1 triage).
