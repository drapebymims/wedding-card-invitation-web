import type { CoupleConfig } from "@/lib/types";

/**
 * Buyer-flow domain types.
 *
 * These describe the orders API contract that the studio and my-cards portal
 * consume. The fixer lane is building the real client (`orders-client.ts`);
 * this file is the shared contract so the UI and the client stay in sync
 * without either side editing the other's files.
 */

export type OrderStatus =
  | "draft"
  | "awaiting_payment"
  | "paid"
  | "building"
  | "live"
  | "expired"
  | "cancelled";

export interface Order {
  id: string;
  coupleSlug: string;
  status: OrderStatus;
  config: CoupleConfig;
  package: string;
  price: number;
  priceCurrency: string;
  billUrl?: string;
  editUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderSummary {
  id: string;
  coupleSlug: string;
  status: OrderStatus;
  names: { bride: string; groom: string };
  theme: CoupleConfig["theme"];
  price: number;
  priceCurrency: string;
  billUrl?: string;
  editUntil?: string | null;
  updatedAt: string;
}

export interface BuyerUser {
  email: string;
  name?: string;
}
