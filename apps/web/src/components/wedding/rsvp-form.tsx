"use client";

import { useEffect, useState, type FormEvent } from "react";
import { submitRsvp } from "@/lib/api";
import { coupleShareText } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { RsvpFormProps } from "./props";

const inputCls =
  "w-full rounded-(--radius) border border-(--border) bg-(--c-bg) px-3 py-2 text-(--c-text) placeholder:text-(--c-muted) focus:border-(--c-primary)";

type Status = "idle" | "sending" | "success";

/** RsvpForm — guest attendance form gated by the couple's RSVP settings. */
export default function RsvpForm({ couple, className = "" }: RsvpFormProps) {
  const lang = couple.language;

  // Deadline comparison needs Date.now(), which must never run during SSR /
  // first client paint — otherwise hydration mismatches. The check runs after
  // hydration inside a deferred callback instead of during render.
  const [closed, setClosed] = useState(!couple.rsvp.enabled);
  useEffect(() => {
    if (!couple.rsvp.deadline) return;
    const id = window.setTimeout(() => {
      if (new Date(couple.rsvp.deadline!).getTime() <= Date.now()) setClosed(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [couple.rsvp.deadline]);

  const [guestName, setGuestName] = useState("");
  const [attendance, setAttendance] = useState<"yes" | "no">("yes");
  const [guestsCount, setGuestsCount] = useState(1);
  const [phone, setPhone] = useState("");
  const [dietary, setDietary] = useState("");
  const [message, setMessage] = useState("");

  const [errors, setErrors] = useState<{ guestName?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const waHref = couple.rsvp.whatsapp
    ? `https://wa.me/${couple.rsvp.whatsapp}?text=${encodeURIComponent(
        `${coupleShareText(
          { bride: couple.couple.bride.name, groom: couple.couple.groom.name },
          couple.wedding.hashtag
        )} — ${t("rsvp_title", lang)}`
      )}`
    : null;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors: { guestName?: string } = {};
    if (!guestName.trim()) nextErrors.guestName = t("required_field", lang);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setError(null);
    setStatus("sending");
    try {
      await submitRsvp({
        coupleSlug: couple.slug,
        guestName: guestName.trim(),
        attendance,
        guestsCount: Math.max(1, Number(guestsCount) || 1),
        ...(dietary.trim() ? { dietary: dietary.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      setStatus("success");
    } catch {
      setError(t("error_generic", lang));
      setStatus("idle");
    }
  }

  if (closed) {
    return (
      <div className={`text-center ${className}`.trim()}>
        <p className="text-(--c-muted)">{t("rsvp_closed", lang)}</p>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div
        className={`flex flex-col items-center gap-3 rounded-(--radius) border border-(--border) bg-(--c-surface) p-6 text-center shadow-(--shadow) ${className}`.trim()}
        role="status"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--c-primary) text-white">
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <p className="font-medium text-(--c-text)">{t("rsvp_success", lang)}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4 rounded-(--radius) border border-(--border) bg-(--c-surface) p-5 shadow-(--shadow) sm:p-6"
      >
        <div>
          <label
            htmlFor="wciw-rsvp-name"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("guest_name", lang)}
          </label>
          <input
            id="wciw-rsvp-name"
            name="guestName"
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            autoComplete="name"
            required
            aria-invalid={Boolean(errors.guestName)}
            aria-describedby={errors.guestName ? "wciw-rsvp-name-error" : undefined}
            className={inputCls}
          />
          {errors.guestName ? (
            <p id="wciw-rsvp-name-error" className="mt-1 text-sm text-(--c-accent)">
              {errors.guestName}
            </p>
          ) : null}
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-(--c-text)">
            {t("attendance", lang)}
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-(--c-text)">
              <input
                type="radio"
                name="attendance"
                value="yes"
                checked={attendance === "yes"}
                onChange={() => setAttendance("yes")}
                className="accent-(--c-primary)"
              />
              {t("attending", lang)}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-(--c-text)">
              <input
                type="radio"
                name="attendance"
                value="no"
                checked={attendance === "no"}
                onChange={() => setAttendance("no")}
                className="accent-(--c-primary)"
              />
              {t("not_attending", lang)}
            </label>
          </div>
        </fieldset>

        {attendance === "yes" ? (
          <div>
            <label
              htmlFor="wciw-rsvp-guests"
              className="mb-1 block text-sm font-medium text-(--c-text)"
            >
              {t("guests_count", lang)}
            </label>
            <input
              id="wciw-rsvp-guests"
              name="guestsCount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={guestsCount}
              onChange={(e) => setGuestsCount(Number(e.target.value))}
              className={inputCls}
            />
          </div>
        ) : null}

        <div>
          <label
            htmlFor="wciw-rsvp-phone"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("phone", lang)}
          </label>
          <input
            id="wciw-rsvp-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className={inputCls}
          />
        </div>

        <div>
          <label
            htmlFor="wciw-rsvp-dietary"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("dietary", lang)}
          </label>
          <input
            id="wciw-rsvp-dietary"
            name="dietary"
            type="text"
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            className={inputCls}
          />
        </div>

        {couple.rsvp.allowMessage ? (
          <div>
            <label
              htmlFor="wciw-rsvp-message"
              className="mb-1 block text-sm font-medium text-(--c-text)"
            >
              {t("message_optional", lang)}
            </label>
            <textarea
              id="wciw-rsvp-message"
              name="message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={inputCls}
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-(--c-accent)">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-(--radius) bg-(--c-primary) px-4 py-2.5 font-medium text-white shadow-(--shadow) transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "sending" ? t("sending", lang) : t("submit", lang)}
        </button>
      </form>

      {waHref ? (
        <p className="text-center text-sm text-(--c-muted)">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-(--c-primary) underline-offset-4 hover:underline"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            {t("share_whatsapp", lang)}
          </a>
        </p>
      ) : null}
    </div>
  );
}
