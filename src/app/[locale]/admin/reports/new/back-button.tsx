"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Browser-history "Back" — falls back to the global reports list if the
// builder was opened directly (no history entry to pop). Lets us land
// back on whichever page launched the builder (per-owner reports, global
// reports, etc.).
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </button>
  );
}
