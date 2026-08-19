"use client";

import { t } from "@/lib/i18n";
import type { OrderStatus } from "@/lib/buyer/types";

/**
 * StatusBadge — renders an order's lifecycle status with a colour that carries
 * meaning (draft = neutral, awaiting payment = amber, paid/building = blue,
 * live = green, expired/cancelled = muted/red).
 */
const STATUS_STYLE: Record<OrderStatus, string> = {
  draft: "bg-[var(--c-muted)]/15 text-[var(--c-muted)]",
  awaiting_payment: "bg-amber-100 text-amber-700",
  paid: "bg-blue-100 text-blue-700",
  building: "bg-sky-100 text-sky-700",
  live: "bg-emerald-100 text-emerald-700",
  expired: "bg-[var(--c-muted)]/15 text-[var(--c-muted)]",
  cancelled: "bg-red-100 text-red-600",
};

const STATUS_KEY: Record<OrderStatus, string> = {
  draft: "status_draft",
  awaiting_payment: "status_awaiting_payment",
  paid: "status_paid",
  building: "status_building",
  live: "status_live",
  expired: "status_expired",
  cancelled: "status_cancelled",
};

export function StatusBadge({ status, lang = "ms" }: { status: OrderStatus; lang?: "ms" | "en" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
    >
      {t(STATUS_KEY[status] as never, lang)}
    </span>
  );
}
