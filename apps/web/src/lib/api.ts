import type { Language } from "./types";

/**
 * Frontend API client — wraps the weddings-service REST API.
 * - Reads the {success, data, error} envelope; consumers use `data.data.field`.
 * - Mock-first (NEXT_PUBLIC_USE_MOCK=true) so the frontend builds and runs
 *   before the backend is deployed.
 * - Admin calls authenticate directly against Cognito (USER_PASSWORD_AUTH) and
 *   send the **IdToken** as Bearer — the API Gateway authorizer rejects
 *   AccessTokens (foundation pain point #28).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const MOCK = (process.env.NEXT_PUBLIC_USE_MOCK ?? "true") === "true";
const COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID ?? "";
const COGNITO_REGION = process.env.NEXT_PUBLIC_COGNITO_REGION ?? "ap-southeast-1";

export interface Envelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string; details?: unknown } | null;
  pagination?: { page: number; items_per_page: number; total: number; total_pages: number };
}

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Retry a build-time or runtime fetch with backoff (foundation lib/api.ts pattern). */
export async function fetchRetry<T>(url: string, init?: RequestInit, attempts = 6): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      const delay = 300 * 2 ** i + Math.random() * 150;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed after retries");
}

function unwrap<T>(env: Envelope<T>): T {
  if (!env.success || env.error) throw new ApiError(env.error?.code ?? "INTERNAL_ERROR", env.error?.message ?? "Request failed");
  return env.data;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchRetry<Envelope<T>>(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return unwrap(res);
}

function mockDelay<T>(value: T, ms = 600): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export interface RsvpInput {
  coupleSlug: string;
  guestName: string;
  attendance: "yes" | "no";
  guestsCount: number;
  dietary?: string;
  phone?: string;
  message?: string;
}

export interface Wish {
  id: number;
  coupleSlug: string;
  name: string;
  message: string;
  approved: boolean;
  created_at: string;
}

export interface Gift {
  id: number;
  coupleSlug: string;
  name: string;
  message: string;
  item: string | null;
  approved: boolean;
  created_at: string;
}

export interface Rsvp {
  id: number;
  coupleSlug: string;
  guestName: string;
  attendance: "yes" | "no";
  guestsCount: number;
  dietary: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
}

const MOCK_WISHES: Wish[] = [
  { id: 1, coupleSlug: "adam-eve", name: "Aisyah", message: "Semoga bahagia hingga ke syurga! 🥰", approved: true, created_at: "2026-07-01T10:00:00+08:00" },
  { id: 2, coupleSlug: "adam-eve", name: "Daniel", message: "Congratulations to the lovely couple!", approved: true, created_at: "2026-07-02T12:30:00+08:00" },
  { id: 3, coupleSlug: "sarah-daniel", name: "Nadia", message: "Best wishes for a lifetime of happiness!", approved: true, created_at: "2026-07-03T09:15:00+08:00" },
  { id: 4, coupleSlug: "maya-arif", name: "Faris", message: "Selamat pengantin baru! 🎉", approved: true, created_at: "2026-07-04T18:45:00+08:00" },
];

export async function submitRsvp(input: RsvpInput): Promise<{ id: number }> {
  if (MOCK || !API_BASE) return mockDelay({ id: 999 });
  return request("/public/rsvps", { method: "POST", body: JSON.stringify(input) });
}

export async function getWishes(coupleSlug: string, page = 1, perPage = 20): Promise<Wish[]> {
  if (MOCK || !API_BASE) {
    const all = MOCK_WISHES.filter((w) => w.coupleSlug === coupleSlug && w.approved);
    return mockDelay(all.slice(0, page * perPage));
  }
  const env = await fetchRetry<Envelope<Wish[]>>(
    `${API_BASE}/public/wishes?coupleSlug=${encodeURIComponent(coupleSlug)}&page=${page}&perPage=${perPage}`
  );
  return unwrap(env);
}

export async function postWish(coupleSlug: string, name: string, message: string): Promise<{ id: number }> {
  if (MOCK || !API_BASE) return mockDelay({ id: 999 });
  return request("/public/wishes", { method: "POST", body: JSON.stringify({ coupleSlug, name, message }) });
}

export async function getGifts(coupleSlug: string): Promise<Gift[]> {
  if (MOCK || !API_BASE) return mockDelay([]);
  const env = await fetchRetry<Envelope<Gift[]>>(
    `${API_BASE}/public/gifts?coupleSlug=${encodeURIComponent(coupleSlug)}`
  );
  return unwrap(env);
}

export async function postGift(input: { coupleSlug: string; name: string; message: string; item?: string }): Promise<{ id: number }> {
  if (MOCK || !API_BASE) return mockDelay({ id: 999 });
  return request("/public/gifts", { method: "POST", body: JSON.stringify(input) });
}

/* ------------------------------------------------------------------ */
/* Admin API (Cognito-authenticated)                                   */
/* ------------------------------------------------------------------ */

let authToken: string | null = null;
if (typeof window !== "undefined") {
  authToken = window.localStorage.getItem("wciw_admin_token");
}

export function isAdminAuthed(): boolean {
  return Boolean(authToken);
}

export function adminLogout(): void {
  authToken = null;
  if (typeof window !== "undefined") window.localStorage.removeItem("wciw_admin_token");
}

export async function adminLogin(email: string, password: string): Promise<{ name?: string }> {
  // Mock/dev mode: accept any credentials so the admin can be demoed before
  // Cognito is wired up.
  if (MOCK || !COGNITO_CLIENT_ID) {
    authToken = "mock-token";
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wciw_admin_token", "mock-token");
      window.localStorage.setItem("wciw_admin_exp", String(Date.now() + 3600 * 1000));
    }
    return { name: email };
  }
  const res = await fetch(`https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    const msg = body.message ?? "Login failed";
    throw new ApiError("UNAUTHORIZED", msg);
  }
  const { IdToken, ExpiresIn } = body.AuthenticationResult ?? {};
  if (!IdToken) throw new ApiError("UNAUTHORIZED", "Login failed");
  authToken = IdToken;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("wciw_admin_token", IdToken);
    window.localStorage.setItem("wciw_admin_exp", String(Date.now() + (ExpiresIn ?? 3600) * 1000));
  }
  return { name: email };
}

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!authToken) throw new ApiError("UNAUTHORIZED", "Not signed in");
  return request(path, {
    ...init,
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

export interface RsvpStats {
  total: number;
  confirmed: number;
  declined: number;
  guests: number;
  pending_wishes: number;
}

export async function adminGetRsvps(coupleSlug: string, page = 1, attendance?: "yes" | "no"): Promise<Rsvp[]> {
  if (MOCK || !API_BASE) return mockDelay([]);
  const q = `coupleSlug=${encodeURIComponent(coupleSlug)}&page=${page}` + (attendance ? `&attendance=${attendance}` : "");
  return adminRequest(`/admin/rsvps?${q}`);
}

export async function adminGetRsvpStats(coupleSlug: string): Promise<RsvpStats> {
  if (MOCK || !API_BASE) return mockDelay({ total: 42, confirmed: 30, declined: 4, guests: 84, pending_wishes: 5 });
  return adminRequest(`/admin/rsvps/stats?coupleSlug=${encodeURIComponent(coupleSlug)}`);
}

export async function adminGetWishes(coupleSlug: string, status: "all" | "pending" | "approved" = "pending"): Promise<Wish[]> {
  if (MOCK || !API_BASE) return mockDelay(MOCK_WISHES.filter((w) => w.coupleSlug === coupleSlug));
  return adminRequest(`/admin/wishes?coupleSlug=${encodeURIComponent(coupleSlug)}&status=${status}`);
}

export async function adminApproveWish(id: number, approved: boolean): Promise<{ id: number }> {
  if (MOCK || !API_BASE) return mockDelay({ id });
  return adminRequest(`/admin/wishes/${id}`, { method: "PATCH", body: JSON.stringify({ approved }) });
}

export async function adminDeleteWish(id: number): Promise<{ id: number }> {
  if (MOCK || !API_BASE) return mockDelay({ id });
  return adminRequest(`/admin/wishes/${id}`, { method: "DELETE" });
}

export async function adminGetGifts(coupleSlug: string): Promise<Gift[]> {
  if (MOCK || !API_BASE) return mockDelay([]);
  return adminRequest(`/admin/gifts?coupleSlug=${encodeURIComponent(coupleSlug)}`);
}

export async function adminDeleteGift(id: number): Promise<{ id: number }> {
  if (MOCK || !API_BASE) return mockDelay({ id });
  return adminRequest(`/admin/gifts/${id}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

export function coupleUrl(slug: string): string {
  const base = SITE_URL || "https://yourdomain.com";
  return `${base}/w/${slug}`;
}

export function langFromConfig(language: Language): Language {
  return language;
}

export { t } from "./i18n";
