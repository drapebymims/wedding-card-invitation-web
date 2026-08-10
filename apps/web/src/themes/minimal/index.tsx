"use client";

import { useState, type ReactNode } from "react";
import { Inter } from "next/font/google";
import {
  OpeningScreen,
  Confetti,
  MusicToggle,
  ShareSheet,
  Countdown,
  RsvpForm,
  WishesBoard,
  GiftsBoard,
  GalleryLightbox,
} from "@/components/wedding";
import { formatDate, formatDateTime, downloadIcs } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { CoupleConfig } from "@/lib/types";
import "./minimal.css";

/**
 * Minimal — stripped-back, whitespace-forward editorial wedding theme.
 *
 * Faithful to skills/design-system/minimal: off-white canvas, hairline rules,
 * an asymmetric editorial grid, large section index numbers, and one restrained
 * indigo accent per section. The beauty comes from spacing and type, not
 * ornament. All shared components read the tokens set in minimal.css.
 */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const pad2 = (n: number): string => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ */
/* Local editorial primitives                                          */
/* ------------------------------------------------------------------ */

function Section({
  id,
  children,
  tone = "bg",
  className = "",
}: {
  id: string;
  children: ReactNode;
  tone?: "bg" | "surface";
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`border-t border-(--border) ${
        tone === "surface" ? "bg-(--c-surface)" : ""
      } ${className}`.trim()}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">{children}</div>
    </section>
  );
}

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="m-display text-3xl font-semibold tabular-nums text-(--c-primary) sm:text-4xl">
        {index}
      </span>
      <h2 className="m-label text-(--c-accent)">{label}</h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Theme                                                               */
/* ------------------------------------------------------------------ */

export default function MinimalTheme({ couple }: { couple: CoupleConfig }) {
  const lang = couple.language;
  const settings = couple.settings ?? {};
  const { bride, groom } = couple.couple;
  const [opened, setOpened] = useState(false);

  const quote = couple.wedding.quote?.[lang] ?? couple.wedding.quote?.en;
  const quoteSource = couple.wedding.quote?.source;
  const mainEvent = couple.events[0];
  const portraitCount = [bride.photo, groom.photo].filter(Boolean).length;

  return (
    <div className={`theme-minimal ${inter.variable}`}>
      <OpeningScreen couple={couple} onOpen={() => setOpened(true)}>
        <main>
          {/* 01 · HERO — full-bleed, big, editorial */}
          <header id="hero" className="border-t border-(--border)">
            <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
              <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
                <div className="lg:col-span-7">
                  <p className="m-label flex items-center gap-3 text-(--c-muted)">
                    <span className="tabular-nums">01</span>
                    <span aria-hidden="true" className="h-px w-10 bg-(--c-accent)" />
                    {t("invitation", lang)}
                  </p>

                  <h1 className="m-display mt-8 text-[clamp(2.5rem,8.5vw,5.75rem)] leading-[0.92] font-bold text-(--c-primary)">
                    <span className="block">{bride.fullName}</span>
                    <span
                      aria-hidden="true"
                      className="block font-light italic text-(--c-muted)"
                    >
                      &amp;
                    </span>
                    <span className="block">{groom.fullName}</span>
                  </h1>

                  <p className="m-label mt-10 text-(--c-muted)">{t("save_the_date", lang)}</p>
                  <p className="m-display mt-2 text-3xl font-semibold text-(--c-primary) sm:text-5xl">
                    <time dateTime={couple.wedding.date}>
                      {formatDate(couple.wedding.date, lang)}
                    </time>
                  </p>

                  {mainEvent ? (
                    <p className="mt-8 max-w-md leading-relaxed text-(--c-text)">
                      {mainEvent.venue}
                      {mainEvent.address ? (
                        <span className="mt-0.5 block text-(--c-muted)">
                          {mainEvent.address}
                        </span>
                      ) : null}
                    </p>
                  ) : null}

                  {couple.wedding.tagline ? (
                    <p className="mt-3 max-w-md leading-relaxed text-(--c-muted)">
                      {couple.wedding.tagline}
                    </p>
                  ) : null}

                  {settings.countdown !== false ? (
                    <div className="mt-10">
                      <Countdown target={couple.wedding.date} lang={lang} />
                    </div>
                  ) : null}
                </div>

                {portraitCount > 0 ? (
                  <div className="lg:col-span-5">
                    <div
                      className={`grid gap-4 sm:gap-6 ${
                        portraitCount > 1 ? "grid-cols-2" : "max-w-xs grid-cols-1"
                      }`}
                    >
                      {bride.photo ? (
                        <figure>
                          <div className="border border-(--border) bg-(--c-surface)">
                            <img
                              src={bride.photo}
                              alt={bride.fullName}
                              loading="lazy"
                              decoding="async"
                              className="aspect-[3/4] w-full object-cover"
                            />
                          </div>
                          <figcaption className="mt-3 flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium text-(--c-primary)">
                              {bride.name}
                            </span>
                            <span className="m-label text-(--c-muted)">{bride.role}</span>
                          </figcaption>
                        </figure>
                      ) : null}
                      {groom.photo ? (
                        <figure className={portraitCount > 1 ? "mt-10 sm:mt-14" : ""}>
                          <div className="border border-(--border) bg-(--c-surface)">
                            <img
                              src={groom.photo}
                              alt={groom.fullName}
                              loading="lazy"
                              decoding="async"
                              className="aspect-[3/4] w-full object-cover"
                            />
                          </div>
                          <figcaption className="mt-3 flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium text-(--c-primary)">
                              {groom.name}
                            </span>
                            <span className="m-label text-(--c-muted)">{groom.role}</span>
                          </figcaption>
                        </figure>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {/* 02 · QUOTE — a single centered, restrained line */}
          {quote ? (
            <Section id="quote" tone="surface" className="text-center">
              <p className="m-label text-(--c-muted)">02</p>
              <blockquote className="m-display mx-auto mt-8 max-w-3xl text-2xl font-medium leading-snug text-(--c-primary) sm:text-4xl">
                “{quote}”
              </blockquote>
              {quoteSource ? (
                <p className="m-label mt-8 text-(--c-accent)">— {quoteSource}</p>
              ) : null}
            </Section>
          ) : null}

          {/* 03 · STORY — numbered timeline with hairline rules */}
          {couple.story.length > 0 ? (
            <Section id="story">
              <SectionHeader index="03" label={t("our_story", lang)} />
              <ol className="mt-12">
                {couple.story.map((entry, i) => (
                  <li
                    key={`${entry.title}-${i}`}
                    className="grid gap-3 border-t border-(--border) py-8 first:border-t-0 sm:grid-cols-12 sm:gap-x-8"
                  >
                    <div className="sm:col-span-3">
                      <span className="m-display block text-3xl font-semibold tabular-nums text-(--c-primary)">
                        {pad2(i + 1)}
                      </span>
                      {entry.date ? (
                        <p className="m-label mt-3 text-(--c-muted)">{entry.date}</p>
                      ) : null}
                    </div>
                    <div className="sm:col-span-9">
                      <h3 className="m-display text-2xl font-semibold text-(--c-primary) sm:text-3xl">
                        {entry.title}
                      </h3>
                      <p className="mt-3 max-w-2xl leading-relaxed text-(--c-muted)">
                        {entry.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {/* 04 · EVENTS — bordered rows */}
          {couple.events.length > 0 ? (
            <Section id="events">
              <SectionHeader index="04" label={t("events", lang)} />
              <ul className="mt-12">
                {couple.events.map((ev, i) => (
                  <li
                    key={`${ev.name}-${i}`}
                    className="grid gap-6 border-t border-(--border) py-10 first:border-t-0 sm:grid-cols-12 sm:gap-x-8"
                  >
                    <div className="sm:col-span-6">
                      <p className="m-label text-(--c-accent)">{t(ev.type, lang)}</p>
                      <h3 className="m-display mt-2 text-2xl font-semibold text-(--c-primary) sm:text-3xl">
                        {ev.name}
                      </h3>
                      <p className="m-display mt-4 text-xl font-medium tabular-nums text-(--c-primary) sm:text-2xl">
                        <time dateTime={ev.date}>{formatDateTime(ev.date, lang)}</time>
                      </p>
                    </div>
                    <dl className="space-y-4 text-sm sm:col-span-6">
                      <div className="grid grid-cols-[7rem_1fr] gap-x-4">
                        <dt className="m-label pt-0.5 text-(--c-muted)">
                          {t("location", lang)}
                        </dt>
                        <dd className="leading-relaxed text-(--c-text)">
                          {ev.venue}
                          {ev.address ? (
                            <span className="mt-0.5 block text-(--c-muted)">{ev.address}</span>
                          ) : null}
                        </dd>
                      </div>
                      {ev.dressCode ? (
                        <div className="grid grid-cols-[7rem_1fr] gap-x-4">
                          <dt className="m-label pt-0.5 text-(--c-muted)">
                            {t("dress_code", lang)}
                          </dt>
                          <dd className="leading-relaxed text-(--c-text)">{ev.dressCode}</dd>
                        </div>
                      ) : null}
                      {ev.note ? (
                        <p className="leading-relaxed text-(--c-muted)">{ev.note}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-3 pt-2">
                        {ev.mapsUrl ? (
                          <a
                            href={ev.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="m-btn"
                          >
                            {t("open_maps", lang)}
                          </a>
                        ) : null}
                        <button type="button" onClick={() => downloadIcs(ev)} className="m-btn">
                          {t("add_to_calendar", lang)}
                        </button>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {/* 05 · GALLERY */}
          {settings.gallery !== false && couple.gallery.length > 0 ? (
            <Section id="gallery">
              <SectionHeader index="05" label={t("gallery", lang)} />
              <div className="mt-12">
                <GalleryLightbox images={couple.gallery} lang={lang} />
              </div>
            </Section>
          ) : null}

          {/* 06 · RSVP */}
          {couple.rsvp.enabled ? (
            <Section id="rsvp" tone="surface">
              <SectionHeader index="06" label={t("rsvp_title", lang)} />
              <p className="mt-4 max-w-xl leading-relaxed text-(--c-muted)">
                {t("rsvp_subtitle", lang)}
              </p>
              <div className="mt-10 max-w-xl">
                <RsvpForm couple={couple} />
              </div>
            </Section>
          ) : null}

          {/* 07 · WISHES */}
          <Section id="wishes">
            <SectionHeader index="07" label={t("wishes_title", lang)} />
            <p className="mt-4 max-w-xl leading-relaxed text-(--c-muted)">
              {t("wishes_subtitle", lang)}
            </p>
            <div className="mt-10 max-w-2xl">
              <WishesBoard coupleSlug={couple.slug} lang={lang} />
            </div>
          </Section>

          {/* 08 · GIFTS */}
          <Section id="gifts" tone="surface">
            <SectionHeader index="08" label={t("gifts_title", lang)} />
            <p className="mt-4 max-w-xl leading-relaxed text-(--c-muted)">
              {t("gifts_subtitle", lang)}
            </p>
            <div className="mt-10 max-w-2xl">
              <GiftsBoard couple={couple} />
            </div>
          </Section>

          {/* FOOTER */}
          <footer id="footer" className="border-t border-(--border)">
            <div className="mx-auto w-full max-w-6xl px-5 py-16 text-center sm:px-8 sm:py-24">
              {couple.wedding.hashtag ? (
                <p className="m-display text-2xl font-semibold text-(--c-accent) sm:text-3xl">
                  {couple.wedding.hashtag}
                </p>
              ) : null}
              <p className="m-display mt-6 text-3xl font-bold text-(--c-primary) sm:text-5xl">
                {bride.name}{" "}
                <span aria-hidden="true" className="font-light text-(--c-muted)">
                  &amp;
                </span>{" "}
                {groom.name}
              </p>
              <p className="m-label mt-8 text-(--c-muted)">{t("best_regards", lang)}</p>
              <p className="mt-3 text-sm leading-relaxed text-(--c-muted)">
                {t("closing_verse", lang)}
              </p>
            </div>
          </footer>
        </main>
      </OpeningScreen>

      {settings.confetti !== false ? <Confetti active={opened} /> : null}
      {couple.wedding.music ? <MusicToggle src={couple.wedding.music} lang={lang} /> : null}
      <ShareSheet couple={couple} />
    </div>
  );
}
