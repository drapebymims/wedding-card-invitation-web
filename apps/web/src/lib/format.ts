import type { Language, WeddingEvent } from "./types";

const MONTHS_MS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];
const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_MS = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatDate(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = lang === "ms" ? MONTHS_MS : MONTHS_EN;
  const days = lang === "ms" ? DAYS_MS : DAYS_EN;
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(iso: string, lang: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateTime(iso: string, lang: Language): string {
  return `${formatDate(iso, lang)} • ${formatTime(iso, lang)}`;
}

/** RFC 5545 .ics payload for one event — used by the add-to-calendar button. */
export function buildIcs(event: WeddingEvent): string {
  const uid = `wedding-${event.type}-${new Date(event.date).getTime()}`;
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WeddingCardInvitationWeb//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${fmt(event.date)}`,
    ...(event.endDate ? [`DTEND:${fmt(event.endDate)}`] : []),
    `SUMMARY:${event.name}`,
    `LOCATION:${event.venue}, ${event.address}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/** Trigger a browser download of an .ics file. */
export function downloadIcs(event: WeddingEvent): void {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.name.replace(/\s+/g, "-").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function coupleShareText(names: { bride: string; groom: string }, hashtag?: string): string {
  const base = `${names.bride} & ${names.groom}`;
  return hashtag ? `${base} ${hashtag}` : base;
}
