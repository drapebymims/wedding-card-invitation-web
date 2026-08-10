"use client";

import { useState } from "react";
import { Playfair_Display, Inter } from "next/font/google";
import type { CoupleConfig } from "@/lib/types";
import { t } from "@/lib/i18n";
import { formatDate, formatDateTime, downloadIcs } from "@/lib/format";
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
import "./refined.css";

const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500"],
});

const TYPE_LABEL: Record<string, "ceremony" | "reception" | "party" | "other"> = {
  ceremony: "ceremony",
  reception: "reception",
  party: "party",
  other: "other",
};

export default function RefinedTheme({ couple }: { couple: CoupleConfig }) {
  const [opened, setOpened] = useState(false);
  const lang = couple.language;
  const s = couple.settings ?? {};
  const { bride, groom } = couple.couple;

  return (
    <div className={`theme-refined ${display.variable} ${body.variable}`}>
      <OpeningScreen couple={couple} onOpen={() => setOpened(true)}>
        <header className="r-hero">
          <div className="r-hero__inner">
            <p className="r-eyebrow">{t("invitation", lang)}</p>
            <h1 className="r-names">
              <span className="r-name">{bride.fullName}</span>
              <span className="r-amp" aria-hidden="true">
                &
              </span>
              <span className="r-name">{groom.fullName}</span>
            </h1>
            <p className="r-date">{formatDate(couple.wedding.date, lang)}</p>
            {couple.events[0] ? (
              <p className="r-venue">
                {couple.events[0].venue}
                {couple.events[0].address ? ` — ${couple.events[0].address}` : ""}
              </p>
            ) : null}
            <p className="r-tagline">{couple.wedding.tagline}</p>
            <div className="r-portraits">
              {bride.photo ? (
                <figure className="r-portrait">
                  <img src={bride.photo} alt={bride.fullName} loading="lazy" />
                  <figcaption>{bride.name}</figcaption>
                </figure>
              ) : null}
              {groom.photo ? (
                <figure className="r-portrait">
                  <img src={groom.photo} alt={groom.fullName} loading="lazy" />
                  <figcaption>{groom.name}</figcaption>
                </figure>
              ) : null}
            </div>
          </div>
          {s.countdown !== false && couple.wedding.date ? (
            <div className="r-countdown-wrap">
              <Countdown target={couple.wedding.date} lang={lang} />
            </div>
          ) : null}
        </header>

        {couple.wedding.quote ? (
          <section className="r-section r-quote" aria-label={t("invitation", lang)}>
            <div className="r-section__inner r-quote__inner">
              <p className="r-quote__text">
                {couple.wedding.quote[lang] ?? couple.wedding.quote.en ?? couple.wedding.quote.ms}
              </p>
              {couple.wedding.quote.source ? (
                <p className="r-quote__source">— {couple.wedding.quote.source}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {couple.story.length > 0 ? (
          <section className="r-section" id="story">
            <div className="r-section__inner">
              <h2 className="r-section-title">{t("our_story", lang)}</h2>
              <ol className="r-timeline">
                {couple.story.map((entry, i) => (
                  <li key={i} className="r-timeline__item">
                    <span className="r-timeline__dot" aria-hidden="true" />
                    <div className="r-timeline__body">
                      <h3 className="r-timeline__title">{entry.title}</h3>
                      {entry.date ? <p className="r-timeline__date">{entry.date}</p> : null}
                      <p className="r-timeline__desc">{entry.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        {couple.events.length > 0 ? (
          <section className="r-section" id="events">
            <div className="r-section__inner">
              <h2 className="r-section-title">{t("events", lang)}</h2>
              <div className="r-events">
                {couple.events.map((event, i) => (
                  <article key={i} className="r-event">
                    <p className="r-event__type">
                      {t(TYPE_LABEL[event.type] ?? "other", lang)}
                    </p>
                    <h3 className="r-event__name">{event.name}</h3>
                    <time className="r-event__time" dateTime={event.date}>
                      {formatDateTime(event.date, lang)}
                    </time>
                    <p className="r-event__venue">{event.venue}</p>
                    <p className="r-event__address">{event.address}</p>
                    {event.dressCode ? (
                      <p className="r-event__dress">
                        {t("dress_code", lang)}: {event.dressCode}
                      </p>
                    ) : null}
                    {event.note ? <p className="r-event__note">{event.note}</p> : null}
                    <div className="r-event__actions">
                      {event.mapsUrl ? (
                        <a className="r-btn" href={event.mapsUrl} target="_blank" rel="noreferrer">
                          {t("open_maps", lang)}
                        </a>
                      ) : null}
                      <button type="button" className="r-btn r-btn--ghost" onClick={() => downloadIcs(event)}>
                        {t("add_to_calendar", lang)}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {s.gallery !== false && couple.gallery.length > 0 ? (
          <section className="r-section" id="gallery">
            <div className="r-section__inner">
              <h2 className="r-section-title">{t("gallery", lang)}</h2>
              <GalleryLightbox images={couple.gallery} lang={lang} />
            </div>
          </section>
        ) : null}

        {couple.rsvp.enabled ? (
          <section className="r-section" id="rsvp">
            <div className="r-section__inner">
              <h2 className="r-section-title">{t("rsvp_title", lang)}</h2>
              <p className="r-section-subtitle">{t("rsvp_subtitle", lang)}</p>
              <RsvpForm couple={couple} />
            </div>
          </section>
        ) : null}

        <section className="r-section" id="wishes">
          <div className="r-section__inner">
            <h2 className="r-section-title">{t("wishes_title", lang)}</h2>
            <WishesBoard coupleSlug={couple.slug} lang={lang} />
          </div>
        </section>

        <section className="r-section" id="gifts">
          <div className="r-section__inner">
            <h2 className="r-section-title">{t("gifts_title", lang)}</h2>
            <GiftsBoard couple={couple} />
          </div>
        </section>

        <footer className="r-footer">
          <div className="r-footer__inner">
            {couple.wedding.hashtag ? (
              <p className="r-footer__hashtag">{couple.wedding.hashtag}</p>
            ) : null}
            <p className="r-footer__names">
              {bride.fullName} &amp; {groom.fullName}
            </p>
            <p className="r-footer__closing">{t("closing_verse", lang)}</p>
          </div>
        </footer>
      </OpeningScreen>

      {s.confetti !== false && <Confetti active={opened} />}
      {couple.wedding.music ? (
        <MusicToggle src={couple.wedding.music} lang={lang} />
      ) : null}
      <ShareSheet couple={couple} />
    </div>
  );
}
