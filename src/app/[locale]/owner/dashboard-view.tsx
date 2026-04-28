"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Percent,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
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

type Monthly = {
  key: string;
  label: string;
  revenue: number;
  nights: number;
  bookings: number;
  occupancy: number;
};

export function OwnerDashboardView({
  locale,
  range,
  kpis,
  monthly,
  labels,
}: {
  locale: Locale;
  range: string;
  kpis: Kpis;
  monthly: Monthly[];
  labels: Record<string, string>;
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
    <div className="space-y-3">
      {/* PERIOD CHIPS */}
      <FadeIn delay={0.05}>
        <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
          <div className="flex gap-2 pb-1">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1 text-xs font-semibold transition-all duration-200 active:scale-95",
                  range === r
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow shadow-emerald-700/25"
                    : "border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
                )}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* HERO REVENUE CARD — compact */}
      <FadeIn delay={0.1}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] p-4 text-white sm:p-5"
          style={{
            background:
              "linear-gradient(135deg, #4f8a6f 0%, #3d6f57 55%, #2f5a47 100%)",
            boxShadow:
              "0 16px 32px -14px rgba(47,90,71,0.4), 0 6px 16px -10px rgba(79,138,111,0.35)",
          }}
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-emerald-200/20 blur-2xl" />

          <div className="relative">
            <div className="text-[10px] font-medium uppercase tracking-wider text-white/80">
              {labels.kpiRevenue} · {rangeLabels[range] ?? range}
            </div>
            <div className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              <AnimatedNumber
                value={kpis.revenue}
                format={(v) => formatCurrency(v, "AED", locale)}
              />
            </div>
            <div className="mt-0.5 text-xs text-white/80">
              <AnimatedNumber value={kpis.bookings} />{" "}
              {labels.kpiBookings.toLowerCase()} ·{" "}
              <AnimatedNumber value={kpis.nights} />{" "}
              {labels.kpiNights.toLowerCase()}
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-3 gap-2">
            <HeroKpi
              label={labels.kpiOccupancy}
              value={`${(kpis.occupancy * 100).toFixed(0)}%`}
              icon={<Percent className="h-3 w-3" />}
            />
            <HeroKpi
              label={labels.kpiAdr}
              value={formatCurrency(kpis.adr, "AED", locale)}
              icon={<TrendingUp className="h-3 w-3" />}
            />
            <HeroKpi
              label={labels.kpiRevpar}
              value={formatCurrency(kpis.revpar, "AED", locale)}
              icon={<ArrowUpRight className="h-3 w-3" />}
            />
          </div>
        </div>
      </FadeIn>

      {/* Revenue trend chart */}
      <FadeIn delay={0.15}>
        <Card>
          <CardHeader>
            <CardTitle>{labels.monthlyRevenue}</CardTitle>
          </CardHeader>
          <CardBody className="h-48 sm:h-56">
            {monthly.some((m) => m.revenue > 0) ? (
              <ResponsiveContainer width="100%" height={192}>
                <AreaChart data={monthly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f8a6f" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#4f8a6f" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.12)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    stroke="rgba(120,120,130,0.6)"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="rgba(120,120,130,0.6)"
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v) || 0, "AED", locale)}
                    labelStyle={{ color: "#0c0d10", fontWeight: 600 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      boxShadow: "0 6px 24px rgba(15, 23, 42, 0.08)",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4f8a6f"
                    strokeWidth={2}
                    fill="url(#revArea)"
                    isAnimationActive
                    animationDuration={900}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-[var(--color-muted)]">
                {labels.noData}
              </div>
            )}
          </CardBody>
        </Card>
      </FadeIn>
    </div>
  );
}

function HeroKpi({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm transition-colors hover:bg-white/20">
      <div className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-white/80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 text-sm font-bold sm:text-base">{value}</div>
    </div>
  );
}
