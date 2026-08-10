---
name: design-style
description: Choose and apply a design language for UI work from the vendored catalog in skills/design-system/ based on the project's audience and nature. Use when starting UI work, picking a visual direction, or building any user-facing interface. Trigger words: "design", "UI", "look", "style", "theme", "make it look good".
---

# Design Style — Pick from the Catalog, Don't Invent

Every user-facing project needs a deliberate design language. We vendor 67 proven design
languages (MIT) in `skills/design-system/` — **pick one that fits the audience, then apply
it consistently.** Inventing a new look per task is how projects end up inconsistent.

## Step 1 — Identify the audience (from the project nature)

| Audience | Sensible languages (examples) |
|---|---|
| Premium storefront / fashion / luxury | `premium`, `editorial`, `minimal`, `bento`, `refined` |
| Food / cafe / casual brand | `cafe`, `terracotta`, `bold`, `vibrant`, `warm` |
| Conversion / sales / SaaS dashboard | `levels`, `enterprise`, `professional`, `roku`, `contemporary` |
| Kids / playful / learning | `lingo`, `friendly`, `doodle`, `colorful`, `claymorphism` |
| Admin / internal tool | `enterprise`, `clean`, `material`, `shadcn`, `square` |
| Tech / developer-facing | `agentic`, `mono`, `neon`, `futuristic`, `codex` |
| Editorial / storytelling site | `editorial`, `storytelling`, `paper`, `vintage` |
| Retro / arcade / gaming | `retro`, `sega`, `pacman`, `tetris`, `dithered` |

If the nature doesn't fit a category, pick 2–3 candidates and compare their `DESIGN.md`
files with the client before committing.

## Step 2 — Load the chosen language

The catalog files live at `skills/design-system/<slug>/SKILL.md` (agent instruction) and
`DESIGN.md` (human reference, tokens). Load `SKILL.md` into the working context before
building UI:

```bash
# in the project, make the chosen language available to the agent tool:
cp -R <foundation>/skills/design-system/<slug>/ .opencode/skills/design-system/
# or reference it directly from the foundation repo
```

For Claude/opencode-style tools: the folder's `SKILL.md` (with its `description`
frontmatter) becomes an auto-discoverable skill named `<slug>`.

## Step 3 — Apply it consistently

- Use the language's **tokens** (colors, typography, spacing) — map them to CSS custom
  properties or Tailwind theme so components reference tokens, not literal values.
- Keep its typography scale, spacing scale, and component feel (rounded, shadows, borders).
- Follow its accessibility rules (most are WCAG 2.2 AA, keyboard-first).
- Use the language's writing tone for user-facing copy.

## Step 4 — Keep the design honest

- Don't mix two languages in one screen.
- Don't silently deviate from the chosen language's rules — if a rule doesn't fit,
  note the deviation and its reason in the component/design notes.
- Copy in UI is usually the weak spot: after design work, have someone review user-facing
  copy for clarity and grounding without touching the visual structure.

## Anti-patterns

- "Just make it look nice" with no chosen language.
- Re-implementing a language from memory instead of loading its `SKILL.md`.
- Blending multiple catalog languages "for flavor".
- Committing UI that ignores the chosen language's tokens.
