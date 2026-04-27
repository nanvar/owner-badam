"use client";

import { useRouter, useSearchParams, usePathname, useParams } from "next/navigation";
import {
  Percent,
  TrendingUp,
  CalendarCheck,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Trophy,
  Star,
  Crown,
  Rocket,
  Sparkles,
  Medal,
  Lock,
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
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/ui/progress-ring";
import { FadeIn, StaggerList, StaggerItem, HoverLift } from "@/components/ui/motion";
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

type Trend = {
  delta: number;
  pct: number;
  direction: "up" | "down" | "flat";
};

type Score = {
  value: number;
  grade: "A+" | "A" | "B+" | "B" | "C" | "—";
  label: string;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: "trophy" | "flame" | "star" | "crown" | "rocket" | "sparkles" | "medal";
  tone: "amber" | "emerald" | "indigo" | "rose" | "sky";
  unlocked: boolean;
  progress?: number;
};

const achievementIcon = {
  trophy: Trophy,
  flame: Flame,
  star: Star,
  crown: Crown,
  rocket: Rocket,
  sparkles: Sparkles,
  medal: Medal,
} as const;

const toneClasses = {
  amber: "from-amber-400 to-orange-500 text-white shadow-amber-500/30",
  emerald: "from-emerald-400 to-teal-500 text-white shadow-emerald-500/30",
  indigo: "from-indigo-400 to-violet-500 text-white shadow-indigo-500/30",
  rose: "from-rose-400 to-pink-500 text-white shadow-rose-500/30",
  sky: "from-sky-400 to-cyan-500 text-white shadow-sky-500/30",
} as const;

export function OwnerDashboardView({
  locale,
  welcome,
  range,
  kpis,
  monthly,
  byProperty,
  upcoming,
  properties,
  trend,
  streak,
  score,
  achievements,
  lifetime,
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
  trend: Trend;
  streak: number;
  score: Score;
  achievements: Achievement[];
  lifetime: { nights: number; revenue: number };
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

  const unlocked = achievements.filter((a) => a.unlocked);
  const nextLocked = achievements.find((a) => !a.unlocked);
  const featuredAchievements = [...unlocked.slice(-3), nextLocked].filter(
    Boolean,
  ) as Achievement[];

  return (
    <div className="space-y-5">
      <PageHeader title={welcome} />

      {/* PERIOD CHIPS */}
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
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white shadow-md shadow-indigo-500/30"
                    : "border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]",
                )}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* HERO REVENUE CARD with score ring */}
      <FadeIn delay={0.1}>
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 p-5 text-white shadow-xl shadow-indigo-500/25 sm:p-7">
          {/* decorative blob */}
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-violet-300/15 blur-2xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/80">
                {labels.kpiRevenue} · {rangeLabels[range] ?? range}
                <TrendChip trend={trend} />
              </div>
              <div className="mt-1.5 text-3xl font-bold tracking-tight sm:text-[2.5rem]">
                <AnimatedNumber
                  value={kpis.revenue}
                  format={(v) => formatCurrency(v, "AED", locale)}
                />
              </div>
              <div className="mt-1 text-sm text-white/80">
                <AnimatedNumber value={kpis.bookings} />{" "}
                {labels.kpiBookings.toLowerCase()} ·{" "}
                <AnimatedNumber value={kpis.nights} />{" "}
                {labels.kpiNights.toLowerCase()}
              </div>
            </div>

            <ProgressRing
              value={score.value / 100}
              size={88}
              stroke={8}
              color="#ffffff"
              trackColor="rgba(255,255,255,0.18)"
            >
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-wider text-white/70">
                  Score
                </div>
                <div className="text-xl font-bold leading-none">{score.grade}</div>
              </div>
            </ProgressRing>
          </div>

          {/* mini KPIs */}
          <div className="relative mt-5 grid grid-cols-3 gap-2">
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

          {/* Score label */}
          <div className="relative mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            {score.label}
          </div>
        </div>
      </FadeIn>

      {/* GAMIFICATION ROW */}
      <FadeIn delay={0.15}>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Streak */}
          <Card className="overflow-hidden">
            <CardBody className="flex items-center gap-4">
              <div
                className={cn(
                  "grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-lg",
                  streak > 0
                    ? "from-orange-400 to-rose-500 text-white shadow-rose-500/30 animate-float"
                    : "from-[var(--color-surface-2)] to-[var(--color-surface-2)] text-[var(--color-muted)]",
                )}
              >
                <Flame className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight">
                    <AnimatedNumber value={streak} />
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">
                    {streak === 1 ? "month" : "months"}
                  </span>
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  Active streak
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Lifetime stats */}
          <Card className="overflow-hidden">
            <CardBody className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
                <Trophy className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tracking-tight">
                    <AnimatedNumber
                      value={lifetime.revenue}
                      format={(v) => formatCurrency(v, "AED", locale)}
                    />
                  </span>
                </div>
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  Lifetime · <AnimatedNumber value={lifetime.nights} /> nights
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </FadeIn>

      {/* ACHIEVEMENTS */}
      {featuredAchievements.length > 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle>
                <Star className="-mt-0.5 mr-1.5 inline h-4 w-4 text-amber-500" />
                Achievements
                <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                  {unlocked.length} / {achievements.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              <StaggerList className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {featuredAchievements.map((a) => (
                  <AchievementBadge key={a.id} a={a} />
                ))}
              </StaggerList>
            </CardBody>
          </Card>
        </FadeIn>
      )}

      {/* Revenue trend chart */}
      <FadeIn delay={0.25}>
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
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
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
                    formatter={(v) => formatCurrency(Number(v) || 0, "AED", locale)}
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
                    isAnimationActive
                    animationDuration={1100}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={labels.noData} />
            )}
          </CardBody>
        </Card>
      </FadeIn>

      {/* My properties */}
      <FadeIn delay={0.3}>
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
            <StaggerList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => {
                const propRev =
                  byProperty.find((b) => b.propertyId === p.id)?.revenue ?? 0;
                const propNights =
                  byProperty.find((b) => b.propertyId === p.id)?.nights ?? 0;
                return (
                  <StaggerItem key={p.id}>
                    <HoverLift>
                      <button
                        onClick={() => goToApartment(p.id)}
                        className="group flex w-full items-stretch gap-0 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white text-left shadow-sm transition-shadow hover:shadow-lg"
                      >
                        <span
                          className="w-1.5 shrink-0"
                          style={{ background: p.color }}
                        />
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold">
                                {p.name}
                              </div>
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
                                <AnimatedNumber
                                  value={propRev}
                                  format={(v) =>
                                    formatCurrency(v, "AED", locale)
                                  }
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-[var(--color-muted)]">
                                {labels.kpiNights}
                              </div>
                              <div className="text-sm font-semibold text-[var(--color-muted)]">
                                <AnimatedNumber value={propNights} />
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                            <CalendarCheck className="h-3 w-3" />
                            {p.reservationCount}{" "}
                            {labels.reservations.toLowerCase()}
                          </div>
                        </div>
                      </button>
                    </HoverLift>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </section>
      </FadeIn>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <FadeIn delay={0.35}>
          <Card>
            <CardHeader>
              <CardTitle>
                <CalendarCheck className="-mt-0.5 mr-1.5 inline h-4 w-4" />
                {labels.upcoming}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <StaggerList className="space-y-1">
                {upcoming.map((u) => {
                  const checkIn = new Date(u.checkIn);
                  const day = checkIn.getDate();
                  const month = checkIn
                    .toLocaleDateString(
                      locale === "ru" ? "ru-RU" : "en-US",
                      { month: "short" },
                    )
                    .toUpperCase();
                  return (
                    <StaggerItem
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
                          {u.propertyName} ·{" "}
                          {formatShortDate(u.checkIn, locale)} →{" "}
                          {formatShortDate(u.checkOut, locale)} · {u.nights}n
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          {formatCurrency(
                            u.totalPrice,
                            u.currency || "AED",
                            locale,
                          )}
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggerList>
            </CardBody>
          </Card>
        </FadeIn>
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
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm transition-colors hover:bg-white/20">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-bold sm:text-lg">{value}</div>
    </div>
  );
}

function TrendChip({ trend }: { trend: Trend }) {
  if (trend.direction === "flat") return null;
  const Icon = trend.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
        trend.direction === "up"
          ? "bg-emerald-400/30 text-emerald-50"
          : "bg-rose-400/30 text-rose-50",
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(trend.pct * 100).toFixed(0)}%
    </span>
  );
}

function AchievementBadge({ a }: { a: Achievement }) {
  const Icon = achievementIcon[a.icon];
  if (a.unlocked) {
    return (
      <StaggerItem>
        <div
          className={cn(
            "flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br p-3 text-center shadow-md",
            toneClasses[a.tone],
          )}
        >
          <Icon className="h-5 w-5" />
          <div className="text-[11px] font-bold leading-tight">{a.title}</div>
          <div className="text-[9px] uppercase tracking-wider opacity-80">
            unlocked
          </div>
        </div>
      </StaggerItem>
    );
  }
  return (
    <StaggerItem>
      <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 text-center text-[var(--color-muted)]">
        <Lock className="h-5 w-5" />
        <div className="text-[11px] font-bold leading-tight">{a.title}</div>
        {a.progress !== undefined && (
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full bg-[var(--color-brand)] transition-all duration-700"
              style={{ width: `${Math.round(a.progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    </StaggerItem>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-full place-items-center text-sm text-[var(--color-muted)]">
      {label}
    </div>
  );
}
