"use client";

// v2 owner dashboard. Mobile-first layout matching the new design:
//   • Warm gradient hero with "Welcome Back, <name>"
//   • Quick-stats banner (chevron-link to detail)
//   • Earnings card with primary CTA
//   • Services pill row (horizontal scroll)
//   • Properties carousel preview
//   • Latest activity preview
//
// Detailed analytics (KPIs grid + chart) collapse behind a "Show
// details" button so the home view stays tight on mobile. Easy mode
// toggle hides them entirely.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  TrendingUp,
  Wallet,
  FileText,
  Building2,
  BedDouble,
  Bell,
  Calendar,
  Eye,
  EyeOff,
  Sparkles,
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
import { AnimatedNumber } from "@/components/ui/animated-number";
import { MonthSelector } from "../admin/company/month-selector";
import { setEasyModeAction } from "@/app/actions/user-prefs";
import { formatCurrency } from "@/lib/utils";
import {
  HeroGradient,
  SoftCard,
  SectionTitle,
  PillChip,
  HorizontalScroll,
  CategoryBadge,
} from "@/components/owner/v2/primitives";
import type { Locale } from "@/i18n/config";

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
  monthOptions,
  selectedMonth,
  basePath,
  periodLabel,
  easyMode = false,
  kpis,
  monthly,
  labels,
  userName,
}: {
  locale: Locale;
  monthOptions: { key: string; label: string }[];
  selectedMonth: string;
  basePath: string;
  periodLabel: string;
  easyMode?: boolean;
  kpis: Kpis;
  monthly: Monthly[];
  labels: Record<string, string>;
  userName?: string | null;
}) {
  const router = useRouter();
  const [pending, startTx] = useTransition();
  const [showDetails, setShowDetails] = useState(false);
  const toggleEasy = () => {
    startTx(async () => {
      await setEasyModeAction(!easyMode);
      router.refresh();
    });
  };
  const firstName = (userName ?? "there").split(/\s+/)[0];

  return (
    <div className="space-y-4">
      {/* ===== Hero ===== */}
      <HeroGradient tone="warm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
              Welcome back
            </div>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
              {firstName}
            </h1>
          </div>
          <button
            type="button"
            onClick={toggleEasy}
            disabled={pending}
            title={easyMode ? "Switch to detailed view" : "Switch to easy view"}
            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/30 disabled:opacity-60"
          >
            {easyMode ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            {easyMode ? "Easy" : "Detailed"}
          </button>
        </div>

        <Link
          href={`${basePath}/reports`}
          className="mt-5 flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2.5 backdrop-blur transition-colors hover:bg-white/25"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/25">
            <FileText className="h-4 w-4 text-white" />
          </span>
          <span className="flex-1 text-sm font-medium text-white">
            Open the latest settlement report
          </span>
          <ChevronRight className="h-4 w-4 text-white/80" />
        </Link>
      </HeroGradient>

      {/* ===== Earnings card ===== */}
      <SoftCard className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Earnings · {periodLabel}
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums sm:text-4xl">
              <AnimatedNumber
                value={kpis.revenue}
                format={(n) => formatCurrency(n, "AED", locale)}
              />
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
              <TrendingUp className="h-3 w-3" />
              {kpis.bookings} bookings · {kpis.nights} nights
            </div>
          </div>
          <MonthSelector
            options={monthOptions}
            selected={selectedMonth}
            basePath={basePath}
            allowAll
          />
        </div>
      </SoftCard>

      {/* ===== Detailed analytics — hidden in easy mode and behind
              a "Show details" toggle on the regular dashboard. ===== */}
      {!easyMode && (
        <>
          <div className="flex items-center justify-between px-1">
            <SectionTitle>Analytics</SectionTitle>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="text-xs font-medium text-[var(--color-brand)] hover:underline"
            >
              {showDetails ? "Hide details" : "Show details"}
            </button>
          </div>
          {showDetails && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <KpiTile
                  label={labels.kpiOccupancy}
                  value={`${Math.round(kpis.occupancy)}%`}
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                />
                <KpiTile
                  label={labels.kpiAdr}
                  value={formatCurrency(kpis.adr, "AED", locale)}
                  icon={<Wallet className="h-3.5 w-3.5" />}
                />
                <KpiTile
                  label={labels.kpiRevpar}
                  value={formatCurrency(kpis.revpar, "AED", locale)}
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                />
                <KpiTile
                  label={labels.kpiBookings}
                  value={String(kpis.bookings)}
                  icon={<Calendar className="h-3.5 w-3.5" />}
                />
              </div>
              <SoftCard className="!p-3">
                <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                  {labels.monthlyRevenue}
                </div>
                <div className="h-44">
                  {monthly.some((m) => m.revenue > 0) ? (
                    <ResponsiveContainer width="100%" height={176}>
                      <AreaChart
                        data={monthly}
                        margin={{ top: 4, right: 8, left: -12, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="revAreaV2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#b73f66" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="#b73f66" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="rgba(120,120,130,0.12)"
                        />
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
                          stroke="#b73f66"
                          strokeWidth={2}
                          fill="url(#revAreaV2)"
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
                </div>
              </SoftCard>
            </>
          )}
        </>
      )}

      {/* ===== Quick services ===== */}
      <div>
        <SectionTitle>Services</SectionTitle>
        <HorizontalScroll>
          <PillChip
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Properties"
            href={`${basePath}/properties`}
            tone="brand"
          />
          <PillChip
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Calendar"
            href={`${basePath}/calendar`}
          />
          <PillChip
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Reports"
            href={`${basePath}/reports`}
          />
          <PillChip
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="Payments"
            href={`${basePath}/payments`}
          />
          <PillChip
            icon={<BedDouble className="h-3.5 w-3.5" />}
            label="Request stay"
            href={`${basePath}/stay-requests`}
          />
          <PillChip
            icon={<Bell className="h-3.5 w-3.5" />}
            label="Activity"
            href={`${basePath}/activity`}
          />
        </HorizontalScroll>
      </div>

      {/* ===== Tip / coming-up callout — placeholder until we wire
              the next reservation lookup ===== */}
      <SoftCard className="!p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-700">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Owner tip</div>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Open <CategoryBadge tone="warm">Properties</CategoryBadge> to see
              cover photos and the visit log for each home.
            </p>
          </div>
        </div>
      </SoftCard>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <SoftCard className="!p-3">
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        <span>{label}</span>
        <span className="text-[var(--color-muted)]/70">{icon}</span>
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </SoftCard>
  );
}
