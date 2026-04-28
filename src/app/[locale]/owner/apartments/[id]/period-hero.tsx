"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Percent,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FadeIn } from "@/components/ui/motion";
import { formatCurrency, cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";

const RANGE_OPTIONS = [
  "this-month",
  "last-month",
  "last-30",
  "last-90",
  "ytd",
] as const;

type Kpis = {
  revenue: number;
  bookings: number;
  nights: number;
  availableNights: number;
  occupancy: number;
  adr: number;
  revpar: number;
};

export function PeriodHero({
  locale,
  range,
  kpis,
  labels,
}: {
  locale: Locale;
  range: string;
  kpis: Kpis;
  labels: {
    revenue: string;
    bookings: string;
    nights: string;
    occupancy: string;
    adr: string;
    revpar: string;
    thisMonth: string;
    lastMonth: string;
    last30: string;
    last90: string;
    ytd: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const setRange = (r: string) => {
    const next = new URLSearchParams(sp);
    next.set("range", r);
    router.push(`${pathname}?${next.toString()}`);
  };

  const rangeLabels: Record<string, string> = {
    "this-month": labels.thisMonth,
    "last-month": labels.lastMonth,
    "last-30": labels.last30,
    "last-90": labels.last90,
    ytd: labels.ytd,
  };

  return (
    <>
      <FadeIn delay={0.05}>
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
          <div className="flex gap-2 pb-1">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95",
                  range === r
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-md shadow-emerald-700/25"
                    : "border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
                )}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] p-5 text-white sm:p-7"
          style={{
            background:
              "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 55%, #2f5a47 100%)",
            boxShadow:
              "0 24px 48px -16px rgba(47,90,71,0.45), 0 8px 24px -12px rgba(79,138,111,0.4)",
          }}
        >
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-emerald-200/20 blur-2xl" />

          <div className="relative">
            <div className="text-xs font-medium uppercase tracking-wider text-white/80">
              {labels.revenue} · {rangeLabels[range] ?? range}
            </div>
            <div className="mt-1.5 text-3xl font-bold tracking-tight sm:text-[2.5rem]">
              <AnimatedNumber
                value={kpis.revenue}
                format={(v) => formatCurrency(v, "AED", locale)}
              />
            </div>
            <div className="mt-1 text-sm text-white/80">
              <AnimatedNumber value={kpis.bookings} />{" "}
              {labels.bookings.toLowerCase()} ·{" "}
              <AnimatedNumber value={kpis.nights} />{" "}
              {labels.nights.toLowerCase()}
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            <Mini
              label={labels.occupancy}
              value={`${(kpis.occupancy * 100).toFixed(0)}%`}
              icon={<Percent className="h-3.5 w-3.5" />}
            />
            <Mini
              label={labels.adr}
              value={formatCurrency(kpis.adr, "AED", locale)}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            />
            <Mini
              label={labels.revpar}
              value={formatCurrency(kpis.revpar, "AED", locale)}
              icon={<ArrowUpRight className="h-3.5 w-3.5" />}
            />
          </div>
        </div>
      </FadeIn>
    </>
  );
}

function Mini({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm transition-colors hover:bg-white/20">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-bold sm:text-lg">{value}</div>
    </div>
  );
}
