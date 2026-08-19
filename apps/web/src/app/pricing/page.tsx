"use client";

import Link from "next/link";
import { Fraunces } from "next/font/google";
import { t } from "@/lib/i18n";
import { AppHeader } from "@/components/buyer/AppHeader";
import { catalogPrice } from "@/lib/buyer/orders-adapter";
import "@/app/buyer.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

const INCLUDED_FEATURES = [
  "pricing_free_drafts",
  "pricing_unlimited",
  "pricing_no_fees",
  "pricing_live_year",
  "pricing_editable",
];

export default function PricingPage() {
  const lang = "ms";
  const price = catalogPrice();

  return (
    <div className={`flex min-h-full flex-col ${fraunces.variable} bg-[var(--c-bg)]`}>
      <AppHeader lang={lang} />

      {/* Hero */}
      <section className="buyer-hero px-5 pb-16 pt-16 text-center sm:pt-24">
        <p className="buyer-eyebrow buyer-rise">{t("pricing_title", lang)}</p>
        <h1 className={`buyer-display buyer-rise buyer-rise-2 mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight text-[var(--c-text)] sm:text-6xl`}>
          {t("pricing_title", lang)}
        </h1>
        <p className="buyer-rise buyer-rise-3 mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--c-muted)] sm:text-lg">
          {t("pricing_subtitle", lang)}
        </p>
      </section>

      {/* Pricing card */}
      <section className="mx-auto w-full max-w-md px-5 pb-20">
        <div className="buyer-card buyer-rise overflow-hidden">
          {/* Price */}
          <div className="border-b border-[var(--border)] bg-[var(--c-surface)] px-8 py-10 text-center">
            <p className="buyer-eyebrow">{t("pricing_one_time", lang)}</p>
            <p className={`buyer-display mt-3 text-6xl font-semibold text-[var(--c-primary)]`}>{price}</p>
            <p className="mt-1 text-sm text-[var(--c-muted)]">{t("pricing_per_card", lang)}</p>
            <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-[var(--c-muted)]">
              {t("pricing_yours_forever", lang)}
            </p>
          </div>

          {/* Included */}
          <div className="bg-[var(--c-bg)] px-8 py-8">
            <p className="text-sm font-medium text-[var(--c-text)]">{t("pricing_includes", lang)}</p>
            <ul className="mt-4 space-y-3">
              {INCLUDED_FEATURES.map((key) => (
                <li key={key} className="flex items-center gap-3 text-sm text-[var(--c-text)]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--c-primary)] text-[11px] text-white">
                    ✓
                  </span>
                  {t(key as never, lang)}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="border-t border-[var(--border)] bg-[var(--c-surface)] px-8 py-6">
            <Link
              href="/templates"
              className="block w-full rounded-xl bg-[var(--c-primary)] px-4 py-3 text-center text-base font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("pricing_cta", lang)}
            </Link>
            <p className="mt-3 text-center text-xs text-[var(--c-muted)]">{t("pricing_guarantee", lang)}</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--c-muted)]">
        {t("platform_footer", lang)}
      </footer>
    </div>
  );
}
