/**
 * Shared wedding components — one convenience import for all themes.
 * Default-export mapping matches src/components/wedding/props.ts.
 */
export { default as Section } from "./section";
export { default as Countdown } from "./countdown";
export { default as RsvpForm } from "./rsvp-form";
export { default as WishesBoard } from "./wishes-board";
export { default as GiftsBoard } from "./gifts-board";
export { default as GalleryLightbox } from "./gallery-lightbox";
export { default as OpeningScreen } from "./opening-screen";
export { default as MusicToggle } from "./music-toggle";
export { default as ShareSheet } from "./share-sheet";
export { default as Confetti } from "./confetti";

export type {
  SectionProps,
  CountdownProps,
  RsvpFormProps,
  WishesBoardProps,
  GiftsBoardProps,
  GalleryLightboxProps,
  OpeningScreenProps,
  MusicToggleProps,
  ShareSheetProps,
  ConfettiProps,
} from "./props";
