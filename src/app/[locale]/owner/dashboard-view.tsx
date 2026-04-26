"use client";

import { useRouter, useSearchParams, usePathname, useParams } from "next/navigation";
import {
  Coins,
  Bed,
  Percent,
  TrendingUp,
  CalendarCheck,
  ChevronRight,
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
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, formatShortDate, cn } from "@/lib/utils";
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
  payout: number;
  bookings: number;
  nights: number;
  availableNights: number;
  occupancy: number;
  adr: number;
  revpar: number;
  avgStay: number;
};

type Monthly = {
  key: string;
  label: string;
  revenue: number;
  nights: number;
  bookings: number;
  occupancy: number;
};

type PropertyBucket = {
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  revenue: number;
  nights: number;
  bookings: number;
};

type Upcoming = {
  id: string;
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  currency: string;
};

type PropertyRow = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  basePrice: number;
  cleaningFee: number;
  reservationCount: number;
};

export function OwnerDashboardView({
  locale,
  welcome,
  range,
  kpis,
  monthly,
  byProperty,
  upcoming,
  properties,
  labels,
}: {
  locale: Locale;
  welcome: string;
  range: string;
  kpis: Kpis;
  monthly: Monthly[];
  byProperty: PropertyBucket[];
  upcoming: Upcoming[];
  properties: PropertyRow[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const routeParams = useParams();
  const localeForLink = (routeParams?.locale as string) ?? locale;

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

  const goToApartment = (id: string) =>
    router.push(`/${localeForLink}/owner/apartments/${id}`);

  return (
    <div className="space-y-5">
      <PageHeader title={welcome} />

      {/* PERIOD CHIPS — same style as reports */}
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
        <div className="flex gap-2 pb-1">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors",
                range === r
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-sm shadow-indigo-500/30"
                  : "border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
              )}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* HERO CARD: revenue */}
      <div className="rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-indigo-500 via-indigo-500 to-violet-600 p-5 text-white shadow-lg shadow-indigo-500/20 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-white/80">
              {labels.kpiRevenue} · {rangeLabels[range] ?? range}
            </div>
            <div className="mt-1 text-3xl font-bold sm:text-4xl">
              {formatCurrency(kpis.revenue, "AED", locale)}
            </div>
            <div className="mt-1 text-sm text-white/80">
              {kpis.bookings} {labels.kpiBookings.toLowerCase()} · {kpis.nights}{" "}
              {labels.kpiNights.toLowerCase()}
            </div>
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur-sm">
            <Coins className="h-6 w-6" />
          </div>
        </div>

        {/* compact mini-KPIs inside hero */}
        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-3">
          <HeroKpi
            label={labels.kpiOccupancy}
            value={`${(kpis.occupancy * 100).toFixed(0)}%`}
            icon={<Percent className="h-3.5 w-3.5" />}
          />
          <HeroKpi
            label={labels.kpiAdr}
            value={formatCurrency(kpis.adr, "AED", locale)}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
          <HeroKpi
            label={labels.kpiRevpar}
            value={formatCurrency(kpis.revpar, "AED", locale)}
            icon={<ArrowUpRight className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {/* Revenue trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>{labels.monthlyRevenue}</CardTitle>
        </CardHeader>
        <CardBody className="h-64 sm:h-72">
          {monthly.some((m) => m.revenue > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,130,0.15)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="rgba(120,120,130,0.6)"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="rgba(120,120,130,0.6)"
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v, "AED", locale)}
                  labelStyle={{ color: "#0c0d10", fontWeight: 600 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    boxShadow: "0 6px 24px rgba(15, 23, 42, 0.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#revArea)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label={labels.noData} />
          )}
        </CardBody>
      </Card>

      {/* My properties — visual cards */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">{labels.properties}</h2>
          <button
            onClick={() => router.push(`/${localeForLink}/owner/apartments`)}
            className="text-sm font-medium text-[var(--color-brand)] hover:underline"
          >
            {labels.viewAll ?? "View all"}
          </button>
        </div>
        {properties.length === 0 ? (
          <Card className="grid place-items-center px-6 py-10 text-sm text-[var(--color-muted)]">
            {labels.noProperties}
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => {
              const propRev = byProperty.find((b) => b.propertyId === p.id)?.revenue ?? 0;
              return (
                <button
                  key={p.id}
                  onClick={() => goToApartment(p.id)}
                  className="group flex items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span
                    className="w-1.5 shrink-0"
                    style={{ background: p.color }}
                  />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{p.name}</div>
                        {p.address && (
                          <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                            {p.address}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-brand)]" />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <div>
                        <div className="text-xs text-[var(--color-muted)]">
                          {labels.kpiRevenue}
                        </div>
                        <div className="text-base font-bold">
                          {formatCurrency(propRev, "AED", locale)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--color-muted)]">
                          {labels.basePrice}
                        </div>
                        <div className="text-sm font-semibold text-[var(--color-muted)]">
                          {formatCurrency(p.basePrice, "AED", locale)}/n
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                      <CalendarCheck className="h-3 w-3" />
                      {p.reservationCount} {labels.reservations.toLowerCase()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming reservations - timeline list */}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <CalendarCheck className="-mt-0.5 mr-1.5 inline h-4 w-4" />
              {labels.upcoming}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-1">
            {upcoming.map((u) => {
              const checkIn = new Date(u.checkIn);
              const day = checkIn.getDate();
              const month = checkIn
                .toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
                  month: "short",
                })
                .toUpperCase();
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[var(--color-surface-2)] text-center leading-tight">
                    <div>
                      <div className="text-base font-bold">{day}</div>
                      <div className="text-[9px] uppercase tracking-wider text-[var(--color-muted)]">
                        {month}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: u.propertyColor }}
                      />
                      <div className="truncate text-sm font-semibold">
                        {u.guestName ?? labels.guest}
                      </div>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                      {u.propertyName} · {formatShortDate(u.checkIn, locale)} →{" "}
                      {formatShortDate(u.checkOut, locale)} · {u.nights}n
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {formatCurrency(u.totalPrice, u.currency || "AED", locale)}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}
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
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-bold sm:text-lg">{value}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-[var(--color-muted)]">
      {label}
    </div>
  );
}
