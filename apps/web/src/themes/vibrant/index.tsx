"use client";

import { useState } from "react";
import { Poppins, Nunito_Sans } from "next/font/google";
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
import "./vibrant.css";

const display = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["500", "600", "700", "800"],
});
const body = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito",
  weight: ["400", "600", "700"],
});

const TYPE_LABEL: Record<string, "ceremony" | "reception" | "party" | "other"> = {
  ceremony: "ceremony",
  reception: "reception",
  party: "party",
  other: "other",
};

export default function VibrantTheme({ couple }: { couple: CoupleConfig }) {
  const [opened, setOpened] = useState(false);
  const lang = couple.language;
  const s = couple.settings ?? {};
  const { bride, groom } = couple.couple;

  return (
    <div className={`theme-vibrant ${display.variable} ${body.variable}`}>
      <OpeningScreen couple={couple} onOpen={() => setOpened(true)}>
        <header className="v-hero">
          <div className="v-sun" aria-hidden="true" />
          <div className="v-hero__inner">
            <p className="v-eyebrow">{t("invitation", lang)}</p>
            <h1 className="v-names">
              <span className="v-name v-name--bride">{bride.fullName}</span>
              <span className="v-amp" aria-hidden="true">
                &amp;
              </span>
              <span className="v-name v-name--groom">{groom.fullName}</span>
            </h1>
            <div className="v-date-badge">
              {formatDate(couple.wedding.date, lang)}
            </div>
            {couple.events[0] ? <p className="v-venue">{couple.events[0].venue}</p> : null}
            <p className="v-tagline">{couple.wedding.tagline}</p>
            <div className="v-portraits">
              {bride.photo ? (
                <figure className="v-portrait v-portrait--bride">
                  <img src={bride.photo} alt={bride.fullName} loading="lazy" />
                  <figcaption>{bride.name}</figcaption>
                </figure>
              ) : null}
              {groom.photo ? (
                <figure className="v-portrait v-portrait--groom">
                  <img src={groom.photo} alt={groom.fullName} loading="lazy" />
                  <figcaption>{groom.name}</figcaption>
                </figure>
              ) : null}
            </div>
          </div>
          {s.countdown !== false && couple.wedding.date ? (
            <div className="v-countdown-wrap">
              <Countdown target={couple.wedding.date} lang={lang} />
            </div>
          ) : null}
        </header>

        {couple.wedding.quote ? (
          <section className="v-section v-section--quote" aria-label={t("invitation", lang)}>
            <div className="v-quote">
              <p className="v-quote__text">
                {couple.wedding.quote[lang] ?? couple.wedding.quote.en ?? couple.wedding.quote.ms}
              </p>
              {couple.wedding.quote.source ? (
                <p className="v-quote__source">— {couple.wedding.quote.source}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        {couple.story.length > 0 ? (
          <section className="v-section" id="story">
            <div className="v-section__inner">
              <h2 className="v-title">
                <span className="v-title__num">01</span>
                {t("our_story", lang)}
              </h2>
              <div className="v-timeline">
                {couple.story.map((entry, i) => (
                  <article className="v-card v-card--story" key={i}>
                    <h3 className="v-card__title">{entry.title}</h3>
                    {entry.date ? <p className="v-card__date">{entry.date}</p> : null}
                    <p className="v-card__desc">{entry.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {couple.events.length > 0 ? (
          <section className="v-section" id="events">
            <div className="v-section__inner">
              <h2 className="v-title">
                <span className="v-title__num">02</span>
                {t("events", lang)}
              </h2>
              <div className="v-events">
                {couple.events.map((event, i) => (
                  <article className="v-card v-card--event" key={i}>
                    <p className="v-card__type">
                      {t(TYPE_LABEL[event.type] ?? "other", lang)}
                    </p>
                    <h3 className="v-card__title">{event.name}</h3>
                    <time className="v-card__time" dateTime={event.date}>
                      {formatDateTime(event.date, lang)}
                    </time>
                    <p className="v-card__venue">{event.venue}</p>
                    <p className="v-card__address">{event.address}</p>
                    {event.dressCode ? (
                      <p className="v-card__dress">
                        {t("dress_code", lang)}: {event.dressCode}
                      </p>
                    ) : null}
                    {event.note ? <p className="v-card__note">{event.note}</p> : null}
                    <div className="v-card__actions">
                      {event.mapsUrl ? (
                        <a className="v-btn" href={event.mapsUrl} target="_blank" rel="noreferrer">
                          {t("open_maps", lang)}
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="v-btn v-btn--alt"
                        onClick={() => downloadIcs(event)}
                      >
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
          <section className="v-section" id="gallery">
            <div className="v-section__inner">
              <h2 className="v-title">
                <span className="v-title__num">03</span>
                {t("gallery", lang)}
              </h2>
              <GalleryLightbox images={couple.gallery} lang={lang} />
            </div>
          </section>
        ) : null}

        {couple.rsvp.enabled ? (
          <section className="v-section v-section--tint" id="rsvp">
            <div className="v-section__inner">
              <h2 className="v-title">
                <span className="v-title__num">04</span>
                {t("rsvp_title", lang)}
              </h2>
              <p className="v-subtitle">{t("rsvp_subtitle", lang)}</p>
              <RsvpForm couple={couple} />
            </div>
          </section>
        ) : null}

        <section className="v-section" id="wishes">
          <div className="v-section__inner">
            <h2 className="v-title">
              <span className="v-title__num">05</span>
              {t("wishes_title", lang)}
            </h2>
            <WishesBoard coupleSlug={couple.slug} lang={lang} />
          </div>
        </section>

        <section className="v-section v-section--tint" id="gifts">
          <div className="v-section__inner">
            <h2 className="v-title">
              <span className="v-title__num">06</span>
              {t("gifts_title", lang)}
            </h2>
            <GiftsBoard couple={couple} />
          </div>
        </section>

        <footer className="v-footer">
          {couple.wedding.hashtag ? (
            <p className="v-footer__hashtag">{couple.wedding.hashtag}</p>
          ) : null}
          <p className="v-footer__names">
            {bride.fullName} &amp; {groom.fullName}
          </p>
          <p className="v-footer__closing">{t("closing_verse", lang)}</p>
        </footer>
      </OpeningScreen>

      {s.confetti !== false && <Confetti active={opened} />}
      {couple.wedding.music ? <MusicToggle src={couple.wedding.music} lang={lang} /> : null}
      <ShareSheet couple={couple} />
    </div>
  );
}
