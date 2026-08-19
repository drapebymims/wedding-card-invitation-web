"use client";

import { t } from "@/lib/i18n";

export interface StepDef {
  key: string;
  label: string;
}

/**
 * Stepper — the studio's step navigation. Shows progress, the current step,
 * and lets the user jump back to any completed step.
 */
export function Stepper({
  steps,
  current,
  onSelect,
  lang = "ms",
}: {
  steps: StepDef[];
  current: number;
  onSelect: (index: number) => void;
  lang?: "ms" | "en";
}) {
  return (
    <nav aria-label={t("step_of", lang)} className="w-full">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          const isDone = i < current;
          return (
            <li key={step.key} className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => onSelect(i)}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  isCurrent
                    ? "bg-[var(--c-primary)] text-white"
                    : isDone
                      ? "text-[var(--c-primary)] hover:bg-[var(--c-primary)]/10"
                      : "text-[var(--c-muted)] hover:bg-[var(--c-surface)]"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    isCurrent
                      ? "bg-white/20"
                      : isDone
                        ? "bg-[var(--c-primary)] text-white"
                        : "bg-[var(--c-muted)]/20 text-[var(--c-muted)]"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{t(step.label as never, lang)}</span>
              </button>
              {i < steps.length - 1 ? <span className="h-px w-3 bg-[var(--border)]" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
