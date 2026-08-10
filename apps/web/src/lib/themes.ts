import type { ComponentType } from "react";
import type { CoupleConfig, ThemeId } from "./types";

/**
 * Theme registry — maps a config's `theme` to its page component.
 * Every theme renders the full wedding page for one couple.
 */
export type WeddingTheme = ComponentType<{ couple: CoupleConfig }>;

// Lazy-loaded so each theme's styles only ship on pages that use them.
const loaders: Record<ThemeId, () => Promise<{ default: WeddingTheme }>> = {
  refined: () => import("@/themes/refined"),
  minimal: () => import("@/themes/minimal"),
  vibrant: () => import("@/themes/vibrant"),
};

const loaded = new Map<ThemeId, WeddingTheme>();

export async function getTheme(themeId: ThemeId): Promise<WeddingTheme> {
  if (!loaded.has(themeId)) {
    const mod = await loaders[themeId]();
    loaded.set(themeId, mod.default);
  }
  return loaded.get(themeId)!;
}

export function isThemeId(value: string): value is ThemeId {
  return value in loaders;
}
