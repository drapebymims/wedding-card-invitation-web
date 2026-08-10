# Git Workflow

The branch and commit conventions for projects built from this foundation. Proven across
the siblings; BGAM used a single `main` and moved to `dev`/`main` as collaboration grew.

## Model

```
improvement-{name}  ──►  dev  ──►  main  (live)
     (feature work)      (integration)   (deployed; merge deliberately)
```

- **`dev`** = shared integration branch. Everything merges here and deploys to the dev
  Amplify app automatically.
- **`main`** = live. Only merged from `dev`, deliberately, after user sign-off.
- **`improvement-{name}`** = feature branches, e.g. `improvement-cart`, `improvement-images`.
  Short-lived; merged to `dev` when green.

## Rules

1. **Never push directly to `dev` or `main`** — feature work goes through an
   `improvement-{name}` branch. (Pain point #9.)
2. **Never force-push** to shared branches. If history needs fixing, use a new branch.
3. **Conventional commits**, small and reviewable:
   ```
   feat: add product images to admin
   fix:  read data.data.field in product page
   chore: bump layer ARN
   docs: add deployment guide
   ```
4. **Migrations before code.** A commit that adds columns and a commit that queries them
   are ordered: migration first, code second — even if they land together.
5. **Never commit** `.env.local`, real secrets, `*.tfstate`, `.serverless/`, vendored
   layer binaries, or session transcripts (`.gitignore` covers these).
6. **CI must be green** before merging: pytest/flake8 (services), `tsc --noEmit` +
   `next build`/`vite build` (frontend), `scripts/test-flow.sh` on a deploy.
7. **Rebuild commit rule** (static export): content/data changes don't deploy until a
   build runs — pushing to `dev` triggers the Amplify build, so a merge IS the deploy.

## Promote to live (dev → main)

1. User signs off on the changes on the dev URL.
2. Merge `dev` → `main` (PR or fast-forward — deliberately, not automatically).
3. Push; Amplify builds the prod branch.
4. Add the prod URL to CORS / Cognito callback URLs if not already present.
5. Verify on the production domain. Update ROADMAP / IMPROVEMENT_PLAN.

## First commits in a new project

After `scripts/scaffold-project.sh`, the recommended commit sequence:

1. `chore: scaffold from foundation` — everything as-copied.
2. `docs: fill in project details` — README, `.env.example`, terraform.tfvars.
3. `feat: add <first-domain> service` — migration + service + deploy.
4. Then follow Phase B/C of `docs/sop.md`.
