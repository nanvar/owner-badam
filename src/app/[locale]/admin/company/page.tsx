import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import {
  Wallet,
  Receipt,
  Users,
  TrendingUp,
  CalendarDays,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency } from "@/lib/utils";
import { UpcomingTile } from "./upcoming-tile";

type PropertyAgg = {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  ownerName: string;
  bookings: number;
  totalRevenue: number;
  agencyEarnings: number;
  portalCommissions: number;
  ownerPayout: number;
  upcomingBookings: number;
  upcomingRevenue: number;
  upcomingAgency: number;
  upcomingPortal: number;
  upcomingPayout: number;
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
        ownerId: p.owner.id,
        ownerName: p.owner.name ?? p.owner.email,
        bookings: a?._count._all ?? 0,
        totalRevenue: a?._sum.totalPrice ?? 0,
        agencyEarnings: a?._sum.agencyCommission ?? 0,
        portalCommissions: a?._sum.portalCommission ?? 0,
        ownerPayout: a?._sum.payout ?? 0,
        upcomingBookings: u?._count._all ?? 0,
        upcomingRevenue: u?._sum.totalPrice ?? 0,
        upcomingAgency: u?._sum.agencyCommission ?? 0,
        upcomingPortal: u?._sum.portalCommission ?? 0,
        upcomingPayout: u?._sum.payout ?? 0,
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

  // Outstanding payout per owner = accrued (realized) − recorded payments.
  // Properties belonging to a fully-paid owner drop off the reporting list,
  // and the Owners amount card sums the remaining balance only.
  const ownerPaymentSums = await prisma.ownerPayment.groupBy({
    by: ["ownerId"],
    _sum: { amount: true },
  });
  const paidByOwner = new Map(
    ownerPaymentSums.map((row) => [row.ownerId, row._sum.amount ?? 0]),
  );
  const accruedByOwner = new Map<string, number>();
  for (const p of propertyTable) {
    accruedByOwner.set(
      p.ownerId,
      (accruedByOwner.get(p.ownerId) ?? 0) + p.ownerPayout,
    );
  }
  // remainingFactor = how much of each property's payout is still owed
  // (1 = nothing paid yet, 0 = fully paid). Pro-rata across an owner's props.
  const remainingFactorByOwner = new Map<string, number>();
  for (const [ownerId, accrued] of accruedByOwner) {
    const paid = paidByOwner.get(ownerId) ?? 0;
    if (accrued <= 0) {
      remainingFactorByOwner.set(ownerId, 0);
    } else {
      const remaining = Math.max(0, accrued - paid);
      remainingFactorByOwner.set(ownerId, remaining / accrued);
    }
  }
  // Filtered table for the Reporting section: only owners with money still
  // owed. Each property's "Owner payout" reflects its share of the
  // outstanding balance.
  const reportingTable = propertyTable
    .map((p) => {
      const factor = remainingFactorByOwner.get(p.ownerId) ?? 0;
      return { ...p, ownerPayoutOutstanding: p.ownerPayout * factor };
    })
    .filter((p) => p.ownerPayoutOutstanding > 0.005);


  // Active reservations: today falls inside checkIn..checkOut.
  const today = new Date();
  const [allReservationsCount, activeReservationsCount] = await Promise.all([
    prisma.reservation.count(),
    prisma.reservation.count({
      where: {
        checkIn: { lte: today },
        checkOut: { gt: today },
      },
    }),
  ]);

  // KPIs
  const totalAgency = propertyTable.reduce((s, p) => s + p.agencyEarnings, 0);
  const totalPortal = propertyTable.reduce((s, p) => s + p.portalCommissions, 0);
  const totalUpcomingAgency = propertyTable.reduce(
    (s, p) => s + p.upcomingAgency,
    0,
  );
  const totalUpcomingBookings = propertyTable.reduce(
    (s, p) => s + p.upcomingBookings,
    0,
  );
  // Owners amount tile shows outstanding balance only (accrued − paid).
  // distinctOwners counts only those still owed money — fully-paid owners
  // disappear from this view.
  const totalOwnerOutstanding = reportingTable.reduce(
    (s, p) => s + p.ownerPayoutOutstanding,
    0,
  );
  const distinctOwners = new Set(reportingTable.map((p) => p.ownerId)).size;
  // Profit and revenue tiles use realized only. Upcoming is split out
  // into its own tile (clickable for the per-property breakdown).
  const companyNet = totalAgency - totalCompanyExpenses;

  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        <KpiTile
          label="Company revenue"
          value={formatCurrency(totalAgency, "AED", loc)}
          hint={`portal ${formatCurrency(totalPortal, "AED", loc)}`}
          accent="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <UpcomingTile
          locale={loc}
          totalAmount={totalUpcomingAgency}
          totalBookings={totalUpcomingBookings}
          rows={propertyTable.map((p) => ({
            id: p.id,
            name: p.name,
            color: p.color,
            ownerName: p.ownerName,
            upcomingBookings: p.upcomingBookings,
            upcomingRevenue: p.upcomingRevenue,
            upcomingAgency: p.upcomingAgency,
            upcomingPortal: p.upcomingPortal,
            upcomingPayout: p.upcomingPayout,
          }))}
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
          label="Owners amount"
          value={formatCurrency(totalOwnerOutstanding, "AED", loc)}
          hint={
            distinctOwners === 0
              ? "all settled"
              : `outstanding for ${distinctOwners} owner${distinctOwners === 1 ? "" : "s"}`
          }
          accent="indigo"
          icon={<Users className="h-4 w-4" />}
        />
        <KpiTile
          label="Reservations"
          value={`${allReservationsCount} / ${activeReservationsCount}`}
          hint="all / active today"
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
                <th className="px-4 py-3 text-right font-semibold">Company</th>
                <th className="px-4 py-3 text-right font-semibold">Portal</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Owner payout
                </th>
              </tr>
            </thead>
            <tbody>
              {reportingTable.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    All owners are settled — nothing outstanding.
                  </td>
                </tr>
              ) : (
                reportingTable.map((p) => (
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
                      {formatCurrency(p.ownerPayoutOutstanding, "AED", loc)}
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
