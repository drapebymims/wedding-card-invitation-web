import { Suspense } from "react";
import Studio from "@/components/buyer/Studio";

export const metadata = {
  title: "Studio",
  description: "Build your wedding invitation card — live preview, save draft, publish.",
};

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--c-bg)] px-5">
          <p className="text-sm text-[var(--c-muted)]">Loading studio…</p>
        </div>
      }
    >
      <Studio />
    </Suspense>
  );
}
