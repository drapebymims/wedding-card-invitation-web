import type { CoupleConfig, ThemeId } from "./types";

/**
 * Starter / blank CoupleConfig — the "blank draft" a buyer (or the studio
 * wizard) starts from. Mirrors the shape of config/couples/_template.json but
 * with empty content so the studio can fill it in. Pure data module (no UI).
 */

export function blankCoupleConfig(themeId: ThemeId = "refined"): CoupleConfig {
  return {
    slug: "draft",
    theme: themeId,
    language: "ms",
    couple: {
      bride: {
        name: "",
        fullName: "",
        role: "Pengantin Perempuan",
      },
      groom: {
        name: "",
        fullName: "",
        role: "Pengantin Lelaki",
      },
    },
    wedding: {
      date: "2027-08-14T09:00:00+08:00",
      tagline: "",
    },
    story: [],
    events: [],
    gallery: [],
    gifts: {
      accounts: [],
      message: "",
    },
    rsvp: {
      enabled: true,
      allowMessage: true,
    },
    settings: {
      confetti: true,
      music: true,
      countdown: true,
      openAnimation: true,
      gallery: true,
    },
  };
}
