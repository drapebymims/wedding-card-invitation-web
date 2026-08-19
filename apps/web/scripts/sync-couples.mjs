#!/usr/bin/env node
/**
 * sync-couples.mjs — build-time config sync for the static export.
 *
 * Runs as the FIRST preBuild command in amplify.yml (from apps/web, before
 * `cd ../..` / `npm ci`). It fetches the live paid/building/live orders'
 * configs from the backend's API-key-protected `/internal/couples-configs`
 * endpoint and writes each couple's config to `config/couples/<slug>.json` so
 * `generateStaticParams` picks them up at `next build` (new/changed cards
 * become live at /w/<slug>).
 *
 * Responsibilities:
 *   - B1  Validate each config before writing; SKIP invalid ones with a loud
 *         warning so one bad order can't take down the whole build.
 *   - B3  If a paid config's slug collides with a seed slug, prefer the PAID
 *         config (the real order) over the stale seed, with a loud warning.
 *   - B6  Prune stale generated config files (cancelled/expired orders) that
 *         are no longer in the paid/building/live set. NEVER deletes seeds or
 *         _template.json.
 *   - B5  After a successful bake, notify the backend via POST
 *         /internal/build-complete (per slug) so orders can reach `live`.
 *
 * Resilience (static-export rule — never hard-fail the build on a blip):
 *   - If INTERNAL_API_KEY is unset (preview/local builds) -> no-op, exit 0.
 *   - If the API is unreachable / errors / returns an unexpected shape ->
 *     log a warning and continue with whatever configs already exist.
 *   - Idempotent: only writes when a slug is new or its content changed.
 *   - build-complete is best-effort and non-fatal.
 *
 * Env contract (placeholders only — never commit real values):
 *   INTERNAL_API_KEY              API key for /internal/* (required to sync)
 *   INTERNAL_CONFIGS_URL          full URL to /internal/couples-configs
 *                                 (optional; falls back to NEXT_PUBLIC_API_BASE_URL)
 *   INTERNAL_BUILD_COMPLETE_URL   full URL to /internal/build-complete
 *                                 (optional; falls back to NEXT_PUBLIC_API_BASE_URL)
 *   NEXT_PUBLIC_API_BASE_URL      base URL used to derive the endpoints above
 */
import { readFile, writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/web/scripts -> apps/web
const WEB_ROOT = path.resolve(__dirname, "..");
const CONFIG_DIR = path.join(WEB_ROOT, "config", "couples");

// Committed seed/demo configs — never pruned by the sync. (A paid order may
// still overwrite one via B3, but the file is never deleted.)
const SEED_SLUGS = new Set(["adam-eve", "maya-arif", "sarah-daniel"]);

// Known theme ids (mirrors apps/web/src/lib/themes.ts loaders / ThemeId).
const THEME_IDS = new Set(["refined", "minimal", "vibrant"]);

// Statuses served by the internal endpoint (matches backend default).
const STATUS = "paid,building,live";

// Slug must be lowercase letters/numbers/dashes (mirrors add-couple.sh) and
// must not be a path-traversal attempt.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function log(...args) {
  console.log("[sync-couples]", ...args);
}
function warn(...args) {
  console.warn("[sync-couples]", ...args);
}

/** Retry a fetch with exponential backoff (mirrors lib/api.ts fetchRetry). */
async function fetchRetry(url, init, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      const delay = 300 * 2 ** i + Math.random() * 150;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed after retries");
}

function endpointUrl() {
  if (process.env.INTERNAL_CONFIGS_URL) return process.env.INTERNAL_CONFIGS_URL;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/internal/couples-configs?status=${encodeURIComponent(STATUS)}`;
}

function buildCompleteUrl() {
  if (process.env.INTERNAL_BUILD_COMPLETE_URL) return process.env.INTERNAL_BUILD_COMPLETE_URL;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/internal/build-complete`;
}

/**
 * B1 — Validate a config before writing. Returns a reason string when invalid,
 * or null when the config is safe to bake. Prevents one bad order from
 * crashing the whole build (getTheme throws on an unknown theme, themes
 * dereference couple/wedding at build time).
 */
function validateConfig(slug, config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return "config is not an object";
  }
  if (typeof config.theme !== "string" || !THEME_IDS.has(config.theme)) {
    return `invalid theme '${config.theme}' (expected one of: ${[...THEME_IDS].join(", ")})`;
  }
  if (!config.couple || typeof config.couple !== "object") {
    return "missing couple";
  }
  const { bride, groom } = config.couple;
  if (!bride || typeof bride !== "object") return "missing couple.bride";
  if (!groom || typeof groom !== "object") return "missing couple.groom";
  if (typeof bride.name !== "string" || !bride.name) return "missing couple.bride.name";
  if (typeof bride.fullName !== "string" || !bride.fullName) return "missing couple.bride.fullName";
  if (typeof groom.name !== "string" || !groom.name) return "missing couple.groom.name";
  if (typeof groom.fullName !== "string" || !groom.fullName) return "missing couple.groom.fullName";
  if (!config.wedding || typeof config.wedding !== "object") return "missing wedding";
  return null;
}

/**
 * B5 — Best-effort notify the backend that a slug baked successfully so the
 * order can move building -> live. Non-fatal: log failures, never exit non-zero.
 */
async function postBuildComplete(slug, apiKey) {
  const url = buildCompleteUrl();
  if (!url) {
    warn(`INTERNAL_BUILD_COMPLETE_URL / NEXT_PUBLIC_API_BASE_URL unset — cannot notify build-complete for '${slug}'.`);
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      warn(`build-complete for '${slug}' returned HTTP ${res.status} — order may stay 'building'.`);
      return;
    }
    log(`Notified build-complete for '${slug}'.`);
  } catch (e) {
    warn(`build-complete for '${slug}' failed (${e.message}) — order may stay 'building'.`);
  }
}

/**
 * B6 — Remove generated config files that are no longer in the active
 * (paid/building/live) set. Only files matching the slug pattern are eligible;
 * seeds and _template.json are NEVER deleted.
 */
async function pruneStaleConfigs(activeSlugs) {
  if (!existsSync(CONFIG_DIR)) return;
  const files = await readdir(CONFIG_DIR);
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const slug = f.slice(0, -5);
    if (slug === "_template") continue; // never delete the template
    if (SEED_SLUGS.has(slug)) continue; // never delete seed/demo configs
    if (!SLUG_RE.test(slug)) continue; // only generated slug-pattern files
    if (activeSlugs.has(slug)) continue; // still active
    await rm(path.join(CONFIG_DIR, f));
    log(`Pruned stale config config/couples/${f} (no longer paid/building/live).`);
  }
}

async function main() {
  const apiKey = process.env.INTERNAL_API_KEY;
  const url = endpointUrl();

  if (!apiKey) {
    warn("INTERNAL_API_KEY is unset — skipping config sync (no-op). Existing configs will drive the build.");
    return;
  }
  if (!url) {
    warn("Neither INTERNAL_CONFIGS_URL nor NEXT_PUBLIC_API_BASE_URL is set — skipping config sync (no-op).");
    return;
  }

  log(`Fetching configs from ${url}`);
  let body;
  try {
    body = await fetchRetry(url, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
    });
  } catch (e) {
    warn(`Failed to fetch couples-configs (${e.message}) — continuing with existing configs.`);
    return;
  }

  if (!body || body.success !== true || !body.data || !Array.isArray(body.data.couples)) {
    warn("Unexpected response shape from couples-configs — continuing with existing configs.");
    return;
  }

  const couples = body.data.couples;
  log(`Received ${couples.length} couple(s) from API.`);

  await mkdir(CONFIG_DIR, { recursive: true });

  // Active slugs = every valid slug in the current paid/building/live set.
  // Used for pruning (B6). Includes invalid-config slugs so we don't prune a
  // card that is still active but temporarily has a bad config.
  const activeSlugs = new Set();
  for (const { slug } of couples) {
    if (slug && SLUG_RE.test(slug)) activeSlugs.add(slug);
  }

  let written = 0;
  let skipped = 0;
  const bakedSlugs = []; // slugs actually written/changed this run (for B5)

  for (const { slug, config } of couples) {
    if (!slug || !config) {
      warn("Skipping couple with missing slug/config.");
      continue;
    }
    if (!SLUG_RE.test(slug)) {
      warn(`Skipping couple with invalid slug '${slug}'.`);
      continue;
    }

    // B3 — prefer a real paid order over a stale seed config.
    if (SEED_SLUGS.has(slug)) {
      warn(`Paid config for seed slug '${slug}' — preferring the real order over the stale seed config.`);
    }

    // B1 — validate before writing; skip invalid configs (never hard-fail).
    const invalidReason = validateConfig(slug, config);
    if (invalidReason) {
      warn(`SKIPPING invalid config for slug=${slug}: ${invalidReason}`);
      skipped++;
      continue;
    }

    // Ensure the config's slug matches the filename so getCouple() resolves it.
    if (config.slug !== slug) config.slug = slug;

    const file = path.join(CONFIG_DIR, `${slug}.json`);
    const content = JSON.stringify(config, null, 2) + "\n";

    let changed = true;
    if (existsSync(file)) {
      try {
        changed = (await readFile(file, "utf-8")) !== content;
      } catch {
        changed = true;
      }
    }
    if (!changed) {
      log(`Config '${slug}' unchanged — no write.`);
      skipped++;
      continue;
    }

    await writeFile(file, content, "utf-8");
    log(`Wrote config/couples/${slug}.json`);
    written++;
    bakedSlugs.push(slug);
  }

  // B6 — prune stale generated configs (never seeds / template).
  await pruneStaleConfigs(activeSlugs);

  // B5 — notify the backend that the baked slugs succeeded (best-effort).
  // Only fires when the fetch succeeded (we got here) and something was
  // actually written/changed this run.
  for (const slug of bakedSlugs) {
    await postBuildComplete(slug, apiKey);
  }

  log(`Done: ${written} written, ${skipped} skipped/unchanged.`);
}

main().catch((e) => {
  // Never hard-fail the build on a sync error (static-export rule).
  warn(`Config sync failed (${e.message}) — continuing with existing configs.`);
});
