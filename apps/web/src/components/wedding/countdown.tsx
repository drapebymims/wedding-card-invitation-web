"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import type { CountdownProps } from "./props";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Countdown — live ticker to the wedding datetime. Values are only computed on
 * the client (after mount) so the server and first client paint never differ.
 * Once the target passes, it switches to a "we're married" neutral message.
 */
export default function Countdown({ target, lang, className = "" }: CountdownProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const targetMs = new Date(target).getTime();
  const hasTarget = !Number.isNaN(targetMs);

  const diff = now !== null && hasTarget ? targetMs - now : null;
  const done = diff !== null && diff <= 0;
  const ready = diff !== null && !done;

  const days = ready ? Math.floor(diff / DAY_MS) : null;
  const hours = ready ? Math.floor((diff % DAY_MS) / HOUR_MS) : null;
  const minutes = ready ? Math.floor((diff % HOUR_MS) / MINUTE_MS) : null;
  const seconds = ready ? Math.floor((diff % MINUTE_MS) / 1000) : null;

  const unit = (label: string, value: string) => (
    <div className="flex min-w-16 flex-col items-center gap-1 rounded-(--radius) border border-(--border) bg-(--c-surface) px-3 py-3 text-center shadow-(--shadow)">
      <span className="text-2xl font-semibold text-(--c-primary) tabular-nums [font-family:var(--font-display)] sm:text-3xl">
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-widest text-(--c-muted)">{label}</span>
    </div>
  );

  if (done || !hasTarget) {
    return (
      <p
        className={`text-center text-lg italic leading-relaxed text-(--c-muted) ${className}`.trim()}
        role="status"
      >
        {t("closing_verse", lang)}
      </p>
    );
  }

  return (
    <div
      className={`flex items-start justify-center gap-2 sm:gap-3 ${className}`.trim()}
      role="timer"
      aria-label={t("countdown", lang)}
    >
      {unit(t("days", lang), days === null ? "--" : String(days))}
      {unit(t("hours", lang), hours === null ? "--" : pad(hours))}
      {unit(t("minutes", lang), minutes === null ? "--" : pad(minutes))}
      {unit(t("seconds", lang), seconds === null ? "--" : pad(seconds))}
    </div>
  );
}
