/**
 * Couple configuration schema — the single source of truth for a wedding site.
 * Each file under config/couples/<slug>.json must conform to CoupleConfig.
 * UI strings are resolved through i18n.ts using `language`; couple-authored
 * content (story, tagline, quote, addresses…) is authored in that language.
 */

export type Language = "ms" | "en";
export type ThemeId = "refined" | "minimal" | "vibrant";

export interface Person {
  /** Short display name, e.g. "Ana" */
  name: string;
  /** Full name shown in the hero, e.g. "Ana Lestari" */
  fullName: string;
  /** Label shown above the name, e.g. "The Bride" / "Pengantin Perempuan" */
  role: string;
  /** Parental / family line, e.g. "Daughter of Mr. & Mrs. Ibrahim" */
  parents?: string;
  /** Instagram handle without "@" */
  instagram?: string;
  /** Portrait photo path or URL */
  photo?: string;
}

export interface StoryEntry {
  /** Short heading, e.g. "How we met" / "Pertemuan pertama" */
  title: string;
  /** Display date, e.g. "2019" or "14 February 2021" */
  date?: string;
  description: string;
  image?: string;
}

export interface WeddingEvent {
  name: string;
  type: "ceremony" | "reception" | "party" | "other";
  /** ISO 8601 datetime, e.g. "2027-08-14T09:00:00+08:00" */
  date: string;
  endDate?: string;
  venue: string;
  address: string;
  /** Google Maps / Waze link */
  mapsUrl?: string;
  dressCode?: string;
  note?: string;
}

export interface GalleryItem {
  src: string;
  alt: string;
}

export interface GiftAccount {
  bank: string;
  accountNumber: string;
  holder: string;
}

export interface RsvpSettings {
  enabled: boolean;
  /** ISO date; the form is disabled after this */
  deadline?: string;
  /** Optional phone number to also forward the RSVP to via WhatsApp */
  whatsapp?: string;
  allowMessage: boolean;
}

export interface ThemeSettings {
  confetti: boolean;
  music: boolean;
  countdown: boolean;
  openAnimation: boolean;
  gallery: boolean;
}

export interface Seo {
  title?: string;
  description?: string;
  ogImage?: string;
}

export interface CoupleConfig {
  slug: string;
  theme: ThemeId;
  language: Language;
  couple: {
    bride: Person;
    groom: Person;
  };
  wedding: {
    /** ISO 8601 datetime of the main event (drives the countdown + add-to-calendar) */
    date: string;
    tagline: string;
    hashtag?: string;
    /** Audio path served from public/ (or remote URL) for the music toggle */
    music?: string;
    /** Optional verse / quote, keyed by language */
    quote?: { ms?: string; en?: string; source?: string };
  };
  story: StoryEntry[];
  events: WeddingEvent[];
  gallery: GalleryItem[];
  gifts: {
    accounts: GiftAccount[];
    message: string;
  };
  rsvp: RsvpSettings;
  seo?: Seo;
  settings?: Partial<ThemeSettings>;
}

export type CoupleSummary = Pick<CoupleConfig, "slug" | "theme" | "language"> & {
  names: { bride: string; groom: string };
};
