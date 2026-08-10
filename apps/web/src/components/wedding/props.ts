import type { ReactNode } from "react";
import type { CoupleConfig, GalleryItem, Language } from "@/lib/types";

/**
 * Shared wedding component prop contracts.
 *
 * These components live in src/components/wedding/ and are consumed by every
 * theme. They are headless-ish: they own logic + accessibility + neutral
 * markup, and read the theme's CSS custom properties (--c-primary, --c-surface,
 * --c-text, --radius, …) so each theme controls their look. They use `t()` from
 * @/lib/i18n for copy. Do not add per-theme styling here.
 *
 * Default exports (file → component):
 *   section.tsx → Section          countdown.tsx → Countdown
 *   rsvp-form.tsx → RsvpForm       wishes-board.tsx → WishesBoard
 *   gifts-board.tsx → GiftsBoard   gallery-lightbox.tsx → GalleryLightbox
 *   opening-screen.tsx → OpeningScreen   music-toggle.tsx → MusicToggle
 *   share-sheet.tsx → ShareSheet   confetti.tsx → Confetti
 */

export interface SectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}

export interface CountdownProps {
  /** ISO datetime of the wedding (couple.wedding.date). */
  target: string;
  lang: Language;
  className?: string;
}

export interface RsvpFormProps {
  couple: CoupleConfig;
  className?: string;
}

export interface WishesBoardProps {
  coupleSlug: string;
  lang: Language;
  limit?: number;
  className?: string;
}

export interface GiftsBoardProps {
  couple: CoupleConfig;
  className?: string;
}

export interface GalleryLightboxProps {
  images: GalleryItem[];
  lang: Language;
  className?: string;
}

export interface OpeningScreenProps {
  couple: CoupleConfig;
  /** Fired when the guest taps "Open Invitation" (themes hook confetti etc. here). */
  onOpen?: () => void;
  children: ReactNode;
}

export interface MusicToggleProps {
  src: string;
  lang: Language;
}

export interface ShareSheetProps {
  couple: CoupleConfig;
}

export interface ConfettiProps {
  /** When true, plays a burst; when false, stops. */
  active?: boolean;
}
