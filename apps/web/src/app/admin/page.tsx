"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminLogin,
  adminLogout,
  isAdminAuthed,
  adminGetRsvps,
  adminGetRsvpStats,
  adminGetWishes,
  adminApproveWish,
  adminDeleteWish,
  adminGetGifts,
  adminDeleteGift,
  coupleUrl,
  type Rsvp,
  type Wish,
  type Gift,
  type RsvpStats,
} from "@/lib/api";
import { t } from "@/lib/i18n";

interface CoupleSummary {
  slug: string;
  theme: string;
  language: string;
  names: { bride: string; groom: string };
}

type Tab = "overview" | "rsvp" | "wishes" | "gifts";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean>(() => isAdminAuthed());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [couples, setCouples] = useState<CoupleSummary[]>([]);
  const [coupleSlug, setCoupleSlug] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  const [stats, setStats] = useState<RsvpStats | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "yes" | "no">("all");
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [wishStatus, setWishStatus] = useState<"pending" | "all">("pending");
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lang = "en";

  // Load the couple manifest once (build-time /couples.json).
  useEffect(() => {
    fetch("/couples.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CoupleSummary[]) => {
        setCouples(data);
        if (data.length > 0) setCoupleSlug(data[0].slug);
      })
      .catch(() => setCouples([]));
  }, []);

  const activeSlug = coupleSlug || customSlug;

  const refresh = useCallback(async () => {
    if (!activeSlug) return;
    setBusy(true);
    setError(null);
    try {
      if (tab === "overview") {
        setStats(await adminGetRsvpStats(activeSlug));
      } else if (tab === "rsvp") {
        setRsvps(await adminGetRsvps(activeSlug, 1, attendanceFilter === "all" ? undefined : attendanceFilter));
      } else if (tab === "wishes") {
        setWishes(await adminGetWishes(activeSlug, wishStatus));
      } else {
        setGifts(await adminGetGifts(activeSlug));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error_generic", lang));
    } finally {
      setBusy(false);
    }
  }, [activeSlug, tab, attendanceFilter, wishStatus]);

  useEffect(() => {
    if (!authed || !activeSlug) return;
    // Defer past the effect's synchronous phase — React 19's
    // set-state-in-effect rule rejects sync setState inside effects.
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [authed, activeSlug, refresh]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      await adminLogin(email, password);
      setAuthed(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : t("error_generic", lang));
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    adminLogout();
    setAuthed(false);
    setStats(null);
    setRsvps([]);
    setWishes([]);
    setGifts([]);
  }

  function exportCsv() {
    const header = ["name", "attendance", "guests", "phone", "dietary", "message", "created_at"];
    const rows = rsvps.map((r) =>
      [r.guestName, r.attendance, r.guestsCount, r.phone ?? "", r.dietary ?? "", r.message ?? "", r.created_at]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSlug}-rsvps.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function approveWish(id: number) {
    await adminApproveWish(id, true);
    void refresh();
  }

  async function removeWish(id: number) {
    await adminDeleteWish(id);
    void refresh();
  }

  async function removeGift(id: number) {
    await adminDeleteGift(id);
    void refresh();
  }

  const activeNames = useMemo(() => {
    const found = couples.find((c) => c.slug === activeSlug);
    return found ? `${found.names.bride} & ${found.names.groom}` : activeSlug;
  }, [couples, activeSlug]);

  // ---- Sign-in screen ----
  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--c-bg)] px-5">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--c-surface)] p-8 shadow-[var(--shadow)]"
        >
          <h1 className="mb-1 text-2xl font-semibold text-[var(--c-text)]">{t("dashboard", lang)}</h1>
          <p className="mb-6 text-sm text-[var(--c-muted)]">{t("login", lang)}</p>
          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-[var(--c-text)]">{t("email", lang)}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)] focus:border-[var(--c-primary)]"
            />
          </label>
          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-medium text-[var(--c-text)]">{t("password", lang)}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)] focus:border-[var(--c-primary)]"
            />
          </label>
          {loginError ? <p className="mb-4 text-sm text-red-600">{loginError}</p> : null}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full rounded-lg bg-[var(--c-primary)] px-4 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {loggingIn ? t("sending", lang) : t("login", lang)}
          </button>
        </form>
      </main>
    );
  }

  // ---- Dashboard ----
  const tabDefs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("dashboard", lang) },
    { id: "rsvp", label: t("rsvp_title", lang) },
    { id: "wishes", label: t("wishes_title", lang) },
    { id: "gifts", label: t("gifts_title", lang) },
  ];

  const statCards = [
    { label: t("total_rsvps", lang), value: stats?.total ?? 0 },
    { label: t("confirmed", lang), value: stats?.confirmed ?? 0 },
    { label: t("declined", lang), value: stats?.declined ?? 0 },
    { label: t("expected_guests", lang), value: stats?.guests ?? 0 },
    { label: t("pending_wishes", lang), value: stats?.pending_wishes ?? 0 },
  ];

  return (
    <main className="min-h-screen bg-[var(--c-bg)] px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--c-text)]">{t("dashboard", lang)}</h1>
            <p className="text-sm text-[var(--c-muted)]">{activeNames}</p>
          </div>
          <div className="flex gap-2">
            {activeSlug ? (
              <a
                href={coupleUrl(activeSlug)}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--c-text)] hover:border-[var(--c-primary)]"
              >
                {t("back_to_site", lang)}
              </a>
            ) : null}
            <button
              onClick={handleLogout}
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--c-text)] hover:border-red-400 hover:text-red-600"
            >
              {t("logout", lang)}
            </button>
          </div>
        </div>

        {/* Couple picker */}
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--c-surface)] p-4">
          {couples.length > 0 ? (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--c-text)]">{t("select_couple", lang)}</span>
              <select
                value={coupleSlug}
                onChange={(e) => setCoupleSlug(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)] sm:max-w-xs"
              >
                {couples.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.names.bride} &amp; {c.names.groom} ({c.slug})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--c-text)]">{t("select_couple", lang)}</span>
              <input
                type="text"
                value={customSlug}
                onChange={(e) => setCustomSlug(e.target.value)}
                placeholder="adam-eve"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--c-bg)] px-3 py-2 text-[var(--c-text)] sm:max-w-xs"
              />
            </label>
          )}
        </div>

        {/* Tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {tabDefs.map((d) => (
            <button
              key={d.id}
              onClick={() => setTab(d.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab === d.id
                  ? "bg-[var(--c-primary)] text-white"
                  : "border border-[var(--border)] bg-[var(--c-surface)] text-[var(--c-text)]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
        {busy ? <p className="mb-4 text-sm text-[var(--c-muted)]">{t("sending", lang)}</p> : null}

        {!activeSlug ? (
          <p className="text-[var(--c-muted)]">{t("no_data", lang)}</p>
        ) : tab === "overview" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {statCards.map((c) => (
              <div key={c.label} className="rounded-xl border border-[var(--border)] bg-[var(--c-surface)] p-4 text-center">
                <p className="text-3xl font-semibold text-[var(--c-text)]">{c.value}</p>
                <p className="mt-1 text-xs text-[var(--c-muted)]">{c.label}</p>
              </div>
            ))}
          </div>
        ) : tab === "rsvp" ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--c-surface)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
              <div className="flex gap-2">
                {(["all", "yes", "no"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setAttendanceFilter(f)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      attendanceFilter === f
                        ? "bg-[var(--c-primary)] text-white"
                        : "border border-[var(--border)] text-[var(--c-text)]"
                    }`}
                  >
                    {f === "all" ? t("status", lang) : f === "yes" ? t("attending", lang) : t("not_attending", lang)}
                  </button>
                ))}
              </div>
              <button
                onClick={exportCsv}
                disabled={rsvps.length === 0}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--c-text)] disabled:opacity-50"
              >
                {t("export_csv", lang)}
              </button>
            </div>
            {rsvps.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--c-muted)]">{t("no_data", lang)}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--c-muted)]">
                    <tr>
                      <th className="px-4 py-2">{t("guest_name", lang)}</th>
                      <th className="px-4 py-2">{t("attendance", lang)}</th>
                      <th className="px-4 py-2">{t("guests_count", lang)}</th>
                      <th className="px-4 py-2">{t("phone", lang)}</th>
                      <th className="px-4 py-2">{t("dietary", lang)}</th>
                      <th className="px-4 py-2">{t("message", lang)}</th>
                      <th className="px-4 py-2">{t("date", lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.map((r) => (
                      <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-4 py-2 font-medium text-[var(--c-text)]">{r.guestName}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              r.attendance === "yes" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"
                            }`}
                          >
                            {r.attendance === "yes" ? t("attending", lang) : t("not_attending", lang)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[var(--c-text)]">{r.guestsCount}</td>
                        <td className="px-4 py-2 text-[var(--c-muted)]">{r.phone ?? "—"}</td>
                        <td className="px-4 py-2 text-[var(--c-muted)]">{r.dietary ?? "—"}</td>
                        <td className="max-w-[16rem] truncate px-4 py-2 text-[var(--c-muted)]">{r.message ?? "—"}</td>
                        <td className="px-4 py-2 text-xs text-[var(--c-muted)]">{new Date(r.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === "wishes" ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--c-surface)]">
            <div className="flex gap-2 border-b border-[var(--border)] p-4">
              {(["pending", "all"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setWishStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    wishStatus === s ? "bg-[var(--c-primary)] text-white" : "border border-[var(--border)] text-[var(--c-text)]"
                  }`}
                >
                  {s === "pending" ? t("wish_pending", lang) : t("status", lang)}
                </button>
              ))}
            </div>
            {wishes.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--c-muted)]">{t("no_data", lang)}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {wishes.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--c-text)]">{w.name}</span>
                        {!w.approved ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                            {t("wish_pending", lang)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--c-muted)]">{w.message}</p>
                      <p className="mt-1 text-xs text-[var(--c-muted)]">{new Date(w.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                      {!w.approved ? (
                        <button
                          onClick={() => approveWish(w.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          {t("approve", lang)}
                        </button>
                      ) : null}
                      <button
                        onClick={() => removeWish(w.id)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        {t("delete", lang)}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--c-surface)]">
            {gifts.length === 0 ? (
              <p className="p-6 text-center text-sm text-[var(--c-muted)]">{t("no_data", lang)}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {gifts.map((g) => (
                  <li key={g.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <span className="font-medium text-[var(--c-text)]">{g.name}</span>
                      {g.item ? <span className="ml-2 text-sm text-[var(--c-muted)]">— {g.item}</span> : null}
                      <p className="mt-1 text-sm text-[var(--c-muted)]">{g.message}</p>
                      <p className="mt-1 text-xs text-[var(--c-muted)]">{new Date(g.created_at).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => removeGift(g.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      {t("delete", lang)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
