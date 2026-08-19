"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fraunces } from "next/font/google";
import { t } from "@/lib/i18n";
import { AppHeader } from "./AppHeader";
import { getOrder } from "@/lib/buyer/orders-adapter";
import "@/app/buyer.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

/**
 * CheckoutThanks — post-payment awareness. Tells the buyer their card is being
 * published (build-on-demand) and will be live shortly at /w/<slug>.
 *
 * A6-frontend — the backend return URL is `/checkout/thanks?order=<order_id>`.
 * We read the `order` param, fetch the order, and display its couple_slug.
 */
export default function CheckoutThanks() {
  const searchParams = useSearchParams();
  const lang = "ms";
  const orderParam = searchParams.get("order") ?? "";

  const [slug, setSlug] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(orderParam));
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (!orderParam) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const order = await getOrder(orderParam);
        if (cancelled) return;
        setSlug(order.coupleSlug);
        setStatus(order.status);
        setNotFound(false);
      } catch {
        if (cancelled) return;
        setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    // Poll so the "view live card" affordance appears once the build-on-demand
    // publish flips the order to building / live.
    const id = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [orderParam]);

  const liveUrl = slug ? `/w/${slug}` : "";
  const canView = status === "live" || status === "building";

  return (
    <div className={`flex min-h-full flex-col ${fraunces.variable} bg-[var(--c-bg)]`}>
      <AppHeader lang={lang} />
      <main className="buyer-hero flex flex-1 items-center justify-center px-5 py-16">
        <div className="buyer-card w-full max-w-lg p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
            ✓
          </div>
          <h1 className={`buyer-display mt-6 text-4xl font-semibold text-[var(--c-text)]`}>
            {t("thanks_title", lang)}
          </h1>

          {loading ? (
            <p className="mt-4 text-sm text-[var(--c-muted)]">…</p>
          ) : notFound ? (
            <p className="mt-4 text-[var(--c-muted)]">{t("thanks_not_found", lang)}</p>
          ) : (
            <>
              <p className="mt-4 text-[var(--c-muted)]">{t("thanks_subtitle", lang)}</p>

              {liveUrl ? (
                <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--c-bg)] px-5 py-4">
                  <p className="text-sm text-[var(--c-muted)]">{t("thanks_live_at", lang)}</p>
                  <p className={`buyer-display mt-1 text-lg font-semibold text-[var(--c-primary)]`}>{liveUrl}</p>
                </div>
              ) : null}

              <p className="mt-5 text-sm text-[var(--c-muted)]">{t("thanks_check_later", lang)}</p>
            </>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {canView && liveUrl ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[var(--c-primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t("view_live", lang)}
              </a>
            ) : null}
            <Link
              href="/my-cards"
              className="rounded-xl bg-[var(--c-primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("go_to_my_cards", lang)}
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--c-text)] transition-colors hover:border-[var(--c-primary)]"
            >
              {t("back_home", lang)}
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
