import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import Link from "next/link";
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
  propertyExpenses: number;
  ownerNet: number;
  paymentsToOwner: number;
  companyExtraProfit: number;
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
  // Per-property: realized + upcoming reservation sums, property expenses,
  // owner payments (per-property only — null-property settlements are
  // pro-rated separately at owner level), and company-side extra profit.
  const [
    propertyAggs,
    upcomingAggs,
    expenseAggs,
    paymentAggs,
    companyProfitAggs,
    properties,
  ] = await Promise.all([
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
    prisma.expense.groupBy({
      by: ["propertyId"],
      _sum: { amount: true },
    }),
    prisma.ownerPayment.groupBy({
      by: ["propertyId"],
      _sum: { amount: true },
    }),
    prisma.companyExpense.groupBy({
      by: ["propertyId"],
      where: { kind: "PROFIT" },
      _sum: { amount: true },
    }),
    prisma.property.findMany({
      include: { owner: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const realizedByProp = new Map(propertyAggs.map((a) => [a.propertyId, a]));
  const upcomingByProp = new Map(upcomingAggs.map((a) => [a.propertyId, a]));
  const expenseByProp = new Map(
    expenseAggs.map((a) => [a.propertyId, a._sum.amount ?? 0]),
  );
  const profitByProp = new Map(
    companyProfitAggs.map((a) => [a.propertyId ?? "", a._sum.amount ?? 0]),
  );
  // Per-property owner payments (with explicit propertyId set on the row).
  const directPaymentsByProp = new Map(
    paymentAggs
      .filter((a) => !!a.propertyId)
      .map((a) => [a.propertyId as string, a._sum.amount ?? 0]),
  );
  // Cross-property settlements: those with propertyId = null — sum per
  // owner so we can pro-rate them across that owner's properties below.
  const crossOwnerPayments = await prisma.ownerPayment.groupBy({
    by: ["ownerId"],
    where: { propertyId: null },
    _sum: { amount: true },
  });
  const crossPaymentsByOwner = new Map(
    crossOwnerPayments.map((r) => [r.ownerId, r._sum.amount ?? 0]),
  );

  // Build the per-property base table (all of the owner's properties show
  // up, even ones with no activity in the period — easier to spot zeros).
  const baseTable = properties.map((p) => {
    const a = realizedByProp.get(p.id);
    const u = upcomingByProp.get(p.id);
    const expenses = expenseByProp.get(p.id) ?? 0;
    const payout = a?._sum.payout ?? 0;
    const ownerNet = Math.max(0, payout - expenses);
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
      ownerPayout: payout,
      propertyExpenses: expenses,
      ownerNet,
      paymentsToOwner: directPaymentsByProp.get(p.id) ?? 0,
      companyExtraProfit: profitByProp.get(p.id) ?? 0,
      upcomingBookings: u?._count._all ?? 0,
      upcomingRevenue: u?._sum.totalPrice ?? 0,
      upcomingAgency: u?._sum.agencyCommission ?? 0,
      upcomingPortal: u?._sum.portalCommission ?? 0,
      upcomingPayout: u?._sum.payout ?? 0,
    } satisfies PropertyAgg;
  });

  // Allocate cross-property payments pro-rata against ownerNet so an
  // umbrella settlement still reduces each property's debt fairly.
  const ownerNetTotalsForCross = new Map<string, number>();
  for (const p of baseTable) {
    ownerNetTotalsForCross.set(
      p.ownerId,
      (ownerNetTotalsForCross.get(p.ownerId) ?? 0) + p.ownerNet,
    );
  }
  const propertyTable: PropertyAgg[] = baseTable
    .map((p) => {
      const ownerNetTotal = ownerNetTotalsForCross.get(p.ownerId) ?? 0;
      const cross = crossPaymentsByOwner.get(p.ownerId) ?? 0;
      const share =
        ownerNetTotal > 0 && cross > 0
          ? (p.ownerNet / ownerNetTotal) * cross
          : 0;
      return { ...p, paymentsToOwner: p.paymentsToOwner + share };
    })
    .sort((a, b) => b.agencyEarnings - a.agencyEarnings);

  // Company expense + profit totals (filtered). Stored together in
  // CompanyExpense with a `kind` discriminator. Net = profit − expenses
  // and feeds the company net-profit KPI.
  const companyEntryAggs = await prisma.companyExpense.groupBy({
    by: ["kind"],
    _sum: { amount: true },
    _count: { _all: true },
  });
  const expenseRow = companyEntryAggs.find((r) => r.kind === "EXPENSE");
  const profitRow = companyEntryAggs.find((r) => r.kind === "PROFIT");
  const totalCompanyExpenses = expenseRow?._sum.amount ?? 0;
  const companyExpenseCount = expenseRow?._count._all ?? 0;
  const totalCompanyExtraProfit = profitRow?._sum.amount ?? 0;

  // Outstanding owner debt = realized payout − property expenses − payments
  // already made. Per-property payments come from `paymentsToOwner` (incl.
  // pro-rated cross-property settlements computed earlier).
  const reportingTable = propertyTable
    .map((p) => ({
      ...p,
      ownerDebt: Math.max(0, p.ownerNet - p.paymentsToOwner),
    }))
    .filter(
      (p) =>
        p.bookings > 0 ||
        p.propertyExpenses > 0 ||
        p.paymentsToOwner > 0 ||
        p.companyExtraProfit > 0,
    );

  // Active reservations: today falls inside checkIn..checkOut. Both counts
  // exclude pipeline (upcoming) — they are pure realized metrics.
  const today = new Date();
  const [allReservationsCount, activeReservationsCount] = await Promise.all([
    prisma.reservation.count({ where: { upcoming: false } }),
    prisma.reservation.count({
      where: {
        upcoming: false,
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
  // Outstanding-only view: drop properties whose ownerDebt is zero so the
  // table only ever lists what the company actually still owes.
  const debtTable = reportingTable
    .filter((p) => p.ownerDebt > 0.005)
    .sort((a, b) => b.ownerDebt - a.ownerDebt);
  const totalOwnerOutstanding = debtTable.reduce(
    (s, p) => s + p.ownerDebt,
    0,
  );
  const distinctOwners = new Set(debtTable.map((p) => p.ownerId)).size;
  // Profit and revenue tiles use realized only. Upcoming is split out
  // into its own tile (clickable for the per-property breakdown).
  const companyNet =
    totalAgency + totalCompanyExtraProfit - totalCompanyExpenses;

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
          hint={
            totalCompanyExtraProfit > 0
              ? "agency + profit − expenses"
              : "agency − expenses"
          }
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

      {/* Outstanding owner debts — only properties where the company still
          owes the owner money. If a property is settled it falls off the
          list, so what's on screen is exactly the open balance. */}
      <h2 className="mt-8 mb-3 text-base font-bold tracking-tight">
        Outstanding to owners
      </h2>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Property</th>
                <th className="px-4 py-3 text-left font-semibold">Owner</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Owner payout
                </th>
              </tr>
            </thead>
            <tbody>
              {debtTable.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    All settled — no outstanding balances.
                  </td>
                </tr>
              ) : (
                debtTable.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-1 shrink-0 rounded-full"
                          style={{ background: p.color }}
                        />
                        <span className="font-semibold">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${loc}/admin/owners/${p.ownerId}`}
                        className="text-[var(--color-muted)] underline-offset-4 hover:text-[var(--color-brand)] hover:underline"
                      >
                        {p.ownerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">
                      {formatCurrency(p.ownerDebt, "AED", loc)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {debtTable.length > 0 && (
              <tfoot className="bg-[var(--color-surface-2)]/60 text-sm">
                <tr className="border-t border-[var(--color-border)]">
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">
                    {formatCurrency(totalOwnerOutstanding, "AED", loc)}
                  </td>
                </tr>
              </tfoot>
            )}
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
