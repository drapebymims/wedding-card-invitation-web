"use client";

import Link from "next/link";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { currentUser, isSignedIn, signOut } from "@/lib/buyer/orders-adapter";
import { AuthModal } from "./AuthModal";

/**
 * AppHeader — the buyer platform navigation. Shared across the catalog,
 * studio and my-cards surfaces. Not signed in? Shows a Sign In action.
 */
export function AppHeader({ lang = "ms" }: { lang?: "ms" | "en" }) {
  const [authed, setAuthed] = useState<boolean>(() => isSignedIn());
  const [authOpen, setAuthOpen] = useState(false);
  const user = currentUser();

  function handleSignOut() {
    void signOut().then(() => setAuthed(false));
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--c-bg)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--c-primary)] text-sm text-white">
            ♥
          </span>
          <span className="text-lg font-semibold tracking-tight text-[var(--c-text)]">
            Wedding<span className="text-[var(--c-primary)]">Card</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/templates"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface)]"
          >
            {t("nav_templates", lang)}
          </Link>
          <Link
            href="/pricing"
            className="rounded-full px-3 py-1.5 font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface)]"
          >
            {t("pricing_title", lang)}
          </Link>
          {authed ? (
            <Link
              href="/my-cards"
              className="rounded-full px-3 py-1.5 font-medium text-[var(--c-text)] transition-colors hover:bg-[var(--c-surface)]"
            >
              {t("nav_my_cards", lang)}
            </Link>
          ) : null}
          {authed ? (
            <button
              onClick={handleSignOut}
              className="rounded-full px-3 py-1.5 font-medium text-[var(--c-muted)] transition-colors hover:text-[var(--c-text)]"
            >
              {t("nav_sign_out", lang)}
            </button>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="rounded-full bg-[var(--c-primary)] px-4 py-1.5 font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("nav_sign_in", lang)}
            </button>
          )}
        </nav>
      </div>
      {user ? (
        <p className="mx-auto max-w-6xl px-5 pb-2 text-xs text-[var(--c-muted)]">
          {user.name ?? user.email}
        </p>
      ) : null}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={() => setAuthed(true)} lang={lang} />
    </header>
  );
}
