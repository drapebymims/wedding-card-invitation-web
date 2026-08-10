# Foundation — Project Starter & Reference

The canonical starting point for every new project built from here on. It packages the
architecture, skills, context files, templates, and workflows that have been proven across
our live projects into one repo you can copy, adapt, and deploy from.

**Provenance:** synthesized from four production repos that share one template lineage —
`drape-by-mims` (Next.js storefront + Serverless + RDS + Sanity), `Bees` (React Native
learning app, 10 microservices, GitHub Actions), `BGAM` (Vue/Vite F&B ordering app), and
`sinar-automotif` (Next.js static-export showroom; the most evolved revision of the
template). See [docs/reference-map.md](docs/reference-map.md) for what each contributes.

## The pattern in one diagram

```
Client (Next.js static export | Vite SPA | React Native/Expo)
        │
        ▼
Amplify / CloudFront (frontend hosting)
        │
        ▼
API Gateway (REST, /dev and /prod stages)
        │
┌───────┴──────────┐
│ Lambda functions │  ← Serverless Framework, Python 3.12
│ (public / auth / │
│  admin handlers) │
└───────┬──────────┘
        │ shared Lambda layer (wedding-card-invitation-web_common)
        ▼
RDS Postgres  ←  S3 buckets  ←  SES / external APIs
(Secrets Mgr)    (+ CloudFront OAC for assets)
```

Monorepo skeleton (every new project mirrors this):

```
<project>/
├── apps/                    # frontend(s): apps/web (Next.js static export or Vite)
├── services/<name>-service/ # one Serverless service per domain (Python 3.12)
├── layers/shared-layers/wedding-card-invitation-web-common-layer/   # shared Lambda layer
├── infra/terraform/         # RDS, Cognito, S3, IAM (+ numbered SQL migrations)
├── scripts/                 # seed, test-flow, wait-amplify, scaffold
├── docs/                    # architecture.md, sop.md, plans, ROADMAP
├── amplify.yml              # frontend build spec (appRoot: apps/web)
└── package.json             # npm workspaces + root scripts
```

## Start a new project (3 steps)

1. **Scaffold the repo:**
   ```bash
   ./scripts/scaffold-project.sh my-new-project
   ```
   This copies this repo to `../my-new-project`, renames `wedding-card-invitation-web`/`wedding_card_invitation_web_common` placeholders,
   and prints the next steps.

2. **Follow the project bootstrap skill** (load `@skill bootstrap-project` in your agent):
   - triage the **project nature** (storefront / dashboard / mobile app / CMS-backed / …)
   - pick the matching frontend pattern and design language (see `skills/design-system/`)
   - follow the architecture and SOP

3. **Walk the SOP:** [docs/sop.md](docs/sop.md) takes you from an empty AWS account to a
   deployed project (Phase A foundation → Phase B backend → Phase C frontend), with the
   [known pain points](docs/pain-points.md) table read before you start.

## What's in this repo

| Path | What it is |
|---|---|
| `docs/architecture.md` | The canonical architecture blueprint (enhanced across all 4 projects) |
| `docs/sop.md` | Standard operating procedure: empty account → deployed project |
| `docs/conventions.md` | Naming, code style, API contract, env var conventions |
| `docs/pain-points.md` | Battle-tested failure → prevention table (read before deploying) |
| `docs/git-workflow.md` | Branching, commits, promotion to live |
| `docs/reference-map.md` | What each sibling project demonstrates (for consultation) |
| `skills/project/` | Our workflow skills: `bootstrap-project`, `plan-first`, `api-contract`, `design-style` |
| `skills/design-system/` | Vendored design-language skills (67, MIT) — pick per project nature |
| `templates/backend/` | Genericized layer, service, terraform templates + canonical `amplify.yml` |
| `templates/frontend/` | Frontend quickstart patterns (Next.js static export, Vite, React Native) |
| `scripts/` | `scaffold-project.sh`, `sync-design-skills.sh`, `test-flow.sh`, `seed.py`, `wait-amplify.sh` |
| `AGENTS.md` | Agent context/playbook for working in this repo and in derived projects |
| `.env.example` | Canonical env block (all values are placeholders) |

## Choosing by project nature

The architecture is deliberately one template, with switches:

| Project nature | Frontend | Backend shape |
|---|---|---|
| Marketing / catalog / storefront | Next.js **static export** (`output: 'export'`) | public + admin handlers |
| Web app / dashboard | Vite SPA (or Next.js with client-side filters) | public + auth + admin |
| Mobile app | React Native / Expo | microservice per domain (Bees pattern) |
| CMS-backed | static export + CMS seed/backfill scripts | CMS data → Postgres → public API |

Pick a **design language** for the UI from `skills/design-system/` based on the audience
(e.g. `bento`/`minimal` for a premium storefront, `enterprise`/`levels` for a conversion
dashboard, `lingo` for a kids app). The `design-style` project skill walks through this
choice.

## Working in a derived project

Every derived project gets its own `AGENTS.md` (this repo's is the generic version), the
plan-first gate, and the API contract. Keep the reference docs here in sync with what you
learn — when a new pain point or pattern surfaces in a live project, codify it back into
this repo (see [docs/reference-map.md](docs/reference-map.md)).

## License

Our own content: proprietary (this is our internal starter). The vendored design skills in
`skills/design-system/` are **MIT (Copyright (c) 2026 Bergside)** — see
[skills/design-system/LICENSE](skills/design-system/LICENSE) and
[skills/VENDORED.md](skills/VENDORED.md).
