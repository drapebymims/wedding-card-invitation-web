"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { OpeningScreenProps } from "./props";

const REVEAL_MS = 600;

/**
 * OpeningScreen — full-screen "open invitation" gate. Shown once per browser
 * session (sessionStorage). The overlay always renders on first paint (SSR-safe)
 * and only unmounts after a guest opens it or sessionStorage says they already did.
 */
export default function OpeningScreen({ couple, onOpen, children }: OpeningScreenProps) {
  const lang = couple.language;
  const storageKey = `wciw_opened_${couple.slug}`;

  const [mounted, setMounted] = useState(false);
  const [opened, setOpened] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Deferred past hydration so the initial paint always matches SSR markup.
    const id = window.setTimeout(() => {
      setMounted(true);
      try {
        if (window.sessionStorage.getItem(storageKey) === "1") setOpened(true);
      } catch {
        // sessionStorage unavailable (private mode / SSR) — keep the gate closed.
      }
    }, 0);
    return () => {
      window.clearTimeout(id);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [storageKey]);

  function handleOpen() {
    try {
      window.sessionStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage failures — still reveal the invitation.
    }
    onOpen?.();
    setRevealed(true);
    timerRef.current = window.setTimeout(() => setOpened(true), REVEAL_MS);
  }

  if (opened) return <>{children}</>;

  return (
    <>
      {children}

      <div
        className={`fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-(--c-bg) p-6 transition-all duration-500 ${
          revealed ? "pointer-events-none scale-[0.97] opacity-0" : "opacity-100"
        }`}
        style={mounted && !revealed ? { animation: "wciw-open-in 0.7s ease-out" } : undefined}
      >
        <div className="mx-auto w-full max-w-md text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.25em] text-(--c-muted)">
            {t("invitation", lang)}
          </p>
          <h1 className="text-4xl font-semibold text-(--c-primary) sm:text-5xl [font-family:var(--font-display)]">
            {couple.couple.bride.name} <span className="text-(--c-muted)">&</span>{" "}
            {couple.couple.groom.name}
          </h1>
          <p className="mt-4 text-(--c-muted)">{formatDate(couple.wedding.date, lang)}</p>
          {couple.wedding.tagline ? (
            <p className="mt-4 text-sm leading-relaxed text-(--c-muted)">{couple.wedding.tagline}</p>
          ) : null}
          <button
            type="button"
            onClick={handleOpen}
            className="mt-8 rounded-full bg-(--c-primary) px-8 py-3 font-medium text-white shadow-(--shadow) transition hover:opacity-90"
          >
            {t("open_invitation", lang)}
          </button>
        </div>
      </div>

      <style>{`@keyframes wciw-open-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }`}</style>
    </>
  );
}
