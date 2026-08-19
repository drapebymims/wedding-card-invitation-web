"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fraunces } from "next/font/google";
import { t } from "@/lib/i18n";
import type { CoupleConfig, ThemeId, Language } from "@/lib/types";
import { isThemeId } from "@/lib/themes";
import { blankConfig, SAMPLE_CONFIGS } from "@/lib/buyer/sample-configs";
import { LiveCardPreview } from "@/lib/buyer/preview-adapter";
import {
  createOrder,
  updateOrder,
  getOrder,
  checkout,
  isSignedIn,
  uploadImage,
} from "@/lib/buyer/orders-adapter";
import { PhoneFrame } from "./PhoneFrame";
import { Stepper, type StepDef } from "./Stepper";
import { TextInput, TextArea, SelectField, Toggle, GhostButton, Field } from "./Field";
import { ImageUpload } from "./ImageUpload";
import { AuthModal } from "./AuthModal";
import "@/app/buyer.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

const STEPS: StepDef[] = [
  { key: "basics", label: "step_basics" },
  { key: "wedding", label: "step_wedding" },
  { key: "story", label: "step_story" },
  { key: "gallery", label: "step_gallery" },
  { key: "events", label: "step_events" },
  { key: "rsvp", label: "step_rsvp" },
  { key: "gifts", label: "step_gifts" },
];

const LANG_OPTIONS: { value: Language; label: string }[] = [
  { value: "ms", label: "Bahasa Melayu" },
  { value: "en", label: "English" },
];

const THEME_OPTIONS: { value: ThemeId; label: string }[] = [
  { value: "refined", label: "Refined" },
  { value: "minimal", label: "Minimal" },
  { value: "vibrant", label: "Vibrant" },
];

export default function Studio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const themeParam = searchParams.get("theme");
  const orderParam = searchParams.get("order");

  const initialTheme: ThemeId = isThemeId(themeParam ?? "") ? (themeParam as ThemeId) : "refined";

  const [config, setConfig] = useState<CoupleConfig>(() =>
    // Start from a rich sample so the preview isn't empty, then let the buyer
    // overwrite with their own details. (Ordered cards load their saved config
    // on mount — see the load effect below — so we never seed from a sample.)
    orderParam ? SAMPLE_CONFIGS[initialTheme] : blankConfig(initialTheme),
  );
  const [step, setStep] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(orderParam);
  const [orderLoaded, setOrderLoaded] = useState<boolean>(!orderParam);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [authOpen, setAuthOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const lang = config.language;
  const lastSavedRef = useRef<string>(JSON.stringify(config));
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---- A3: load the saved order on mount (never overwrite a draft) ---- */
  useEffect(() => {
    if (!orderParam) return;
    let cancelled = false;
    (async () => {
      try {
        const order = await getOrder(orderParam);
        if (cancelled) return;
        setConfig(order.config);
        lastSavedRef.current = JSON.stringify(order.config);
        setOrderId(order.id);
        setDirty(false);
        setSaveState("saved");
      } catch {
        if (cancelled) return;
        setSaveState("error");
      } finally {
        if (!cancelled) setOrderLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderParam]);

  /* ---- generic updater ---- */
  const update = useCallback((patch: (c: CoupleConfig) => CoupleConfig) => {
    setConfig((prev) => {
      const next = patch(prev);
      // keep slug in sync with names
      const slug = slugify(`${next.couple.bride.name}-${next.couple.groom.name}`);
      return { ...next, slug: slug || next.slug };
    });
    setDirty(true);
  }, []);

  /* ---- Autosave: debounce config changes once an order exists ---- */
  useEffect(() => {
    // A3: never autosave until the saved order has been loaded, otherwise the
    // sample/blank seed would overwrite the buyer's real draft.
    if (!orderId || !orderLoaded) return;
    if (JSON.stringify(config) === lastSavedRef.current) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await updateOrder(orderId, config);
        lastSavedRef.current = JSON.stringify(config);
        setDirty(false);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [config, orderId, orderLoaded]);

  /* ---- validation ---- */
  function validateStep(i: number): boolean {
    const e: Record<string, string> = {};
    if (i === 0) {
      if (!config.couple.bride.fullName.trim()) e.bride = t("required_field", lang);
      if (!config.couple.groom.fullName.trim()) e.groom = t("required_field", lang);
    }
    if (i === 1 && !config.wedding.date.trim()) e.date = t("required_field", lang);
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /**
   * B2/B3 — validate ALL required fields before checkout (not just the current
   * step). A card missing couple names, a wedding date, or an event with a
   * venue + date cannot render (an empty event date would crash the
   * Add-to-Calendar `buildIcs` → RangeError). Shows inline errors; does not
   * block the happy path when everything is filled.
   */
  function validateCheckout(): boolean {
    const e: Record<string, string> = {};
    if (!config.couple.bride.fullName.trim()) e.bride = t("required_field", lang);
    if (!config.couple.groom.fullName.trim()) e.groom = t("required_field", lang);
    if (!config.wedding.date.trim()) e.date = t("required_field", lang);
    if (config.events.length === 0) {
      e.events = t("checkout_need_event", lang);
    } else {
      const incomplete = config.events.find(
        (ev) => !ev.venue.trim() || !ev.date.trim(),
      );
      if (incomplete) e.events = t("checkout_event_incomplete", lang);
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  /* ---- save draft ---- */
  async function handleSave() {
    if (!isSignedIn()) {
      setAuthOpen(true);
      return;
    }
    setSaving(true);
    try {
      if (!orderId) {
        const order = await createOrder(config);
        setOrderId(order.id);
        lastSavedRef.current = JSON.stringify(config);
        setDirty(false);
        setSaveState("saved");
      } else {
        await updateOrder(orderId, config);
        lastSavedRef.current = JSON.stringify(config);
        setDirty(false);
        setSaveState("saved");
      }
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  /* ---- continue to payment ---- */
  async function handleCheckout() {
    // B2/B3 — validate ALL required fields, not just the current step.
    if (!validateCheckout()) return;
    if (!isSignedIn()) {
      setAuthOpen(true);
      return;
    }
    setSaving(true);
    try {
      let id = orderId;
      if (!id) {
        const order = await createOrder(config);
        id = order.id;
        setOrderId(id);
      } else {
        await updateOrder(id, config);
      }
      const { billUrl } = await checkout(id);
      if (billUrl) {
        // In the real flow this redirects to ToyyibPay; our mock routes to the
        // thanks page. Use router.push so it works client-side on static export.
        router.push(billUrl);
      }
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  /**
   * Image upload — requires an existing order. Returns the CDN URL so the step
   * writes it into the live config (gallery[].src / story.image) and the phone
   * preview updates automatically.
   */
  async function handleUpload(file: File): Promise<string> {
    if (!orderId) throw new Error("No order");
    const res = await uploadImage(orderId, {
      file,
      filename: file.name,
      contentType: file.type,
    });
    return res.cdnUrl;
  }

  const stepLabel = STEPS[step].label;

  return (
    <div className={`min-h-full bg-[var(--c-bg)] ${fraunces.variable}`}>
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--c-bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/templates")}
              className="text-sm text-[var(--c-muted)] transition-colors hover:text-[var(--c-primary)]"
            >
              ←
            </button>
            <div>
              <h1 className={`buyer-display text-lg font-semibold text-[var(--c-text)]`}>
                {t("studio_title", lang)}
              </h1>
              <p className="text-xs text-[var(--c-muted)]">
                {t("step_of", lang)} {step + 1} / {STEPS.length} · {t(stepLabel as never, lang)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`hidden text-xs sm:inline ${
                saveState === "saved"
                  ? "text-emerald-600"
                  : saveState === "error"
                    ? "text-red-600"
                    : "text-[var(--c-muted)]"
              }`}
            >
              {saveState === "saved"
                ? t("saved", lang)
                : saveState === "saving" || dirty
                  ? "…"
                  : ""}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm font-medium text-[var(--c-text)] transition-colors hover:border-[var(--c-primary)] disabled:opacity-60"
            >
              {saving ? t("saving", lang) : t("save_draft", lang)}
            </button>
            <button
              onClick={handleCheckout}
              disabled={saving}
              className="rounded-full bg-[var(--c-primary)] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {t("continue_payment", lang)}
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-5 pb-3">
          <Stepper steps={STEPS} current={step} onSelect={(i) => i < step && setStep(i)} lang={lang} />
        </div>
      </header>

      {/* Body: form left, sticky preview right */}
      <main className="mx-auto grid max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1fr_360px]">
        {/* Form */}
        <div className="buyer-card p-6 sm:p-8">
          {step === 0 && <BasicsStep config={config} update={update} errors={errors} lang={lang} />}
          {step === 1 && <WeddingStep config={config} update={update} errors={errors} lang={lang} />}
          {step === 2 && <StoryStep config={config} update={update} lang={lang} upload={handleUpload} canUpload={!!orderId} />}
          {step === 3 && <GalleryStep config={config} update={update} lang={lang} upload={handleUpload} canUpload={!!orderId} />}
          {step === 4 && <EventsStep config={config} update={update} errors={errors} lang={lang} />}
          {step === 5 && <RsvpStep config={config} update={update} lang={lang} />}
          {step === 6 && <GiftsStep config={config} update={update} lang={lang} />}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] pt-6">
            <button
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--c-text)] transition-colors hover:border-[var(--c-primary)] disabled:opacity-40"
            >
              {t("back", lang)}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={goNext}
                className="rounded-xl bg-[var(--c-primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                {t("next", lang)}
              </button>
            ) : (
              <button
                onClick={handleCheckout}
                disabled={saving}
                className="rounded-xl bg-[var(--c-primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {saving ? t("saving", lang) : t("continue_payment", lang)}
              </button>
            )}
          </div>
        </div>

        {/* Sticky live preview */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="flex flex-col items-center">
            <PhoneFrame label={t("live_demo", lang)}>
              <LiveCardPreview config={config} />
            </PhoneFrame>
          </div>
        </aside>
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        lang={lang}
      />
    </div>
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || ""
  );
}

/* ================================================================== */
/* Step forms                                                          */
/* ================================================================== */

function BasicsStep({
  config,
  update,
  errors,
  lang,
}: {
  config: CoupleConfig;
  update: (f: (c: CoupleConfig) => CoupleConfig) => void;
  errors: Record<string, string>;
  lang: Language;
}) {
  return (
    <div className="space-y-6">
      <StepHeading title={t("step_basics", lang)} subtitle={t("studio_subtitle", lang)} lang={lang} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label={t("bride_full", lang)}
          value={config.couple.bride.fullName}
          error={errors.bride}
          onChange={(e) => update((c) => ({ ...c, couple: { ...c.couple, bride: { ...c.couple.bride, fullName: e.target.value } } }))}
        />
        <TextInput
          label={t("groom_full", lang)}
          value={config.couple.groom.fullName}
          error={errors.groom}
          onChange={(e) => update((c) => ({ ...c, couple: { ...c.couple, groom: { ...c.couple.groom, fullName: e.target.value } } }))}
        />
        <TextInput
          label={t("bride_name", lang)}
          optional
          value={config.couple.bride.name}
          onChange={(e) => update((c) => ({ ...c, couple: { ...c.couple, bride: { ...c.couple.bride, name: e.target.value } } }))}
        />
        <TextInput
          label={t("groom_name", lang)}
          optional
          value={config.couple.groom.name}
          onChange={(e) => update((c) => ({ ...c, couple: { ...c.couple, groom: { ...c.couple.groom, name: e.target.value } } }))}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label={t("theme", lang)}
          value={config.theme}
          onChange={(e) =>
            update((c) => ({ ...c, theme: e.target.value as ThemeId }))
          }
        >
          {THEME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t("language", lang)}
          value={config.language}
          onChange={(e) => update((c) => ({ ...c, language: e.target.value as Language }))}
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
      </div>
    </div>
  );
}

function WeddingStep({
  config,
  update,
  errors,
  lang,
}: {
  config: CoupleConfig;
  update: (f: (c: CoupleConfig) => CoupleConfig) => void;
  errors: Record<string, string>;
  lang: Language;
}) {
  return (
    <div className="space-y-6">
      <StepHeading title={t("step_wedding", lang)} subtitle={t("studio_subtitle", lang)} lang={lang} />
      <TextInput
        label={t("wedding_date", lang)}
        type="datetime-local"
        value={toLocalInput(config.wedding.date)}
        error={errors.date}
        onChange={(e) => update((c) => ({ ...c, wedding: { ...c.wedding, date: toIso(e.target.value) } }))}
      />
      <TextArea
        label={t("tagline", lang)}
        value={config.wedding.tagline}
        onChange={(e) => update((c) => ({ ...c, wedding: { ...c.wedding, tagline: e.target.value } }))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label={t("hashtag", lang)}
          optional
          value={config.wedding.hashtag ?? ""}
          onChange={(e) => update((c) => ({ ...c, wedding: { ...c.wedding, hashtag: e.target.value } }))}
        />
        <TextInput
          label={t("music_url", lang)}
          optional
          value={config.wedding.music ?? ""}
          onChange={(e) => update((c) => ({ ...c, wedding: { ...c.wedding, music: e.target.value } }))}
        />
      </div>
    </div>
  );
}

function StoryStep({
  config,
  update,
  lang,
  upload,
  canUpload,
}: {
  config: CoupleConfig;
  update: (f: (c: CoupleConfig) => CoupleConfig) => void;
  lang: Language;
  upload: (file: File) => Promise<string>;
  canUpload: boolean;
}) {
  return (
    <div className="space-y-6">
      <StepHeading title={t("step_story", lang)} subtitle={t("studio_subtitle", lang)} lang={lang} />
      {config.story.map((entry, i) => (
        <div key={i} className="space-y-4 rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--c-text)]">
              {t("our_story", lang)} · {i + 1}
            </span>
            <button
              onClick={() => update((c) => ({ ...c, story: c.story.filter((_, j) => j !== i) }))}
              className="text-sm text-red-500 hover:underline"
            >
              {t("delete", lang)}
            </button>
          </div>
          <TextInput
            label={t("story_title", lang)}
            value={entry.title}
            onChange={(e) => update((c) => ({ ...c, story: c.story.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)) }))}
          />
          <TextInput
            label={t("story_date", lang)}
            optional
            value={entry.date ?? ""}
            onChange={(e) => update((c) => ({ ...c, story: c.story.map((s, j) => (j === i ? { ...s, date: e.target.value } : s)) }))}
          />
          <ImageUpload
            label={`${t("upload_photo", lang)} · ${i + 1}`}
            value={entry.image ?? ""}
            onChange={(src) => update((c) => ({ ...c, story: c.story.map((s, j) => (j === i ? { ...s, image: src || undefined } : s)) }))}
            onUpload={upload}
            disabled={!canUpload}
            disabledMessage={t("upload_requires_order", lang)}
            lang={lang}
          />
          <TextArea
            label={t("story_description", lang)}
            value={entry.description}
            onChange={(e) => update((c) => ({ ...c, story: c.story.map((s, j) => (j === i ? { ...s, description: e.target.value } : s)) }))}
          />
        </div>
      ))}
      <GhostButton onClick={() => update((c) => ({ ...c, story: [...c.story, { title: "", date: "", description: "" }] }))}>
        {t("add_story", lang)}
      </GhostButton>
    </div>
  );
}

function GalleryStep({
  config,
  update,
  lang,
  upload,
  canUpload,
}: {
  config: CoupleConfig;
  update: (f: (c: CoupleConfig) => CoupleConfig) => void;
  lang: Language;
  upload: (file: File) => Promise<string>;
  canUpload: boolean;
}) {
  return (
    <div className="space-y-6">
      <StepHeading title={t("step_gallery", lang)} subtitle={t("studio_subtitle", lang)} lang={lang} />

      {/* Upload new photos (appends to gallery[]) */}
      <ImageUpload
        label={t("upload_add_photo", lang)}
        multiple
        onChange={(src) => update((c) => ({ ...c, gallery: [...c.gallery, { src, alt: "" }] }))}
        onUpload={upload}
        disabled={!canUpload}
        disabledMessage={t("upload_requires_order", lang)}
        lang={lang}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {config.gallery.map((item, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            {item.src ? (
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-[var(--c-muted)]/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.alt} className="h-full w-full object-cover" />
              </div>
            ) : null}
            <TextInput
              label={t("gallery_image", lang)}
              value={item.src}
              onChange={(e) => update((c) => ({ ...c, gallery: c.gallery.map((g, j) => (j === i ? { ...g, src: e.target.value } : g)) }))}
            />
            <TextInput
              label={t("gallery_alt", lang)}
              optional
              value={item.alt}
              onChange={(e) => update((c) => ({ ...c, gallery: c.gallery.map((g, j) => (j === i ? { ...g, alt: e.target.value } : g)) }))}
            />
            <button
              onClick={() => update((c) => ({ ...c, gallery: c.gallery.filter((_, j) => j !== i) }))}
              className="text-sm text-red-500 hover:underline"
            >
              {t("delete", lang)}
            </button>
          </div>
        ))}
      </div>
      <GhostButton onClick={() => update((c) => ({ ...c, gallery: [...c.gallery, { src: "", alt: "" }] }))}>
        {t("add_gallery", lang)}
      </GhostButton>
    </div>
  );
}

function EventsStep({
  config,
  update,
  errors,
  lang,
}: {
  config: CoupleConfig;
  update: (f: (c: CoupleConfig) => CoupleConfig) => void;
  errors: Record<string, string>;
  lang: Language;
}) {
  return (
    <div className="space-y-6">
      <StepHeading title={t("step_events", lang)} subtitle={t("studio_subtitle", lang)} lang={lang} />
      {errors.events ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors.events}</p>
      ) : null}
      {config.events.map((ev, i) => (
        <div key={i} className="space-y-4 rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--c-text)]">
              {t("events", lang)} · {i + 1}
            </span>
            <button
              onClick={() => update((c) => ({ ...c, events: c.events.filter((_, j) => j !== i) }))}
              className="text-sm text-red-500 hover:underline"
            >
              {t("delete", lang)}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t("event_name", lang)}
              value={ev.name}
              onChange={(e) => update((c) => ({ ...c, events: c.events.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
            />
            <SelectField
              label={t("event_type", lang)}
              value={ev.type}
              onChange={(e) =>
                update((c) => ({ ...c, events: c.events.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof ev.type } : x)) }))
              }
            >
              {(["ceremony", "reception", "party", "other"] as const).map((ty) => (
                <option key={ty} value={ty}>
                  {t(ty, lang)}
                </option>
              ))}
            </SelectField>
          </div>
          <TextInput
            label={t("wedding_date", lang)}
            type="datetime-local"
            value={toLocalInput(ev.date)}
            onChange={(e) => update((c) => ({ ...c, events: c.events.map((x, j) => (j === i ? { ...x, date: toIso(e.target.value) } : x)) }))}
          />
          <TextInput
            label={t("event_venue", lang)}
            value={ev.venue}
            onChange={(e) => update((c) => ({ ...c, events: c.events.map((x, j) => (j === i ? { ...x, venue: e.target.value } : x)) }))}
          />
          <TextArea
            label={t("event_address", lang)}
            value={ev.address}
            onChange={(e) => update((c) => ({ ...c, events: c.events.map((x, j) => (j === i ? { ...x, address: e.target.value } : x)) }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label={t("event_maps", lang)}
              optional
              value={ev.mapsUrl ?? ""}
              onChange={(e) => update((c) => ({ ...c, events: c.events.map((x, j) => (j === i ? { ...x, mapsUrl: e.target.value } : x)) }))}
            />
            <TextInput
              label={t("event_dress", lang)}
              optional
              value={ev.dressCode ?? ""}
              onChange={(e) => update((c) => ({ ...c, events: c.events.map((x, j) => (j === i ? { ...x, dressCode: e.target.value } : x)) }))}
            />
          </div>
        </div>
      ))}
      <GhostButton
        onClick={() =>
          update((c) => ({
            ...c,
            events: [
              ...c.events,
              { name: "", type: "ceremony", date: "", venue: "", address: "", mapsUrl: "", dressCode: "" },
            ],
          }))
        }
      >
        {t("add_event", lang)}
      </GhostButton>
    </div>
  );
}

function RsvpStep({
  config,
  update,
  lang,
}: {
  config: CoupleConfig;
  update: (f: (c: CoupleConfig) => CoupleConfig) => void;
  lang: Language;
}) {
  return (
    <div className="space-y-6">
      <StepHeading title={t("step_rsvp", lang)} subtitle={t("studio_subtitle", lang)} lang={lang} />
      <Toggle
        label={t("rsvp_enable", lang)}
        checked={config.rsvp.enabled}
        onChange={(v) => update((c) => ({ ...c, rsvp: { ...c.rsvp, enabled: v } }))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label={t("rsvp_deadline", lang)}
          optional
          type="datetime-local"
          value={toLocalInput(config.rsvp.deadline ?? "")}
          onChange={(e) => update((c) => ({ ...c, rsvp: { ...c.rsvp, deadline: toIso(e.target.value) } }))}
        />
        <TextInput
          label={t("rsvp_whatsapp", lang)}
          optional
          value={config.rsvp.whatsapp ?? ""}
          onChange={(e) => update((c) => ({ ...c, rsvp: { ...c.rsvp, whatsapp: e.target.value } }))}
        />
      </div>
      <Toggle
        label={t("rsvp_message", lang)}
        checked={config.rsvp.allowMessage}
        onChange={(v) => update((c) => ({ ...c, rsvp: { ...c.rsvp, allowMessage: v } }))}
      />
    </div>
  );
}

function GiftsStep({
  config,
  update,
  lang,
}: {
  config: CoupleConfig;
  update: (f: (c: CoupleConfig) => CoupleConfig) => void;
  lang: Language;
}) {
  return (
    <div className="space-y-6">
      <StepHeading title={t("step_gifts", lang)} subtitle={t("studio_subtitle", lang)} lang={lang} />
      <TextArea
        label={t("gift_message", lang)}
        value={config.gifts.message}
        onChange={(e) => update((c) => ({ ...c, gifts: { ...c.gifts, message: e.target.value } }))}
      />
      {config.gifts.accounts.map((acc, i) => (
        <div key={i} className="space-y-4 rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--c-text)]">
              {t("gifts_title", lang)} · {i + 1}
            </span>
            <button
              onClick={() => update((c) => ({ ...c, gifts: { ...c.gifts, accounts: c.gifts.accounts.filter((_, j) => j !== i) } }))}
              className="text-sm text-red-500 hover:underline"
            >
              {t("delete", lang)}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput
              label={t("gift_bank", lang)}
              value={acc.bank}
              onChange={(e) => update((c) => ({ ...c, gifts: { ...c.gifts, accounts: c.gifts.accounts.map((a, j) => (j === i ? { ...a, bank: e.target.value } : a)) } }))}
            />
            <TextInput
              label={t("gift_account", lang)}
              value={acc.accountNumber}
              onChange={(e) => update((c) => ({ ...c, gifts: { ...c.gifts, accounts: c.gifts.accounts.map((a, j) => (j === i ? { ...a, accountNumber: e.target.value } : a)) } }))}
            />
            <TextInput
              label={t("gift_holder", lang)}
              value={acc.holder}
              onChange={(e) => update((c) => ({ ...c, gifts: { ...c.gifts, accounts: c.gifts.accounts.map((a, j) => (j === i ? { ...a, holder: e.target.value } : a)) } }))}
            />
          </div>
        </div>
      ))}
      <GhostButton
        onClick={() => update((c) => ({ ...c, gifts: { ...c.gifts, accounts: [...c.gifts.accounts, { bank: "", accountNumber: "", holder: "" }] } }))}
      >
        {t("add_gift", lang)}
      </GhostButton>
    </div>
  );
}

function StepHeading({ title, subtitle, lang }: { title: string; subtitle: string; lang: Language }) {
  return (
    <div>
      <h2 className={`buyer-display text-2xl font-semibold text-[var(--c-text)]`}>{title}</h2>
      <p className="mt-1 text-sm text-[var(--c-muted)]">{subtitle}</p>
    </div>
  );
}

/* ---- datetime helpers (local <input type=datetime-local> <-> ISO) ---- */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string {
  if (!local) return "";
  return new Date(local).toISOString();
}
