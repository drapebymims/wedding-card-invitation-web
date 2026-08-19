"use client";

import type { ComponentType } from "react";
import type { CoupleConfig } from "@/lib/types";
import { FallbackCardPreview } from "./fallback-preview";
// Fixer lane's real renderer (now on disk). Fall back to our self-contained
// preview if it can't be resolved (e.g. during parallel development).
import { CardPreview as FixerCardPreview, type CardPreviewProps } from "@/lib/preview-render";

/**
 * `LiveCardPreview` — the single live-preview component used by the catalog
 * and the studio.
 *
 * Prefers the fixer lane's `CardPreview` (from `preview-render.tsx`). If that
 * renderer is unavailable it falls back to the self-contained
 * `FallbackCardPreview`, so the flow never blocks on preview rendering.
 */

export function LiveCardPreview({ config, className, interactive }: CardPreviewProps) {
  const Preview = typeof FixerCardPreview === "function" ? (FixerCardPreview as ComponentType<CardPreviewProps>) : null;

  if (Preview) {
    return <Preview config={config} themeId={config.theme} interactive={interactive} className={className} />;
  }
  return <FallbackCardPreview config={config} />;
}
