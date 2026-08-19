"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fraunces } from "next/font/google";
import { t } from "@/lib/i18n";
import { AppHeader } from "./AppHeader";
import { PhoneFrame } from "./PhoneFrame";
import { LiveCardPreview } from "@/lib/buyer/preview-adapter";
import { SAMPLE_CONFIGS } from "@/lib/buyer/sample-configs";
import { catalogPrice } from "@/lib/buyer/orders-adapter";
import { isThemeId } from "@/lib/themes";
import type { ThemeId } from "@/lib/types";
import "@/app/buyer.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

export default function TemplatePreview() {
  const params = useParams<{ theme: string }>();
  const theme = isThemeId(params.theme) ? (params.theme as ThemeId) : "refined";
  const lang = "ms";
  const config = SAMPLE_CONFIGS[theme];

  return (
    <div className={`flex min-h-full flex-col ${fraunces.variable} bg-[var(--c-bg)]`}>
      <AppHeader lang={lang} />
      <main className="buyer-hero flex-1 px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center">
          {/* Demo phone */}
          <div className="buyer-rise shrink-0">
            <PhoneFrame label={t("live_demo", lang)}>
              <LiveCardPreview config={config} interactive={false} />
            </PhoneFrame>
          </div>

          {/* Details + CTA */}
          <div className="buyer-rise buyer-rise-2 w-full max-w-sm">
            <Link
              href="/templates"
              className="inline-block text-sm text-[var(--c-muted)] transition-colors hover:text-[var(--c-primary)]"
            >
              {t("back_to_templates", lang)}
            </Link>
            <h1 className={`buyer-display mt-4 text-4xl font-semibold text-[var(--c-text)]`}>
              {t(`theme_${theme}_name` as never, lang)}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-[var(--c-muted)]">
              {t(`theme_${theme}_desc` as never, lang)}
            </p>

            <div className="mt-6 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--c-surface)] px-5 py-4">
              <span className={`buyer-display text-3xl font-semibold text-[var(--c-primary)]`}>
                {catalogPrice()}
              </span>
              <span className="text-sm text-[var(--c-muted)]">· {t("catalog_once", lang)}</span>
            </div>

            <Link
              href={`/studio?theme=${theme}`}
              className="mt-6 block w-full rounded-xl bg-[var(--c-primary)] px-4 py-3 text-center text-base font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("start_creating", lang)}
            </Link>
          </div>
        </div>
      </main>
      <footer className="border-t border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--c-muted)]">
        {t("platform_footer", lang)}
      </footer>
    </div>
  );
}
