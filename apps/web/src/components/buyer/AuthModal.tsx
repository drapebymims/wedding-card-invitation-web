"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { signIn, signUp } from "@/lib/buyer/orders-adapter";
import { TextInput } from "./Field";

/**
 * AuthModal — sign in / create account modal used across the buyer flow.
 * Calls the orders adapter (which routes to the fixer's Cognito client when
 * ready, or the local mock for now).
 */
export function AuthModal({
  open,
  onClose,
  onAuthed,
  lang = "ms",
}: {
  open: boolean;
  onClose: () => void;
  onAuthed?: () => void;
  lang?: "ms" | "en";
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUp({ name, email, password });
      } else {
        await signIn(email, password);
      }
      onAuthed?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error_generic", lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--c-surface)] p-6 shadow-[var(--shadow)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--c-text)]">
            {mode === "signin" ? t("sign_in", lang) : t("create_account", lang)}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-xl leading-none text-[var(--c-muted)] hover:text-[var(--c-text)]">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" ? (
            <TextInput label={t("name", lang)} value={name} onChange={(e) => setName(e.target.value)} required />
          ) : null}
          <TextInput
            label={t("email", lang)}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <TextInput
            label={t("password", lang)}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[var(--c-primary)] px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? t("saving", lang) : mode === "signin" ? t("sign_in", lang) : t("create_account", lang)}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-[var(--c-muted)]">
          {mode === "signin" ? (
            <>
              {t("create_account", lang)}?{" "}
              <button className="font-medium text-[var(--c-primary)] underline" onClick={() => setMode("signup")}>
                {t("create_account", lang)}
              </button>
            </>
          ) : (
            <>
              {t("sign_in", lang)}?{" "}
              <button className="font-medium text-[var(--c-primary)] underline" onClick={() => setMode("signin")}>
                {t("sign_in", lang)}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
