"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { GalleryLightboxProps } from "./props";

const SWIPE_THRESHOLD = 48;

function CloseIcon() {
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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      {direction === "left" ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

/** GalleryLightbox — responsive photo grid that opens an accessible lightbox. */
export default function GalleryLightbox({ images, lang, className = "" }: GalleryLightboxProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const total = images.length;
  const current = openIndex !== null ? images[openIndex] : null;

  const close = useCallback(() => {
    setOpenIndex(null);
    lastFocusedRef.current?.focus?.();
  }, []);

  const prev = useCallback(() => {
    if (total === 0) return;
    setOpenIndex((i) => (i === null ? null : (i - 1 + total) % total));
  }, [total]);

  const next = useCallback(() => {
    if (total === 0) return;
    setOpenIndex((i) => (i === null ? null : (i + 1) % total));
  }, [total]);

  const openAt = useCallback(
    (i: number) => {
      lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpenIndex(i);
    },
    []
  );

  // Keyboard support + body scroll lock while the lightbox is open.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        prev();
      } else if (e.key === "ArrowRight") {
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, close, prev, next]);

  if (total === 0) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <button
            key={`${img.src}-${i}`}
            type="button"
            onClick={() => openAt(i)}
            aria-label={`${img.alt} (${i + 1}/${total})`}
            className="group relative aspect-[3/4] overflow-hidden rounded-(--radius) border border-(--border) bg-(--c-surface) shadow-(--shadow)"
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openIndex !== null && current ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("gallery", lang)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.72)" }}
          onClick={close}
        >
          <div
            className="relative flex w-full max-w-3xl flex-col items-center"
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) > SWIPE_THRESHOLD) {
                if (dx > 0) prev();
                else next();
              }
            }}
          >
            <img
              src={current.src}
              alt={current.alt}
              className="max-h-[78vh] w-auto rounded-(--radius) object-contain shadow-(--shadow)"
            />

            <p className="mt-3 text-sm text-white/90">
              {current.alt} <span className="text-white/60">({openIndex + 1}/{total})</span>
            </p>

            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label={lang === "ms" ? "Tutup" : "Close"}
              className="absolute -top-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border border-(--border) bg-(--c-surface) text-(--c-text) shadow-(--shadow) transition hover:opacity-90 sm:-right-4"
            >
              <CloseIcon />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              aria-label={lang === "ms" ? "Gambar sebelumnya" : "Previous image"}
              className="absolute top-1/2 -left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-(--border) bg-(--c-surface) text-(--c-text) shadow-(--shadow) transition hover:opacity-90 sm:-left-4"
            >
              <ChevronIcon direction="left" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              aria-label={lang === "ms" ? "Gambar seterusnya" : "Next image"}
              className="absolute top-1/2 -right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-(--border) bg-(--c-surface) text-(--c-text) shadow-(--shadow) transition hover:opacity-90 sm:-right-4"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
