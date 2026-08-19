import type { CoupleConfig } from "./types";
import { ApiError, fetchRetry, type Envelope } from "./api";
import { blankCoupleConfig } from "./starter-config";

/**
 * Couple orders API client — the buyer-facing "my cards" / studio backend.
 *
 * Mirrors the Phase 1 orders contract: every endpoint returns
 * `{success, data, error}` and reads are `data.data`. Auth reuses the shared
 * admin token key (`wciw_admin_token`) so the buyer portal shares the session
 * with /admin — the token is whatever the existing auth flow (Cognito OAuth /
 * USER_PASSWORD) stored there. The token key is configurable via
 * `NEXT_PUBLIC_ORDERS_TOKEN_KEY` so a different buyer auth mode can be wired
 * without touching this module. Defaults to the buyer token key
 * (`wciw_buyer_token`) so buyer auth agrees with lib/buyer/orders-adapter.ts by
 * default; the admin session lives under a separate key.
 *
 * This is a client/browser module (static-export safe). It does NOT modify
 * lib/api.ts — it only reuses its envelope helpers.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
// B5: mock only when explicitly requested, OR when we can't reach a real API
// (non-production build, or no API base configured). Never default to mock in
// production with a real API base — that would silently serve fake data.
const EXPLICIT_MOCK = process.env.NEXT_PUBLIC_USE_MOCK;
const MOCK =
  EXPLICIT_MOCK === "true" ||
  (EXPLICIT_MOCK !== "false" && (process.env.NODE_ENV !== "production" || !API_BASE));
const TOKEN_KEY = process.env.NEXT_PUBLIC_ORDERS_TOKEN_KEY ?? "wciw_buyer_token";

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "building"
  | "live"
  | "expired"
  | "cancelled";

export type OrderPackage = "standard";

export interface Order {
  id: string;
  couple_slug: string;
  config: CoupleConfig;
  package: OrderPackage;
  /** Price as a STRING (MYR), e.g. "39.00" — server-derived, client price ignored. */
  price_amount: string;
  price_currency: string;
  status: OrderStatus;
  bill_code: string | null;
  bill_url: string | null;
  paid_at: string | null;
  live_until: string | null;
  edit_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutResult {
  bill_url: string;
  bill_code: string;
}

export interface CreateOrderInput {
  package: OrderPackage;
  config: CoupleConfig;
}

export interface UpdateOrderInput {
  config?: CoupleConfig;
  package?: OrderPackage;
}

/** Reads the shared auth token (same key as the admin client). */
export function getOrdersToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function unwrap<T>(env: Envelope<T>): T {
  if (!env.success || env.error) {
    throw new ApiError(env.error?.code ?? "INTERNAL_ERROR", env.error?.message ?? "Request failed");
  }
  return env.data;
}

async function ordersRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getOrdersToken();
  if (!token) throw new ApiError("UNAUTHORIZED", "Not signed in");
  const res = await fetchRetry<Envelope<T>>(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return unwrap(res);
}

function mockDelay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function mockOrder(): Order {
  const now = new Date().toISOString();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    couple_slug: "draft",
    config: blankCoupleConfig("refined"),
    package: "standard",
    price_amount: "39.00",
    price_currency: "MYR",
    status: "draft",
    bill_code: null,
    bill_url: null,
    paid_at: null,
    live_until: null,
    edit_until: null,
    created_at: now,
    updated_at: now,
  };
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/** List the current user's orders (auth required). */
export async function listOrders(): Promise<Order[]> {
  if (MOCK || !API_BASE) return mockDelay([mockOrder()]);
  return ordersRequest("/orders");
}

/** Fetch a single order (owner only). */
export async function getOrder(id: string): Promise<Order> {
  if (MOCK || !API_BASE) return mockDelay(mockOrder());
  return ordersRequest(`/orders/${encodeURIComponent(id)}`);
}

/**
 * Create a draft order. Server derives couple_slug + price (client price is
 * ignored). Returns the created order.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (MOCK || !API_BASE) return mockDelay(mockOrder());
  return ordersRequest("/orders", { method: "POST", body: JSON.stringify(input) });
}

/**
 * Update an order while editable (draft / awaiting_payment or within
 * edit_until). Throws ApiError with code "CONFLICT" (409) when not editable.
 */
export async function updateOrder(id: string, input: UpdateOrderInput): Promise<Order> {
  if (MOCK || !API_BASE) return mockDelay(mockOrder());
  return ordersRequest(`/orders/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Create a ToyyibPay bill; returns {bill_url, bill_code} and sets awaiting_payment. */
export async function checkout(id: string): Promise<CheckoutResult> {
  if (MOCK || !API_BASE) {
    // B6: mock routes to the thanks page (not dev.toyyibpay.com) so the flow is
    // e2e-testable. Real mode returns the ToyyibPay bill_url.
    const slug = mockOrder().couple_slug || id;
    return mockDelay({
      bill_url: `/checkout/thanks?slug=${encodeURIComponent(slug)}`,
      bill_code: "MOCK",
    });
  }
  return ordersRequest(`/orders/${encodeURIComponent(id)}/checkout`, { method: "POST" });
}

export { ApiError };
