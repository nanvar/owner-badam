"use client";

// Greeting banner shown at the top of the owner dashboard. Pulls
// double duty: warm welcome + a place to surface today's headline
// stat (next check-in, settlement due, etc). Time-of-day aware
// greeting keeps it feeling personal without needing AI fluff.

import { Sparkles } from "lucide-react";
import { FadeIn } from "@/components/ui/motion";

function pickGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

export function OwnerHero({
  name,
  subtitle,
  illustration,
}: {
  name: string | null;
  subtitle?: string;
  /** Optional illustration path served from /public. */
  illustration?: string;
}) {
  const first = (name ?? "there").split(/\s+/)[0];
  return (
    <FadeIn delay={0.04}>
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-5 text-white sm:px-6 sm:py-6"
        style={{
          background:
            "linear-gradient(120deg, #2f5a47 0%, #4f8a6f 55%, #6ba384 100%)",
          boxShadow:
            "0 18px 36px -18px rgba(47,90,71,0.45), 0 8px 22px -16px rgba(79,138,111,0.4)",
        }}
      >
        {/* Decorative blobs — soft, animated would be nice but pure
            CSS keeps the bundle light. */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-emerald-200/20 blur-3xl" />

        <div className="relative flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75">
              <Sparkles className="h-3 w-3" />
              {pickGreeting()}
            </div>
            <div className="mt-1 truncate text-2xl font-bold sm:text-3xl">
              {first}
            </div>
            {subtitle && (
              <div className="mt-1 max-w-md text-sm text-white/85">
                {subtitle}
              </div>
            )}
          </div>
          {illustration && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={illustration}
              alt=""
              className="h-20 w-20 shrink-0 object-contain drop-shadow-lg sm:h-24 sm:w-24"
            />
          )}
        </div>
      </div>
    </FadeIn>
  );
}
