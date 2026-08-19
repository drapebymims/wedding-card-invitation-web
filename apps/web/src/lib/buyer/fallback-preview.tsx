"use client";

import type { CoupleConfig, ThemeId } from "@/lib/types";
import { t } from "@/lib/i18n";

/**
 * Fallback live preview — a lightweight, theme-aware rendering of a
 * CoupleConfig in a phone frame.
 *
 * This is the "graceful degradation" path for the studio + catalog previews
 * while the fixer lane's `CardPreview` renderer is being built. Once the real
 * renderer lands, the `LiveCardPreview` adapter switches to it automatically;
 * this component remains as a fast, self-contained preview and a safe fallback.
 */

const THEME_STYLES: Record<ThemeId, { name: string; bg: string; text: string; accent: string; surface: string; serif: boolean }> = {
  refined: {
    name: "Refined",
    bg: "#fbf9f4",
    text: "#2e2a26",
    accent: "#8b5a2b",
    surface: "#ffffff",
    serif: true,
  },
  minimal: {
    name: "Minimal",
    bg: "#f4f4f1",
    text: "#0c0c09",
    accent: "#312c85",
    surface: "#ffffff",
    serif: false,
  },
  vibrant: {
    name: "Vibrant",
    bg: "#fff8f2",
    text: "#2f281d",
    accent: "#7c61d4",
    surface: "#ffffff",
    serif: false,
  },
};

function formatDate(iso: string, lang: "ms" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function FallbackCardPreview({ config }: { config: CoupleConfig }) {
  const s = THEME_STYLES[config.theme] ?? THEME_STYLES.refined;
  const lang = config.language;
  const { bride, groom } = config.couple;
  const displayFont = s.serif ? "Georgia, 'Times New Roman', serif" : "ui-sans-serif, system-ui, sans-serif";
  const bodyFont = "ui-sans-serif, system-ui, sans-serif";
  const hasContent = bride.fullName || groom.fullName || config.wedding.tagline || config.events.length > 0;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: s.bg, color: s.text, fontFamily: bodyFont }}
    >
      {/* Hero */}
      <div className="relative flex flex-col items-center px-5 pb-6 pt-12 text-center">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-60"
          style={{
            background: `radial-gradient(ellipse at top, ${s.accent}22, transparent 70%)`,
          }}
        />
        <p
          className="relative mb-3 text-[10px] uppercase"
          style={{ color: s.accent, letterSpacing: "0.3em" }}
        >
          {t("invitation", lang)}
        </p>
        <h2
          className="relative text-2xl leading-tight"
          style={{ fontFamily: displayFont, letterSpacing: s.serif ? "0" : "-0.03em" }}
        >
          <span className="block">{bride.fullName || (bride.name ? bride.name : "Pengantin")}</span>
          <span className="block" style={{ color: s.accent, fontSize: "0.6em", fontStyle: "italic" }}>
            &amp;
          </span>
          <span className="block">{groom.fullName || (groom.name ? groom.name : "Pengantin")}</span>
        </h2>
        {config.wedding.date ? (
          <p
            className="relative mt-3 border-y px-4 py-1.5 text-[10px] uppercase"
            style={{ color: s.accent, borderColor: `${s.accent}44`, letterSpacing: "0.25em" }}
          >
            {formatDate(config.wedding.date, lang)}
          </p>
        ) : null}
        {config.events[0] ? (
          <p className="relative mt-3 text-[11px]" style={{ color: "inherit", opacity: 0.7 }}>
            {config.events[0].venue}
            {config.events[0].address ? ` — ${config.events[0].address}` : ""}
          </p>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-hidden px-5 pb-6">
        {config.wedding.tagline ? (
          <p
            className="text-center text-[12px] leading-relaxed"
            style={{ fontFamily: s.serif ? displayFont : bodyFont, fontStyle: s.serif ? "italic" : "normal" }}
          >
            {config.wedding.tagline}
          </p>
        ) : null}

        {/* Portraits */}
        {(bride.photo || groom.photo) && (
          <div className="flex items-center justify-center gap-4">
            {bride.photo ? (
              <div className="h-16 w-16 overflow-hidden rounded-full border-2" style={{ borderColor: s.surface }}>
                <img src={bride.photo} alt={bride.fullName} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ) : null}
            {groom.photo ? (
              <div className="h-16 w-16 overflow-hidden rounded-full border-2" style={{ borderColor: s.surface }}>
                <img src={groom.photo} alt={groom.fullName} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ) : null}
          </div>
        )}

        {config.story.length > 0 ? (
          <div>
            <p
              className="mb-2 text-center text-[11px] font-semibold uppercase"
              style={{ color: s.accent, letterSpacing: "0.2em" }}
            >
              {t("our_story", lang)}
            </p>
            <div className="space-y-2">
              {config.story.slice(0, 3).map((e, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: s.surface }}>
                  <p className="text-[11px] font-semibold" style={{ fontFamily: displayFont }}>
                    {e.title}
                  </p>
                  {e.date ? (
                    <p className="text-[9px] uppercase" style={{ color: s.accent, letterSpacing: "0.15em" }}>
                      {e.date}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {config.events.length > 0 ? (
          <div>
            <p
              className="mb-2 text-center text-[11px] font-semibold uppercase"
              style={{ color: s.accent, letterSpacing: "0.2em" }}
            >
              {t("events", lang)}
            </p>
            <div className="space-y-2">
              {config.events.map((e, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: s.surface }}>
                  <p className="text-[9px] uppercase" style={{ color: s.accent, letterSpacing: "0.15em" }}>
                    {t(e.type, lang)}
                  </p>
                  <p className="text-[11px] font-semibold" style={{ fontFamily: displayFont }}>
                    {e.name}
                  </p>
                  <p className="text-[10px]" style={{ opacity: 0.7 }}>
                    {formatDate(e.date, lang)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {!hasContent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <p className="text-[12px]" style={{ opacity: 0.6 }}>
            {t("preview_pending_title", lang)}
          </p>
          <p className="text-[11px] leading-relaxed" style={{ opacity: 0.5 }}>
            {t("preview_pending_body", lang)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
