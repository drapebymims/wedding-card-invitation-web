import fs from "node:fs";
import path from "node:path";
import type { CoupleConfig, CoupleSummary } from "./types";

/**
 * Server-only config loader. Reads config/couples/*.json at build time.
 * Never import this from a client component (it pulls in node:fs).
 */
const CONFIG_DIR = path.join(process.cwd(), "config", "couples");

function readCouples(): CoupleConfig[] {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  const files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  return files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, f), "utf-8")) as CoupleConfig;
      } catch (e) {
        console.error(`[config] failed to parse ${f}:`, e);
        return null;
      }
    })
    .filter((c): c is CoupleConfig => c !== null);
}

let cache: CoupleConfig[] | null = null;

export function getAllCouples(): CoupleConfig[] {
  if (!cache) cache = readCouples();
  return cache;
}

export function getCouple(slug: string): CoupleConfig | undefined {
  return getAllCouples().find((c) => c.slug === slug);
}

export function getCoupleSummaries(): CoupleSummary[] {
  return getAllCouples().map((c) => ({
    slug: c.slug,
    theme: c.theme,
    language: c.language,
    names: { bride: c.couple.bride.name, groom: c.couple.groom.name },
  }));
}

/** Slugs for generateStaticParams — couples are fixed at build time. */
export function getCoupleSlugs(): string[] {
  return getAllCouples().map((c) => c.slug);
}
