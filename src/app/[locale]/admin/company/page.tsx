import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import {
  Wallet,
  Receipt,
  Users,
  TrendingUp,
  Clock,
  CalendarDays,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency } from "@/lib/utils";
import {
  DashboardCharts,
  type MonthlyPoint,
  type PropertyBar,
  type SplitSlice,
} from "./dashboard-charts";

type PropertyAgg = {
  id: string;
  name: string;
  color: string;
  ownerName: string;
  bookings: number;
  totalRevenue: number;
  agencyEarnings: number;
  portalCommissions: number;
  ownerPayout: number;
  upcomingAgency: number;
  upcomingBookings: number;
};

export default async function SuperAdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  const loc = locale as Locale;

  // === Aggregations ===
  // Sum of company-side fields per property using Prisma's groupBy.
  // Realized (upcoming=false) and pipeline (upcoming=true) are computed
  // separately so the dashboard can show "money in hand" vs "money expected".
  const [propertyAggs, upcomingAggs] = await Promise.all([
    prisma.reservation.groupBy({
      by: ["propertyId"],
      where: { upcoming: false },
      _count: { _all: true },
      _sum: {
        totalPrice: true,
        agencyCommission: true,
        portalCommission: true,
        payout: true,
      },
    }),
    prisma.reservation.groupBy({
      by: ["propertyId"],
      where: { upcoming: true },
      _count: { _all: true },
      _sum: {
        totalPrice: true,
        agencyCommission: true,
        portalCommission: true,
        payout: true,
      },
    }),
  ]);
  const upcomingByProp = new Map(
    upcomingAggs.map((a) => [a.propertyId, a]),
  );

  const allPropIds = Array.from(
    new Set([
      ...propertyAggs.map((a) => a.propertyId),
      ...upcomingAggs.map((a) => a.propertyId),
    ]),
  );
  const properties = await prisma.property.findMany({
    where: { id: { in: allPropIds } },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  const propMap = new Map(properties.map((p) => [p.id, p]));
  const realizedByProp = new Map(
    propertyAggs.map((a) => [a.propertyId, a]),
  );

  const propertyTable: PropertyAgg[] = allPropIds
    .map((propId) => {
      const p = propMap.get(propId);
      if (!p) return null;
      const a = realizedByProp.get(propId);
      const u = upcomingByProp.get(propId);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        ownerName: p.owner.name ?? p.owner.email,
        bookings: a?._count._all ?? 0,
        totalRevenue: a?._sum.totalPrice ?? 0,
        agencyEarnings: a?._sum.agencyCommission ?? 0,
        portalCommissions: a?._sum.portalCommission ?? 0,
        ownerPayout: a?._sum.payout ?? 0,
        upcomingAgency: u?._sum.agencyCommission ?? 0,
        upcomingBookings: u?._count._all ?? 0,
      };
    })
    .filter((x): x is PropertyAgg => !!x)
    .sort((a, b) => b.agencyEarnings - a.agencyEarnings);

  // Company expense totals (all-time)
  const companyExpenseAgg = await prisma.companyExpense.aggregate({
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totalCompanyExpenses = companyExpenseAgg._sum.amount ?? 0;
  const companyExpenseCount = companyExpenseAgg._count._all;

  // KPIs
  const totalAgency = propertyTable.reduce((s, p) => s + p.agencyEarnings, 0);
  const totalPortal = propertyTable.reduce((s, p) => s + p.portalCommissions, 0);
  const totalOwnerPayout = propertyTable.reduce(
    (s, p) => s + p.ownerPayout,
    0,
  );
  const totalUpcomingAgency = propertyTable.reduce(
    (s, p) => s + p.upcomingAgency,
    0,
  );
  const totalBookings = propertyTable.reduce((s, p) => s + p.bookings, 0);
  const totalUpcomingBookings = propertyTable.reduce(
    (s, p) => s + p.upcomingBookings,
    0,
  );
  const distinctOwners = new Set(propertyTable.map((p) => p.ownerName)).size;
  // Revenue tile shows realized + upcoming (committed view). Profit and
  // payout tiles use realized only — that's the money already in hand.
  const totalAgencyAll = totalAgency + totalUpcomingAgency;
  const companyNet = totalAgency - totalCompanyExpenses;

  // === Chart data ===
  const topProperties: PropertyBar[] = propertyTable.slice(0, 10).map((p) => ({
    name: p.name,
    color: p.color,
    agencyEarnings: p.agencyEarnings,
  }));

  const split: SplitSlice[] = [
    { label: "Company (agency)", value: totalAgency, color: "#4f8a6f" },
    { label: "Owner payout", value: totalOwnerPayout, color: "#6366f1" },
    { label: "Portal", value: totalPortal, color: "#f59e0b" },
  ];

  // Last 12 months of revenue + expenses, by check-in / expense date.
  const now = new Date();
  const months: { y: number; m: number; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      y: d.getUTCFullYear(),
      m: d.getUTCMonth(),
      label: d.toLocaleDateString(loc === "ru" ? "ru-RU" : "en-GB", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
    });
  }
  const startUtc = new Date(
    Date.UTC(months[0].y, months[0].m, 1),
  );
  const [monthlyAgencyRows, monthlyExpenseRows] = await Promise.all([
    prisma.reservation.findMany({
      where: { checkIn: { gte: startUtc }, upcoming: false },
      select: { checkIn: true, agencyCommission: true },
    }),
    prisma.companyExpense.findMany({
      where: { date: { gte: startUtc } },
      select: { date: true, amount: true },
    }),
  ]);
  const monthly: MonthlyPoint[] = months.map((mo) => {
    const monthStart = Date.UTC(mo.y, mo.m, 1);
    const monthEnd = Date.UTC(mo.y, mo.m + 1, 1);
    const agency = monthlyAgencyRows
      .filter((r) => {
        const t = r.checkIn.getTime();
        return t >= monthStart && t < monthEnd;
      })
      .reduce((s, r) => s + r.agencyCommission, 0);
    const expenses = monthlyExpenseRows
      .filter((e) => {
        const t = e.date.getTime();
        return t >= monthStart && t < monthEnd;
      })
      .reduce((s, e) => s + e.amount, 0);
    return {
      label: mo.label,
      agency: Math.round(agency * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((agency - expenses) * 100) / 100,
    };
  });

  return (
    <div>
      <PageHeader
        title="Company dashboard"
        subtitle={
          <span className="text-sm text-[var(--color-muted)]">
            All-time aggregates across every property and owner.
          </span>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <KpiTile
          label="Company revenue"
          value={formatCurrency(totalAgencyAll, "AED", loc)}
          hint={`incl. upcoming · portal ${formatCurrency(totalPortal, "AED", loc)}`}
          accent="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiTile
          label="Upcoming amount"
          value={formatCurrency(totalUpcomingAgency, "AED", loc)}
          hint={`${totalUpcomingBookings} pipeline`}
          accent="sky"
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiTile
          label="Company expenses"
          value={formatCurrency(totalCompanyExpenses, "AED", loc)}
          hint={`${companyExpenseCount} entries`}
          accent="rose"
          icon={<Receipt className="h-4 w-4" />}
        />
        <KpiTile
          label="Company profit"
          value={formatCurrency(companyNet, "AED", loc)}
          hint="realized − expenses"
          accent={companyNet >= 0 ? "emerald" : "rose"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiTile
          label="Paid to owners"
          value={formatCurrency(totalOwnerPayout, "AED", loc)}
          hint={`across ${distinctOwners} owner${distinctOwners === 1 ? "" : "s"}`}
          accent="indigo"
          icon={<Users className="h-4 w-4" />}
        />
        <KpiTile
          label="Reservations"
          value={String(totalBookings)}
          hint={`${propertyTable.length} properties`}
          accent="amber"
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>

      {/* Reporting */}
      <h2 className="mt-8 mb-3 text-base font-bold tracking-tight">
        Reporting
      </h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Property</th>
                <th className="px-4 py-3 text-left font-semibold">Owner</th>
                <th className="px-4 py-3 text-right font-semibold">Bookings</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Company (agency)
                </th>
                <th className="px-4 py-3 text-right font-semibold">Upcoming</th>
                <th className="px-4 py-3 text-right font-semibold">Portal</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Owner payout
                </th>
              </tr>
            </thead>
            <tbody>
              {propertyTable.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    No reservations yet.
                  </td>
                </tr>
              ) : (
                propertyTable.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-7 w-1 shrink-0 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="font-semibold">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {p.ownerName}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.bookings}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(p.totalRevenue, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-emerald-600">
                      {formatCurrency(p.agencyEarnings, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sky-600">
                      {p.upcomingAgency > 0
                        ? formatCurrency(p.upcomingAgency, "AED", loc)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                      {formatCurrency(p.portalCommissions, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(p.ownerPayout, "AED", loc)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Charts */}
      <div className="mt-8">
        <DashboardCharts
          locale={loc}
          topProperties={topProperties}
          split={split}
          monthly={monthly}
        />
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "emerald" | "rose" | "indigo" | "amber" | "sky";
  icon: React.ReactNode;
}) {
  const accentMap: Record<typeof accent, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-700",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-700",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-700",
  };
  return (
    <Card className="overflow-hidden">
      <CardBody className={`bg-gradient-to-br ${accentMap[accent]}`}>
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {label}
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
        <div className="mt-1.5 text-xl font-bold tabular-nums text-[var(--color-foreground)]">
          {value}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{hint}</div>
      </CardBody>
    </Card>
  );
}
