import Link from "next/link";
import { getCoupleSummaries } from "@/lib/config";
import { t } from "@/lib/i18n";
import { LandingPricing } from "@/components/buyer/LandingPricing";

export default function Home() {
  const couples = getCoupleSummaries();

  return (
    <div className="flex min-h-full flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center bg-[var(--c-bg)] px-5 pb-20 pt-24 text-center sm:pt-32">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-[var(--c-primary)]">
          Wedding Card Invitation
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-[var(--c-text)] sm:text-6xl">
          {t("platform_tagline", "en")}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--c-muted)] sm:text-lg">
          {t("platform_subtitle", "en")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {["feature_rsvp", "feature_wishes", "feature_gallery", "feature_countdown", "feature_music", "feature_mobile"].map(
            (key) => (
              <span
                key={key}
                className="rounded-full border border-[var(--border)] bg-[var(--c-surface)] px-4 py-1.5 text-sm text-[var(--c-text)]"
              >
                {t(key as never, "en")}
              </span>
            )
          )}
        </div>
      </section>

      {/* Directory */}
      <section className="bg-[var(--c-surface)] px-5 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-semibold text-[var(--c-text)]">
            {t("directory_title", "en")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[var(--c-muted)]">
            {t("directory_subtitle", "en")}
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {couples.map((c) => (
              <Link
                key={c.slug}
                href={`/w/${c.slug}`}
                className="group flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--c-bg)] p-6 transition-shadow hover:shadow-[var(--shadow)]"
              >
                <span className="text-sm uppercase tracking-[0.2em] text-[var(--c-primary)]">
                  {c.theme}
                </span>
                <span className="mt-3 text-2xl font-semibold text-[var(--c-text)]">
                  {c.names.bride} &amp; {c.names.groom}
                </span>
                <span className="mt-2 text-sm text-[var(--c-muted)]">/w/{c.slug}</span>
                <span className="mt-4 text-sm font-medium text-[var(--c-primary)] group-hover:underline">
                  {t("view_invitation", "en")} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <LandingPricing />

      {/* CTA */}
      <section className="bg-[var(--c-primary)] px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold text-white">{t("cta_title", "en")}</h2>
        <p className="mx-auto mt-4 max-w-xl text-white/80">{t("cta_subtitle", "en")}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/templates"
            className="inline-block rounded-full bg-white px-8 py-3 text-base font-semibold text-[var(--c-primary)] transition-transform hover:-translate-y-0.5"
          >
            {t("browse_templates", "en")} →
          </Link>
          <Link
            href="/pricing"
            className="inline-block rounded-full border border-white/50 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            {t("pricing_title", "en")}
          </Link>
        </div>
      </section>

      <footer className="bg-[var(--c-bg)] px-5 py-8 text-center text-sm text-[var(--c-muted)]">
        {t("platform_footer", "en")}
      </footer>
    </div>
  );
}
