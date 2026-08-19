"use client";

import Link from "next/link";
import { Fraunces } from "next/font/google";
import { t } from "@/lib/i18n";
import { AppHeader } from "@/components/buyer/AppHeader";
import { PhoneFrame } from "@/components/buyer/PhoneFrame";
import { LiveCardPreview } from "@/lib/buyer/preview-adapter";
import { SAMPLE_CONFIGS, THEME_ORDER } from "@/lib/buyer/sample-configs";
import { catalogPrice } from "@/lib/buyer/orders-adapter";
import type { ThemeId } from "@/lib/types";
import "@/app/buyer.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

const THEME_META: Record<ThemeId, { name: string; desc: string; tag: string }> = {
  refined: { name: "theme_refined_name", desc: "theme_refined_desc", tag: "Klasik" },
  minimal: { name: "theme_minimal_name", desc: "theme_minimal_desc", tag: "Editorial" },
  vibrant: { name: "theme_vibrant_name", desc: "theme_vibrant_desc", tag: "Tropika" },
};

export default function TemplatesPage() {
  const lang = "ms";

  return (
    <div className={`flex min-h-full flex-col ${fraunces.variable} bg-[var(--c-bg)]`}>
      <AppHeader lang={lang} />

      {/* Hero */}
      <section className="buyer-hero px-5 pb-14 pt-16 text-center sm:pt-24">
        <p className="buyer-eyebrow buyer-rise">Katalog Tema</p>
        <h1 className={`buyer-display buyer-rise buyer-rise-2 mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight text-[var(--c-text)] sm:text-6xl`}>
          {t("catalog_title", lang)}
        </h1>
        <p className="buyer-rise buyer-rise-3 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--c-muted)] sm:text-lg">
          {t("catalog_subtitle", lang)}
        </p>
        <p className="buyer-rise buyer-rise-4 mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--c-surface)] px-5 py-2 text-sm text-[var(--c-text)]">
          <span className="buyer-display text-lg font-semibold text-[var(--c-primary)]">
            {catalogPrice()}
          </span>
          <span className="text-[var(--c-muted)]">· {t("catalog_once", lang)}</span>
        </p>
      </section>

      {/* Catalog grid */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24">
        <div className="grid gap-8 md:grid-cols-3">
          {THEME_ORDER.map((theme, i) => {
            const meta = THEME_META[theme];
            const config = SAMPLE_CONFIGS[theme];
            return (
              <article
                key={theme}
                className={`buyer-card buyer-lift buyer-rise buyer-rise-${i + 1} flex flex-col overflow-hidden`}
              >
                {/* Preview in phone frame */}
                <div className="buyer-hero flex items-center justify-center px-6 py-8">
                  <PhoneFrame>
                    <LiveCardPreview config={config} interactive={false} />
                  </PhoneFrame>
                </div>

                {/* Details */}
                <div className="flex flex-1 flex-col gap-3 border-t border-[var(--border)] p-6">
                  <div className="flex items-center justify-between">
                    <h2 className={`buyer-display text-2xl font-semibold text-[var(--c-text)]`}>
                      {t(meta.name as never, lang)}
                    </h2>
                    <span className="rounded-full bg-[var(--c-primary)]/10 px-3 py-1 text-xs font-medium text-[var(--c-primary)]">
                      {meta.tag}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--c-muted)]">{t(meta.desc as never, lang)}</p>

                  <div className="mt-auto flex items-center gap-2 pt-4">
                    <Link
                      href={`/templates/preview/${theme}`}
                      className="flex-1 rounded-xl border border-[var(--border)] px-4 py-2.5 text-center text-sm font-medium text-[var(--c-text)] transition-colors hover:border-[var(--c-primary)]"
                    >
                      {t("preview", lang)}
                    </Link>
                    <Link
                      href={`/studio?theme=${theme}`}
                      className="flex-1 rounded-xl bg-[var(--c-primary)] px-4 py-2.5 text-center text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      {t("use_template", lang)}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--c-muted)]">
        {t("platform_footer", lang)}
      </footer>
    </div>
  );
}
