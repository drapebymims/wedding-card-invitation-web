# Skills in this repo

Two families of skills live here:

## `skills/project/` — our workflow skills

| Skill | When to use |
|---|---|
| `bootstrap-project` | Starting ANY new project — triage nature, pick patterns + design language, scaffold, walk the SOP |
| `plan-first` | Before any multi-file / DB / infra / risky change (the hard gate) |
| `api-contract` | Writing or reviewing any Lambda handler, endpoint, or axios service |
| `design-style` | Choosing/applying a design language for UI work |
| `serverless-backend` | Writing/reviewing any Lambda service, handler, or shared layer code |
| `data-migrations` | DB schema changes, migrations, seeds, CHECK constraints, analytics views |
| `static-frontend` | Building/debugging `apps/web` — static export, Vite SPA, uploads, admin gates |
| `cognito-auth` | Auth/login/token/callback issues, user pool CLI/Terraform changes |
| `aws-deploy` | Deploying anything — serverless, Terraform, Amplify, CloudFront, CI/CD |
| `commit-discipline` | Committing/pushing, branch model, secrets hygiene, logging pain points |

The last six encode every trap from `docs/pain-points.md` (rows 1–71) as load-time
context, so agents hit the prevention instead of re-deriving the symptom.

These encode how we work. Copy them into a new project (via `scaffold-project.sh` or the
`bootstrap-project` skill) and into your agent tools' skills directory (`.opencode/skills/`,
`~/.agents/skills/`, etc.).

## `skills/design-system/` — vendored design languages (67, MIT)

Curated catalog from [bergside/awesome-design-skills](https://github.com/bergside/awesome-design-skills),
vendored verbatim. Each `<slug>/` folder contains:

- `SKILL.md` — agent instruction file (load this before UI work)
- `DESIGN.md` — human reference with machine-readable tokens

See `skills/VENDORED.md` for provenance and re-sync instructions
(`scripts/sync-design-skills.sh`). Pick per project nature — see `@skill design-style`.

## Installing skills into a project or agent

```bash
# workflow skills → the project (already done by scaffold-project.sh)
cp -R skills/project/*.md <project>/.opencode/skills/  # or your agent tools' skills dir

# a design language → make it available to the agent tool
cp -R skills/design-system/<slug> <project>/.opencode/skills/design-system/
```

Each skill is a folder with a `SKILL.md` whose `description` frontmatter drives
auto-discovery. Keep workflow skills in sync with this repo as they evolve.
