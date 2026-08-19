"use client";

import type { ReactNode } from "react";

/**
 * PhoneFrame — a stylised smartphone mockup that holds the live card preview.
 * Mobile-first: on small screens it collapses to a plain rounded container so
 * the studio form and preview stack nicely.
 */
export function PhoneFrame({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[300px]">
        {/* Notch / status bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-2">
          <div className="h-4 w-24 rounded-full bg-black/85" />
        </div>
        {/* Screen */}
        <div className="overflow-hidden rounded-[2.2rem] border border-black/10 bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.35)]">
          <div className="relative aspect-[9/19] w-full overflow-hidden bg-[var(--c-bg)]">
            {children}
          </div>
        </div>
        {/* Home indicator */}
        <div className="pointer-events-none absolute inset-x-0 bottom-1.5 z-20 flex justify-center">
          <div className="h-1 w-24 rounded-full bg-black/30" />
        </div>
      </div>
      {label ? (
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--c-muted)]">{label}</p>
      ) : null}
    </div>
  );
}
