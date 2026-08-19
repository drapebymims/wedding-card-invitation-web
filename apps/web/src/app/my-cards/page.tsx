"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fraunces } from "next/font/google";
import { t } from "@/lib/i18n";
import { AppHeader } from "@/components/buyer/AppHeader";
import { StatusBadge } from "@/components/buyer/StatusBadge";
import { listOrders, checkout, isSignedIn, formatPrice } from "@/lib/buyer/orders-adapter";
import type { OrderSummary } from "@/lib/buyer/types";
import "@/app/buyer.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

export default function MyCardsPage() {
  const router = useRouter();
  const lang = "ms";
  const [authed, setAuthed] = useState<boolean>(() => isSignedIn());
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSignedIn()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setOrders(await listOrders());
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic", lang));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handlePay(order: OrderSummary) {
    setBusyId(order.id);
    try {
      const { billUrl } = await checkout(order.id);
      if (billUrl) router.push(billUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic", lang));
    } finally {
      setBusyId(null);
    }
  }

  // B8 — editable while draft, awaiting_payment, or paid within edit_until.
  const editable = (status: string, editUntil?: string | null) =>
    status === "draft" ||
    status === "awaiting_payment" ||
    (status === "paid" && !!editUntil && new Date(editUntil).getTime() > Date.now());
  // B7 — payable for drafts and awaiting_payment (backend checkout accepts drafts).
  const payable = (status: string) => status === "draft" || status === "awaiting_payment";
  const live = (status: string) => status === "live";
  const publishing = (status: string) => status === "paid" || status === "building";

  return (
    <div className={`flex min-h-full flex-col ${fraunces.variable} bg-[var(--c-bg)]`}>
      <AppHeader lang={lang} />
      <main className="buyer-hero flex-1 px-5 py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="buyer-eyebrow">{t("nav_my_cards", lang)}</p>
              <h1 className={`buyer-display mt-2 text-4xl font-semibold text-[var(--c-text)]`}>
                {t("my_cards_title", lang)}
              </h1>
              <p className="mt-3 max-w-xl text-[var(--c-muted)]">{t("my_cards_subtitle", lang)}</p>
            </div>
            <Link
              href="/templates"
              className="rounded-xl bg-[var(--c-primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("create_new_card", lang)}
            </Link>
          </div>

          <div className="mt-10">
            {!authed ? (
              <div className="buyer-card p-10 text-center">
                <p className="text-[var(--c-muted)]">{t("sign_in_prompt", lang)}</p>
                <Link
                  href="/templates"
                  className="mt-4 inline-block rounded-xl bg-[var(--c-primary)] px-5 py-2.5 text-sm font-medium text-white"
                >
                  {t("browse_templates", lang)}
                </Link>
              </div>
            ) : loading ? (
              <p className="text-sm text-[var(--c-muted)]">…</p>
            ) : error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : orders.length === 0 ? (
              <div className="buyer-card p-12 text-center">
                <p className="text-[var(--c-muted)]">{t("no_cards", lang)}</p>
                <Link
                  href="/templates"
                  className="mt-4 inline-block rounded-xl bg-[var(--c-primary)] px-5 py-2.5 text-sm font-medium text-white"
                >
                  {t("create_new_card", lang)}
                </Link>
              </div>
            ) : (
              <ul className="space-y-4">
                {orders.map((order) => (
                  <li key={order.id} className="buyer-card flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className={`buyer-display text-xl font-semibold text-[var(--c-text)]`}>
                          {order.names.bride} &amp; {order.names.groom}
                        </h2>
                        <StatusBadge status={order.status} lang={lang} />
                      </div>
                      <p className="mt-1 text-sm text-[var(--c-muted)]">
                        /w/{order.coupleSlug} · {t(`theme_${order.theme}_name` as never, lang)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {editable(order.status, order.editUntil) ? (
                        <Link
                          href={`/studio?order=${order.id}`}
                          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--c-text)] transition-colors hover:border-[var(--c-primary)]"
                        >
                          {t("continue_editing", lang)}
                        </Link>
                      ) : null}
                      {payable(order.status) ? (
                        <button
                          onClick={() => handlePay(order)}
                          disabled={busyId === order.id}
                          className="rounded-lg bg-[var(--c-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {busyId === order.id
                            ? t("saving", lang)
                            : `${t("pay_now", lang)} · ${formatPrice(order.price, order.priceCurrency)}`}
                        </button>
                      ) : null}
                      {publishing(order.status) ? (
                        <span className="text-sm text-[var(--c-muted)]">{t("thanks_check_later", lang)}</span>
                      ) : null}
                      {live(order.status) ? (
                        <a
                          href={`/w/${order.coupleSlug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-[var(--c-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                        >
                          {t("view_live", lang)}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
      <footer className="border-t border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--c-muted)]">
        {t("platform_footer", lang)}
      </footer>
    </div>
  );
}
