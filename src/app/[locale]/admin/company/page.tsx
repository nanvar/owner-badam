import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { Building2, TrendingUp, Wallet, Receipt, Users } from "lucide-react";
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
};

type OwnerAgg = {
  id: string;
  name: string;
  email: string;
  payout: number;
  bookings: number;
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
  const propertyAggs = await prisma.reservation.groupBy({
    by: ["propertyId"],
    _count: { _all: true },
    _sum: {
      totalPrice: true,
      agencyCommission: true,
      portalCommission: true,
      payout: true,
    },
  });

  const properties = await prisma.property.findMany({
    where: { id: { in: propertyAggs.map((a) => a.propertyId) } },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });
  const propMap = new Map(properties.map((p) => [p.id, p]));

  const propertyTable: PropertyAgg[] = propertyAggs
    .map((a) => {
      const p = propMap.get(a.propertyId);
      if (!p) return null;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        ownerName: p.owner.name ?? p.owner.email,
        bookings: a._count._all,
        totalRevenue: a._sum.totalPrice ?? 0,
        agencyEarnings: a._sum.agencyCommission ?? 0,
        portalCommissions: a._sum.portalCommission ?? 0,
        ownerPayout: a._sum.payout ?? 0,
      };
    })
    .filter((x): x is PropertyAgg => !!x)
    .sort((a, b) => b.agencyEarnings - a.agencyEarnings);

  // Per-owner aggregates: sum payout via reservations → property → owner
  const ownerAggsRaw = await prisma.reservation.findMany({
    select: {
      payout: true,
      property: {
        select: {
          owner: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  const ownersMap = new Map<string, OwnerAgg>();
  for (const r of ownerAggsRaw) {
    const o = r.property.owner;
    const existing = ownersMap.get(o.id);
    if (existing) {
      existing.payout += r.payout;
      existing.bookings += 1;
    } else {
      ownersMap.set(o.id, {
        id: o.id,
        name: o.name ?? o.email,
        email: o.email,
        payout: r.payout,
        bookings: 1,
      });
    }
  }
  const ownerTable: OwnerAgg[] = Array.from(ownersMap.values()).sort(
    (a, b) => b.payout - a.payout,
  );

  // Company expense totals (all-time)
  const companyExpenseAgg = await prisma.companyExpense.aggregate({
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totalCompanyExpenses = companyExpenseAgg._sum.amount ?? 0;
  const companyExpenseCount = companyExpenseAgg._count._all;

  // KPIs
  const totalRevenue = propertyTable.reduce((s, p) => s + p.totalRevenue, 0);
  const totalAgency = propertyTable.reduce((s, p) => s + p.agencyEarnings, 0);
  const totalPortal = propertyTable.reduce((s, p) => s + p.portalCommissions, 0);
  const totalOwnerPayout = propertyTable.reduce(
    (s, p) => s + p.ownerPayout,
    0,
  );
  const totalBookings = propertyTable.reduce((s, p) => s + p.bookings, 0);
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
      where: { checkIn: { gte: startUtc } },
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label="Company revenue"
          value={formatCurrency(totalAgency, "AED", loc)}
          hint={`from ${totalBookings} bookings`}
          accent="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiTile
          label="Company expenses"
          value={formatCurrency(totalCompanyExpenses, "AED", loc)}
          hint={`${companyExpenseCount} entries`}
          accent="rose"
          icon={<Receipt className="h-4 w-4" />}
        />
        <KpiTile
          label="Net profit"
          value={formatCurrency(companyNet, "AED", loc)}
          hint="revenue − expenses"
          accent={companyNet >= 0 ? "emerald" : "rose"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiTile
          label="Paid to owners"
          value={formatCurrency(totalOwnerPayout, "AED", loc)}
          hint={`across ${ownerTable.length} owners`}
          accent="indigo"
          icon={<Users className="h-4 w-4" />}
        />
        <KpiTile
          label="Properties"
          value={String(propertyTable.length)}
          hint={`portal: ${formatCurrency(totalPortal, "AED", loc)}`}
          accent="amber"
          icon={<Building2 className="h-4 w-4" />}
        />
      </div>

      {/* Charts */}
      <div className="mt-6">
        <DashboardCharts
          locale={loc}
          topProperties={topProperties}
          split={split}
          monthly={monthly}
        />
      </div>

      {/* Property breakdown */}
      <h2 className="mt-8 mb-3 text-base font-bold tracking-tight">
        By property
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
                    colSpan={7}
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

      {/* Owner breakdown */}
      <h2 className="mt-8 mb-3 text-base font-bold tracking-tight">
        By owner
      </h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Owner</th>
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-right font-semibold">Bookings</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Total paid out
                </th>
              </tr>
            </thead>
            <tbody>
              {ownerTable.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    No owners yet.
                  </td>
                </tr>
              ) : (
                ownerTable.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3 font-semibold">{o.name}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">
                      {o.email}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {o.bookings}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {formatCurrency(o.payout, "AED", loc)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
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
  accent: "emerald" | "rose" | "indigo" | "amber";
  icon: React.ReactNode;
}) {
  const accentMap: Record<typeof accent, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-700",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-700",
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
