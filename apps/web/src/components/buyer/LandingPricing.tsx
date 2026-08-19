"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { catalogPrice } from "@/lib/buyer/orders-adapter";

/**
 * LandingPricing — a lightweight pricing band for the public landing page.
 * Uses the same dynamic `catalogPrice()` as the catalog so the price is always
 * in sync (env-driven, tier-ready). Kept as a small client island so the rest
 * of the server-rendered landing stays static.
 */
export function LandingPricing() {
  const lang = "en"; // match the landing page's existing copy language
  const price = catalogPrice();

  return (
    <section className="bg-[var(--c-surface)] px-5 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-semibold text-[var(--c-text)]">
          {t("pricing_title", lang)}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[var(--c-muted)]">
          {t("pricing_subtitle", lang)}
        </p>

        <div className="mx-auto mt-10 max-w-md">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--c-bg)] p-8 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--c-primary)]">
              {t("pricing_one_time", lang)}
            </p>
            <p className="mt-3 text-6xl font-semibold text-[var(--c-text)]">{price}</p>
            <p className="mt-1 text-sm text-[var(--c-muted)]">{t("pricing_per_card", lang)}</p>
            <p className="mx-auto mt-4 max-w-xs text-sm text-[var(--c-muted)]">
              {t("pricing_yours_forever", lang)}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/templates"
                className="rounded-xl bg-[var(--c-primary)] px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t("pricing_cta", lang)}
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-[var(--border)] px-6 py-2.5 text-sm font-medium text-[var(--c-text)] transition-colors hover:border-[var(--c-primary)]"
              >
                {t("pricing_see_themes", lang)}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
