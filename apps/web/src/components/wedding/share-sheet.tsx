"use client";

import { useEffect, useRef, useState } from "react";
import { coupleUrl } from "@/lib/api";
import { coupleShareText } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ShareSheetProps } from "./props";

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

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** ShareSheet — floating share button + share modal (copy / WhatsApp / Telegram). */
export default function ShareSheet({ couple }: ShareSheetProps) {
  const lang = couple.language;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  const url = coupleUrl(couple.slug);
  const text = coupleShareText(
    { bride: couple.couple.bride.name, groom: couple.couple.groom.name },
    couple.wedding.hashtag
  );
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

  function openSheet() {
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }

  function closeSheet() {
    setOpen(false);
    lastFocusedRef.current?.focus?.();
  }

  // Esc to close + focus the close button when the sheet opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Clear pending "copied" reset if the sheet unmounts mid-timer.
  useEffect(
    () => () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    },
    []
  );

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        await legacyCopy(url);
      }
    } catch {
      try {
        await legacyCopy(url);
      } catch {
        return; // clipboard unavailable — do nothing
      }
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={t("share", lang)}
        aria-haspopup="dialog"
        className="fixed bottom-6 left-6 z-[60] flex h-12 w-12 items-center justify-center rounded-full border border-(--border) bg-(--c-surface) text-(--c-primary) shadow-(--shadow) transition hover:opacity-90"
      >
        <ShareIcon />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
          onClick={closeSheet}
        >
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("share_title", lang)}
            className="relative w-full max-w-sm rounded-(--radius) border border-(--border) bg-(--c-surface) p-6 shadow-(--shadow)"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={closeSheet}
              aria-label={lang === "ms" ? "Tutup" : "Close"}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-(--c-muted) transition hover:text-(--c-text)"
            >
              <XIcon />
            </button>

            <h2 className="text-xl font-semibold text-(--c-text) [font-family:var(--font-display)]">
              {t("share_title", lang)}
            </h2>
            <p className="mt-1 text-sm text-(--c-muted)">{t("share_subtitle", lang)}</p>

            <div className="mt-4 flex items-center gap-2 rounded-(--radius) border border-(--border) bg-(--c-bg) p-2">
              <code className="min-w-0 flex-1 truncate px-1 text-sm text-(--c-text)">{url}</code>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="shrink-0 rounded-(--radius) bg-(--c-primary) px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                {copied ? t("copied", lang) : t("copy_link", lang)}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-(--radius) border border-(--border) bg-(--c-bg) px-3 py-2 text-sm font-medium text-(--c-text) transition hover:opacity-90"
              >
                <WhatsAppIcon />
                {t("share_whatsapp", lang)}
              </a>
              <a
                href={tgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-(--radius) border border-(--border) bg-(--c-bg) px-3 py-2 text-sm font-medium text-(--c-text) transition hover:opacity-90"
              >
                <TelegramIcon />
                {t("share_telegram", lang)}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
