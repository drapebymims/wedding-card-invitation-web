"use client";

import type { CoupleConfig } from "@/lib/types";
import type { Order, OrderSummary, BuyerUser } from "./types";
import { ApiError, fetchRetry, type Envelope } from "@/lib/api";
// Fixer lane's real orders client (now on disk). It handles its own mock mode
// internally (NEXT_PUBLIC_USE_MOCK) and reads the auth token via
// `getOrdersToken()` (key: NEXT_PUBLIC_ORDERS_TOKEN_KEY ?? "wciw_admin_token").
import * as fixerOrders from "@/lib/orders-client";

/**
 * Orders + auth client for the buyer flow.
 *
 * Wraps the fixer lane's `orders-client.ts` (real backend client). Auth calls
 * the weddings-service `/auth/login` + `/auth/signup` endpoints (Cognito
 * IdTokens) and stores the IdToken under a BUYER-ONLY key so admin and buyer
 * sessions never clobber each other (B4).
 *
 * Token key coordination (B4): `orders-client.ts` reads
 * `NEXT_PUBLIC_ORDERS_TOKEN_KEY ?? "wciw_admin_token"`. This adapter writes
 * `NEXT_PUBLIC_ORDERS_TOKEN_KEY ?? NEXT_PUBLIC_BUYER_TOKEN_KEY ?? "wciw_buyer_token"`.
 * For real-mode auth, set `NEXT_PUBLIC_ORDERS_TOKEN_KEY=wciw_buyer_token` in
 * the Amplify env so both modules agree on the key (or have the orders-client
 * lane change its default).
 *
 * Contract surface used by the UI:
 *   signIn / signUp / signOut / isSignedIn / currentUser
 *   createOrder(config) → Order
 *   updateOrder(id, config) → Order
 *   getOrder(id) → Order
 *   listOrders() → OrderSummary[]
 *   checkout(id) → { billUrl }
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
// A3 — mock gate must be IDENTICAL to orders-client.ts (lines 26-29) so both
// clients agree in every environment: mock only when explicitly requested
// ("true"), OR when no real API is reachable (non-production build, or no API
// base configured). Never default to mock in production with a real API base —
// the previous `?? "true"` default made the adapter write mock "buyer-session"
// tokens + object URLs while orders-client hit the real API → 401 + leaked URLs.
const EXPLICIT_MOCK = process.env.NEXT_PUBLIC_USE_MOCK;
const MOCK =
  EXPLICIT_MOCK === "true" ||
  (EXPLICIT_MOCK !== "false" && (process.env.NODE_ENV !== "production" || !API_BASE));
// B4 — buyer sessions use their own token key (never the admin key).
const BUYER_TOKEN_KEY =
  process.env.NEXT_PUBLIC_ORDERS_TOKEN_KEY ??
  process.env.NEXT_PUBLIC_BUYER_TOKEN_KEY ??
  "wciw_buyer_token";
const MOCK_USER_KEY = "wciw_buyer_user";

/* ------------------------------------------------------------------ */
/* Auth — buyer-only token key (B4: separate from the admin session)   */
/* ------------------------------------------------------------------ */

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(BUYER_TOKEN_KEY);
}

function writeToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(BUYER_TOKEN_KEY, token);
  else window.localStorage.removeItem(BUYER_TOKEN_KEY);
}

function readUser(): BuyerUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOCK_USER_KEY);
    return raw ? (JSON.parse(raw) as BuyerUser) : null;
  } catch {
    return null;
  }
}

function writeUser(user: BuyerUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(MOCK_USER_KEY);
}

function mockDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/* ------------------------------------------------------------------ */
/* Shape mapping — fixer's snake_case backend Order → our display       */
/* ------------------------------------------------------------------ */

function toOrderSummary(o: {
  id: string;
  couple_slug: string;
  status: string;
  config: CoupleConfig;
  price_amount: string;
  price_currency: string;
  bill_url: string | null;
  edit_until: string | null;
  updated_at: string;
}): OrderSummary {
  return {
    id: o.id,
    coupleSlug: String(o.couple_slug ?? o.config.slug ?? ""),
    status: (o.status as OrderSummary["status"]) ?? "draft",
    names: {
      bride: o.config.couple.bride.fullName || o.config.couple.bride.name,
      groom: o.config.couple.groom.fullName || o.config.couple.groom.name,
    },
    theme: o.config.theme,
    price: Number(o.price_amount ?? 39),
    priceCurrency: o.price_currency ?? "MYR",
    billUrl: o.bill_url ?? undefined,
    editUntil: o.edit_until ?? null,
    updatedAt: o.updated_at ?? "",
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * A4 — the backend derives the canonical `couple_slug`. Propagate it back
 * into the live config object the UI holds so share links (`/w/<slug>`), the
 * opening-gate storage key and build-time bakes use the real slug. Mutating
 * the same object reference the UI keeps in state means every create/update
 * path (autosave, save draft, checkout) stays in sync without extra wiring.
 */
function syncBackendSlug(config: CoupleConfig, coupleSlug: string | null | undefined): void {
  if (coupleSlug && config.slug !== coupleSlug) {
    config.slug = coupleSlug;
  }
}

/** B9 — render a server-derived price dynamically (e.g. "RM39", "RM49.50"). */
export function formatPrice(amount: number | string | null | undefined, currency = "MYR"): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const value = n.toFixed(2).replace(/\.00$/, "");
  const symbol = currency === "MYR" ? "RM" : currency;
  return `${symbol}${value}`;
}

const CATALOG_PRICE_AMOUNT = process.env.NEXT_PUBLIC_CATALOG_PRICE_AMOUNT ?? "39";
const CATALOG_PRICE_CURRENCY = process.env.NEXT_PUBLIC_CATALOG_PRICE_CURRENCY ?? "MYR";

/** B9 — single-price MVP catalog badge; env-driven so Phase 3 tiers need no string edits. */
export function catalogPrice(): string {
  return formatPrice(CATALOG_PRICE_AMOUNT, CATALOG_PRICE_CURRENCY);
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function signIn(email: string, password: string): Promise<BuyerUser> {
  const user: BuyerUser = { email, name: email.split("@")[0] };
  // Mock/dev mode: accept any credentials so the buyer flow can be demoed
  // before the backend auth is wired up.
  if (MOCK) {
    writeToken("buyer-session");
    writeUser(user);
    return mockDelay(user);
  }
  // Real mode: POST /auth/login returns the Cognito IdToken (mirrors the
  // admin client's Cognito flow — the API Gateway authorizer wants IdTokens).
  const env = await fetchRetry<Envelope<{ IdToken?: string; id_token?: string; ExpiresIn?: number }>>(
    `${API_BASE}/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
  );
  if (!env.success || env.error) {
    throw new ApiError(env.error?.code ?? "UNAUTHORIZED", env.error?.message ?? "Login failed");
  }
  const idToken = env.data?.IdToken ?? env.data?.id_token;
  if (!idToken) throw new ApiError("UNAUTHORIZED", "Login failed");
  writeToken(idToken);
  writeUser(user);
  return user;
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<BuyerUser> {
  const user: BuyerUser = { email: input.email, name: input.name };
  if (MOCK) {
    writeToken("buyer-session");
    writeUser(user);
    return mockDelay(user);
  }
  const env = await fetchRetry<Envelope<{ message?: string; sub?: string }>>(
    `${API_BASE}/auth/signup`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name, email: input.email, password: input.password }),
    },
  );
  if (!env.success || env.error) {
    throw new ApiError(env.error?.code ?? "INTERNAL_ERROR", env.error?.message ?? "Signup failed");
  }
  // Signup creates the account; sign in to obtain an IdToken for the session.
  return signIn(input.email, input.password);
}

export async function signOut(): Promise<void> {
  writeToken(null);
  writeUser(null);
  return mockDelay(undefined, 100);
}

export function isSignedIn(): boolean {
  return Boolean(readToken());
}

export function currentUser(): BuyerUser | null {
  return readUser() ?? (readToken() ? { email: "you@example.com" } : null);
}

export async function createOrder(config: CoupleConfig): Promise<Order> {
  const order = await fixerOrders.createOrder({ package: "standard", config });
  syncBackendSlug(config, order.couple_slug);
  return {
    id: order.id,
    coupleSlug: String(order.couple_slug ?? config.slug ?? ""),
    status: order.status,
    config,
    package: order.package,
    price: Number(order.price_amount ?? 39),
    priceCurrency: order.price_currency ?? "MYR",
    billUrl: order.bill_url ?? undefined,
    editUntil: order.edit_until ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function updateOrder(id: string, config: CoupleConfig): Promise<Order> {
  const order = await fixerOrders.updateOrder(id, { config });
  syncBackendSlug(config, order.couple_slug);
  return {
    id: order.id,
    coupleSlug: String(order.couple_slug ?? config.slug ?? ""),
    status: order.status,
    config,
    package: order.package,
    price: Number(order.price_amount ?? 39),
    priceCurrency: order.price_currency ?? "MYR",
    billUrl: order.bill_url ?? undefined,
    editUntil: order.edit_until ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function getOrder(id: string): Promise<Order> {
  const order = await fixerOrders.getOrder(id);
  syncBackendSlug(order.config, order.couple_slug);
  return {
    id: order.id,
    coupleSlug: String(order.couple_slug ?? order.config.slug ?? ""),
    status: order.status,
    config: order.config,
    package: order.package,
    price: Number(order.price_amount ?? 39),
    priceCurrency: order.price_currency ?? "MYR",
    billUrl: order.bill_url ?? undefined,
    editUntil: order.edit_until ?? null,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

export async function listOrders(): Promise<OrderSummary[]> {
  const orders = await fixerOrders.listOrders();
  return orders.map((o) =>
    toOrderSummary({
      id: o.id,
      couple_slug: o.couple_slug,
      status: o.status,
      config: o.config,
      price_amount: o.price_amount,
      price_currency: o.price_currency,
      bill_url: o.bill_url,
      edit_until: o.edit_until,
      updated_at: o.updated_at,
    }),
  );
}

export async function checkout(id: string): Promise<{ billUrl: string }> {
  const res = await fixerOrders.checkout(id);
  return { billUrl: res.bill_url };
}

/* ------------------------------------------------------------------ */
/* Image upload — POST /orders/{id}/images then PUT the presigned URL   */
/* ------------------------------------------------------------------ */

export interface UploadImageInput {
  file: Blob;
  filename: string;
  contentType: string;
}

export interface UploadImageResult {
  /** Public CDN URL — this is what goes into CoupleConfig (gallery[].src etc.). */
  cdnUrl: string;
  /** Storage key returned by the backend (informational). */
  key?: string;
}

/**
 * Upload an image for an order.
 *
 * Contract (backend lane): `POST /orders/{id}/images` with body
 * `{filename, contentType}` → `{ uploadUrl, key, cdnUrl }`, then the browser
 * does `PUT uploadUrl` with the raw bytes + Content-Type. The returned `cdnUrl`
 * is stored into the live CoupleConfig.
 *
 * This implementation is tolerant to the exact field casing (accepts both
 * `uploadUrl`/`upload_url` and `cdnUrl`/`cdn_url`) so a finalized backend with
 * either naming still works. In mock mode it falls back to a local object URL
 * so the studio stays demoable without a backend.
 */
export async function uploadImage(orderId: string, input: UploadImageInput): Promise<UploadImageResult> {
  if (MOCK) {
    // Mock: create a local object URL from the file so the preview updates and
    // the flow is fully demoable offline. (Object URLs are session-scoped; in
    // real mode the CDN URL persists in the order config.)
    const url = URL.createObjectURL(input.file);
    return mockDelay({ cdnUrl: url, key: `mock/${input.filename}` }, 700);
  }

  // 1) Ask the backend for a presigned upload URL.
  const env = await fetchRetry<Envelope<Record<string, unknown>>>(
    `${API_BASE}/orders/${encodeURIComponent(orderId)}/images`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${readToken() ?? ""}` },
      body: JSON.stringify({ filename: input.filename, contentType: input.contentType }),
    },
  );
  if (!env.success || env.error) {
    throw new ApiError(env.error?.code ?? "INTERNAL_ERROR", env.error?.message ?? "Upload failed");
  }
  const data = env.data ?? {};
  const uploadUrl = String(data.uploadUrl ?? data.upload_url ?? "");
  const cdnUrl = String(data.cdnUrl ?? data.cdn_url ?? "");
  if (!uploadUrl) throw new ApiError("INTERNAL_ERROR", "No upload URL returned");
  if (!cdnUrl) throw new ApiError("INTERNAL_ERROR", "No CDN URL returned");

  // 2) PUT the raw bytes to the presigned URL.
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": input.contentType },
    body: input.file,
  });
  if (!put.ok) throw new ApiError("INTERNAL_ERROR", `Upload to storage failed (${put.status})`);

  return { cdnUrl, key: String(data.key ?? "") };
}
