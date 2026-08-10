"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getGifts, postGift, type Gift } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { GiftsBoardProps } from "./props";

const inputCls =
  "w-full rounded-(--radius) border border-(--border) bg-(--c-bg) px-3 py-2 text-(--c-text) placeholder:text-(--c-muted) focus:border-(--c-primary)";

type FormStatus = "idle" | "sending" | "success";

/** Legacy clipboard fallback for non-secure contexts. */
function legacyCopy(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      if (document.execCommand("copy")) resolve();
      else reject(new Error("copy command failed"));
    } catch (err) {
      reject(err);
    } finally {
      ta.remove();
    }
  });
}

/** GiftsBoard — bank accounts with copy buttons, plus a gift message form. */
export default function GiftsBoard({ couple, className = "" }: GiftsBoardProps) {
  const lang = couple.language;

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  // Optional: list already-approved gifts from the backend.
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [giftsError, setGiftsError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [item, setItem] = useState("");
  const [message, setMessage] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; message?: string }>({});
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getGifts(couple.slug)
      .then((all) => {
        if (!cancelled) setGifts(all.filter((g) => g.approved));
      })
      .catch(() => {
        if (!cancelled) setGiftsError(t("error_generic", lang));
      });
    return () => {
      cancelled = true;
    };
  }, [couple.slug, lang]);

  // Clear any pending "copied" reset if the board unmounts mid-timer.
  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    []
  );

  async function copyAccount(index: number, text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        await legacyCopy(text);
      }
    } catch {
      try {
        await legacyCopy(text);
      } catch {
        return; // clipboard unavailable — do nothing
      }
    }
    setCopiedIndex(index);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => {
      setCopiedIndex((cur) => (cur === index ? null : cur));
    }, 1500);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors: { name?: string; message?: string } = {};
    if (!name.trim()) nextErrors.name = t("required_field", lang);
    if (!message.trim()) nextErrors.message = t("required_field", lang);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFormError(null);
    setFormStatus("sending");
    try {
      await postGift({
        coupleSlug: couple.slug,
        name: name.trim(),
        message: message.trim(),
        item: item.trim() || undefined,
      });
      setFormStatus("success");
      setName("");
      setItem("");
      setMessage("");
    } catch {
      setFormError(t("error_generic", lang));
      setFormStatus("idle");
    }
  }

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {/* Bank accounts */}
      {couple.gifts.accounts.length > 0 ? (
        <div className="space-y-3">
          {couple.gifts.accounts.map((acc, i) => (
            <div
              key={`${acc.bank}-${i}`}
              className="flex items-center justify-between gap-3 rounded-(--radius) border border-(--border) bg-(--c-surface) p-4 shadow-(--shadow)"
            >
              <div className="min-w-0">
                <p className="font-medium text-(--c-text)">{acc.bank}</p>
                <p className="truncate text-sm text-(--c-muted)">{acc.holder}</p>
                <code className="mt-1 block text-sm font-semibold tracking-wide text-(--c-primary)">
                  {acc.accountNumber}
                </code>
              </div>
              <button
                type="button"
                onClick={() => void copyAccount(i, acc.accountNumber)}
                aria-live="polite"
                className="shrink-0 rounded-(--radius) border border-(--border) bg-(--c-bg) px-3 py-1.5 text-sm font-medium text-(--c-primary) transition hover:opacity-90"
              >
                {copiedIndex === i ? t("copied", lang) : t("copy_bank", lang)}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {couple.gifts.message ? (
        <p className="text-(--c-muted)">{couple.gifts.message}</p>
      ) : null}

      {/* Approved gifts (optional listing) */}
      {gifts.length > 0 ? (
        <div>
          <h3 className="mb-2 font-medium text-(--c-text)">{t("gifts_message_title", lang)}</h3>
          <ul className="space-y-2">
            {gifts.map((g) => (
              <li
                key={g.id}
                className="rounded-(--radius) border border-(--border) bg-(--c-surface) p-3 shadow-(--shadow)"
              >
                <p className="text-sm font-medium text-(--c-text)">
                  {g.name}
                  {g.item ? <span className="text-(--c-muted)"> · {g.item}</span> : null}
                </p>
                <p className="mt-1 text-sm text-(--c-muted)">{g.message}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {giftsError ? (
        <p role="alert" className="text-sm text-(--c-accent)">
          {giftsError}
        </p>
      ) : null}

      {/* Gift form */}
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-3 rounded-(--radius) border border-(--border) bg-(--c-surface) p-5 shadow-(--shadow)"
      >
        <div>
          <label
            htmlFor="wciw-gift-name"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("guest_name", lang)}
          </label>
          <input
            id="wciw-gift-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            aria-invalid={Boolean(formErrors.name)}
            aria-describedby={formErrors.name ? "wciw-gift-name-error" : undefined}
            className={inputCls}
          />
          {formErrors.name ? (
            <p id="wciw-gift-name-error" className="mt-1 text-sm text-(--c-accent)">
              {formErrors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="wciw-gift-item"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("gift_item", lang)}
          </label>
          <input
            id="wciw-gift-item"
            name="item"
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="wciw-gift-message"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("message_optional", lang)}
          </label>
          <textarea
            id="wciw-gift-message"
            name="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            aria-invalid={Boolean(formErrors.message)}
            aria-describedby={formErrors.message ? "wciw-gift-message-error" : undefined}
            className={inputCls}
          />
          {formErrors.message ? (
            <p id="wciw-gift-message-error" className="mt-1 text-sm text-(--c-accent)">
              {formErrors.message}
            </p>
          ) : null}
        </div>

        {formStatus === "success" ? (
          <p role="status" className="text-sm text-(--c-muted)">
            {t("gift_success", lang)}
          </p>
        ) : null}
        {formError ? (
          <p role="alert" className="text-sm text-(--c-accent)">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={formStatus === "sending"}
          className="w-full rounded-(--radius) bg-(--c-primary) px-4 py-2.5 font-medium text-white shadow-(--shadow) transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {formStatus === "sending" ? t("sending", lang) : t("submit", lang)}
        </button>
      </form>
    </div>
  );
}
