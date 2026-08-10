"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getWishes, postWish, type Wish } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { WishesBoardProps } from "./props";

const inputCls =
  "w-full rounded-(--radius) border border-(--border) bg-(--c-bg) px-3 py-2 text-(--c-text) placeholder:text-(--c-muted) focus:border-(--c-primary)";

type FormStatus = "idle" | "sending" | "success";

/** WishesBoard — paginated guestbook list + a "leave a wish" form. */
export default function WishesBoard({ coupleSlug, lang, limit, className = "" }: WishesBoardProps) {
  const perPage = limit ?? 20;

  const [wishes, setWishes] = useState<Wish[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [formErrors, setFormErrors] = useState<{ name?: string; message?: string }>({});
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (targetPage: number) => {
      setError(null);
      if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const chunk = await getWishes(coupleSlug, targetPage, perPage);
        setWishes((prev) => (targetPage === 1 ? chunk : [...prev, ...chunk]));
        setPage(targetPage);
        setHasMore(chunk.length === perPage);
      } catch {
        setError(t("error_generic", lang));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [coupleSlug, perPage, lang]
  );

  useEffect(() => {
    // Deferred past hydration so initial load never sets state synchronously
    // inside the effect body.
    const id = window.setTimeout(() => {
      void loadPage(1);
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadPage]);

  async function handlePost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors: { name?: string; message?: string } = {};
    if (!name.trim()) nextErrors.name = t("required_field", lang);
    if (!message.trim()) nextErrors.message = t("required_field", lang);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setFormError(null);
    setFormStatus("sending");
    try {
      await postWish(coupleSlug, name.trim(), message.trim());
      setFormStatus("success");
      setName("");
      setMessage("");
    } catch {
      setFormError(t("error_generic", lang));
      setFormStatus("idle");
    }
  }

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      <div className="space-y-3">
        {wishes.map((w) => (
          <figure
            key={w.id}
            className="rounded-(--radius) border border-(--border) bg-(--c-surface) p-4 shadow-(--shadow)"
          >
            <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-medium text-(--c-text)">{w.name}</span>
              <time dateTime={w.created_at} className="text-xs text-(--c-muted)">
                {formatDate(w.created_at, lang)}
              </time>
            </figcaption>
            <blockquote className="leading-relaxed text-(--c-text)">{w.message}</blockquote>
          </figure>
        ))}
      </div>

      {loading ? (
        <p className="py-4 text-center text-sm text-(--c-muted)">{t("sending", lang)}</p>
      ) : null}
      {!loading && error ? (
        <p role="alert" className="py-4 text-center text-sm text-(--c-accent)">
          {error}
        </p>
      ) : null}
      {!loading && !error && wishes.length === 0 ? (
        <p className="py-4 text-center text-sm text-(--c-muted)">{t("no_data", lang)}</p>
      ) : null}

      {!loading && hasMore ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => void loadPage(page + 1)}
            disabled={loadingMore}
            className="rounded-(--radius) border border-(--border) bg-(--c-surface) px-5 py-2 font-medium text-(--c-primary) shadow-(--shadow) transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? t("sending", lang) : t("load_more", lang)}
          </button>
        </div>
      ) : null}

      <form
        onSubmit={handlePost}
        noValidate
        className="space-y-3 rounded-(--radius) border border-(--border) bg-(--c-surface) p-5 shadow-(--shadow)"
      >
        <div>
          <label
            htmlFor="wciw-wish-name"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("guest_name", lang)}
          </label>
          <input
            id="wciw-wish-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            aria-invalid={Boolean(formErrors.name)}
            aria-describedby={formErrors.name ? "wciw-wish-name-error" : undefined}
            className={inputCls}
          />
          {formErrors.name ? (
            <p id="wciw-wish-name-error" className="mt-1 text-sm text-(--c-accent)">
              {formErrors.name}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="wciw-wish-message"
            className="mb-1 block text-sm font-medium text-(--c-text)"
          >
            {t("message_optional", lang)}
          </label>
          <textarea
            id="wciw-wish-message"
            name="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("wishes_placeholder", lang)}
            required
            aria-invalid={Boolean(formErrors.message)}
            aria-describedby={formErrors.message ? "wciw-wish-message-error" : undefined}
            className={inputCls}
          />
          {formErrors.message ? (
            <p id="wciw-wish-message-error" className="mt-1 text-sm text-(--c-accent)">
              {formErrors.message}
            </p>
          ) : null}
        </div>

        {formStatus === "success" ? (
          <p role="status" className="text-sm text-(--c-muted)">
            {t("wish_success", lang)}
          </p>
        ) : null}
        {formError ? (
          <p role="alert" className="text-sm text-(--c-accent)">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={formStatus === "sending"}
          className="w-full rounded-(--radius) bg-(--c-primary) px-4 py-2.5 font-medium text-white shadow-(--shadow) transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {formStatus === "sending" ? t("sending", lang) : t("send_wish", lang)}
        </button>
      </form>
    </div>
  );
}
