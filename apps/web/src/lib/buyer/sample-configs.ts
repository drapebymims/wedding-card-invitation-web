import type { CoupleConfig, ThemeId } from "@/lib/types";

/**
 * Rich sample CoupleConfigs for the 3 themes — used by the catalog live
 * previews and as the seed for the studio wizard.
 *
 * The fixer lane also ships a `starter-config.ts`; this file is our own source
 * of sample data so the buyer flow is not blocked on that parallel work. When
 * the fixer starter lands we can prefer it, but these are kept up to date with
 * the CoupleConfig schema.
 */

const base = (theme: ThemeId): CoupleConfig => ({
  slug: `demo-${theme}`,
  theme,
  language: "ms",
  couple: {
    bride: {
      name: "Aina",
      fullName: "Aina Sofea",
      role: "Pengantin Perempuan",
      parents: "Putri daripada Encik & Puan Ismail",
      instagram: "aina.sofea",
      photo: "https://picsum.photos/seed/aina-bride/600/750",
    },
    groom: {
      name: "Danish",
      fullName: "Danish Hariz",
      role: "Pengantin Lelaki",
      parents: "Putra daripada Tuan Haji Hariz & Puan Siti",
      instagram: "danish.hariz",
      photo: "https://picsum.photos/seed/danish-groom/600/750",
    },
  },
  wedding: {
    date: "2027-09-18T10:00:00+08:00",
    tagline:
      "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan untukmu pasangan hidup agar kamu merasa tenteram, dan dijadikan-Nya di antaramu rasa kasih dan sayang.",
    hashtag: "#AinaDanishSelamanya",
    music: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    quote: {
      ms: "Sesungguhnya bersama kesulitan itu ada kemudahan.",
      en: "Indeed, with hardship comes ease.",
      source: "QS. Al-Insyirah: 6",
    },
  },
  story: [
    {
      title: "Pertemuan Pertama",
      date: "2020",
      description:
        "Kami bertemu di majlis keluarga saudara sepupu. Danish memulakan perbualan dengan bertanya tentang buku yang Aina sedang baca.",
    },
    {
      title: "Kami Mula Berkenalan",
      date: "2022",
      description:
        "Selepas dua tahun berkawan baik, kami memutuskan untuk melangkah lebih serius dan melibatkan keluarga masing-masing.",
    },
    {
      title: "Lamaran",
      date: "2026",
      description:
        "Dengan berkat dan restu kedua keluarga, Danish melamar Aina. Semuanya berjalan lancar dan penuh kehangatan.",
    },
    {
      title: "Hari Bahagia",
      date: "2027",
      description:
        "Dengan lafaz penuh takzim kami akan disatukan. Semoga menjadi keluarga yang sakinah, mawaddah, warahmah.",
    },
  ],
  events: [
    {
      name: "Majlis Akad Nikah",
      type: "ceremony",
      date: "2027-09-18T10:00:00+08:00",
      endDate: "2027-09-18T12:00:00+08:00",
      venue: "Masjid Al-Falah",
      address: "Jalan Ampang, 50450 Kuala Lumpur",
      mapsUrl: "https://maps.google.com/?q=Masjid+Al-Falah+Kuala+Lumpur",
      dressCode: "Warna lembut / pastel",
    },
    {
      name: "Majlis Resepsi",
      type: "reception",
      date: "2027-09-18T13:00:00+08:00",
      endDate: "2027-09-18T17:00:00+08:00",
      venue: "Dewan Seri Budaya",
      address: "Jalan Ampang, 50450 Kuala Lumpur",
      mapsUrl: "https://maps.google.com/?q=Dewan+Seri+Budaya+Kuala+Lumpur",
      dressCode: "Koktel / semi-formal",
      note: "Hidangan tengah hari akan disediakan.",
    },
  ],
  gallery: [
    { src: "https://picsum.photos/seed/aina-1/900/1200", alt: "Pre-wedding shot 1" },
    { src: "https://picsum.photos/seed/aina-2/900/1200", alt: "Pre-wedding shot 2" },
    { src: "https://picsum.photos/seed/aina-3/900/1200", alt: "Pre-wedding shot 3" },
    { src: "https://picsum.photos/seed/aina-4/900/1200", alt: "Pre-wedding shot 4" },
    { src: "https://picsum.photos/seed/aina-5/900/1200", alt: "Pre-wedding shot 5" },
    { src: "https://picsum.photos/seed/aina-6/900/1200", alt: "Pre-wedding shot 6" },
  ],
  gifts: {
    accounts: [
      { bank: "Maybank", accountNumber: "5140 1234 5678", holder: "Aina Sofea" },
      { bank: "CIMB", accountNumber: "8601 2345 6789", holder: "Danish Hariz" },
    ],
    message: "Doa dan restu anda adalah hadiah yang paling berharga bagi kami.",
  },
  rsvp: {
    enabled: true,
    deadline: "2027-09-01T23:59:00+08:00",
    whatsapp: "60123456789",
    allowMessage: true,
  },
  settings: {
    confetti: true,
    music: true,
    countdown: true,
    openAnimation: true,
    gallery: true,
  },
});

export const SAMPLE_CONFIGS: Record<ThemeId, CoupleConfig> = {
  refined: base("refined"),
  minimal: base("minimal"),
  vibrant: base("vibrant"),
};

export const THEME_ORDER: ThemeId[] = ["refined", "minimal", "vibrant"];

/** A fresh, mostly-empty config used to seed a brand-new card in the studio. */
export function blankConfig(theme: ThemeId): CoupleConfig {
  return {
    slug: "",
    theme,
    language: "ms",
    couple: {
      bride: { name: "", fullName: "", role: "Pengantin Perempuan" },
      groom: { name: "", fullName: "", role: "Pengantin Lelaki" },
    },
    wedding: {
      date: "",
      tagline: "",
      hashtag: "",
    },
    story: [],
    events: [],
    gallery: [],
    gifts: { accounts: [], message: "" },
    rsvp: { enabled: true, allowMessage: true },
    settings: { confetti: true, music: false, countdown: true, openAnimation: true, gallery: true },
  };
}
