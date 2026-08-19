import { Suspense } from "react";
import CheckoutThanks from "@/components/buyer/CheckoutThanks";

export const metadata = {
  title: "Terima kasih",
  description: "Your card is being published.",
};

export default function CheckoutThanksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--c-bg)] px-5">
          <p className="text-sm text-[var(--c-muted)]">Loading…</p>
        </div>
      }
    >
      <CheckoutThanks />
    </Suspense>
  );
}
