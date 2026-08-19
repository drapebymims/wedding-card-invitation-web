"use client";

import { Component, Suspense, use, useLayoutEffect, type ReactNode } from "react";
import type { CoupleConfig, ThemeId } from "./types";
import { getTheme, isThemeId } from "./themes";

/**
 * Live preview renderer — renders ANY CoupleConfig through the existing theme
 * system at RUNTIME (client-side), with no static-export build. This is the
 * black-box contract the studio (live personalized preview) and the catalog
 * (theme demos) consume.
 *
 * - The config is passed as a prop (in-memory object); it does NOT need to
 *   exist as a file under config/couples/.
 * - Themes are lazy-loaded through the shared registry (lib/themes.ts) and
 *   scoped by their own `.theme-<id>` wrapper class, so tokens never leak
 *   between previews or into the surrounding page.
 * - `interactive` toggles the theme's interactive bits:
 *     true  → music + confetti active
 *     false → catalog demo (music/confetti disabled via toDemoConfig)
 * - `contained` marks an embedded/studio context:
 *     true  → the wrapper becomes the containing block for the theme's
 *             `fixed` components (gate, music, share, confetti) so they stay
 *             inside the preview (A1), and the guest opening gate is
 *             auto-opened so card content shows instead of the gate (A2).
 *     false → guest-facing behavior (fixed components position against the
 *             viewport; gate behaves normally).
 *
 * This is a client module (shared components are "use client"); import it only
 * from client boundaries.
 */

export interface CardPreviewProps {
  /** The config to render — any in-memory CoupleConfig (no file required). */
  config: CoupleConfig;
  /** Override the theme; defaults to config.theme. */
  themeId?: string;
  /**
   * true = music + confetti active; false = catalog demo (music/confetti off).
   * @default true
   */
  interactive?: boolean;
  /**
   * Embedded/studio context. When true: (a) applies `contain: layout paint`
   * so the theme's fixed components stay inside the preview, and (b) auto-opens
   * the opening gate regardless of `interactive`. Combine with
   * interactive=true for the studio (music/confetti on, gate off) or
   * interactive=false for catalog demos (no music/confetti).
   * @default false
   */
  contained?: boolean;
  /** Class for the isolating wrapper — size/scroll the preview here. */
  className?: string;
}

function resolveTheme(themeId: string | undefined, config: CoupleConfig): ThemeId {
  if (themeId && isThemeId(themeId)) return themeId;
  return config.theme;
}

/**
 * Demo-mode config: disables music + confetti (both are config-driven) so a
 * catalog demo is quiet. The opening gate is handled separately (see
 * CardPreview) because the theme's gate is not config-gated.
 */
export function toDemoConfig(config: CoupleConfig): CoupleConfig {
  return {
    ...config,
    settings: { ...config.settings, confetti: false, music: false, openAnimation: false },
    wedding: { ...config.wedding, music: undefined },
  };
}

function ThemeView({ themeId, couple }: { themeId: ThemeId; couple: CoupleConfig }) {
  // `use()` suspends until the lazy theme resolves; wrapped in <Suspense>.
  const Theme = use(getTheme(themeId));
  return <Theme couple={couple} />;
}

function PreviewFallback() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 320,
        color: "var(--c-muted, #888)",
        fontFamily: "var(--font-body, sans-serif)",
      }}
    >
      Loading preview…
    </div>
  );
}

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            color: "#b00020",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          Preview failed to load: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export function CardPreview({
  config,
  themeId,
  interactive = true,
  contained = false,
  className,
}: CardPreviewProps) {
  const resolved = resolveTheme(themeId, config);
  const renderConfig = interactive ? config : toDemoConfig(config);

  // A2: auto-open the theme's opening gate in embedded/contained contexts
  // (studio + catalog demos) regardless of `interactive`, so card content shows
  // instead of the guest gate. Backward compat: `interactive={false}` (catalog
  // demo) also auto-opens the gate. useLayoutEffect runs before the child
  // theme's effects, so the gate's sessionStorage check sees the seeded value.
  useLayoutEffect(() => {
    if (!contained && interactive) return;
    try {
      window.sessionStorage.setItem(`wciw_opened_${config.slug}`, "1");
    } catch {
      // sessionStorage unavailable — the gate simply stays closed.
    }
  }, [contained, interactive, config.slug]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        // A1: layout containment makes this wrapper the containing block for
        // the theme's `fixed` components (gate, music, share, confetti) so they
        // stay inside the preview instead of covering the viewport; paint
        // containment clips them to the wrapper. Only in embedded contexts.
        ...(contained ? { contain: "layout paint" as const } : {}),
      }}
    >
      <PreviewErrorBoundary>
        <Suspense fallback={<PreviewFallback />}>
          <ThemeView themeId={resolved} couple={renderConfig} />
        </Suspense>
      </PreviewErrorBoundary>
    </div>
  );
}

export default CardPreview;
