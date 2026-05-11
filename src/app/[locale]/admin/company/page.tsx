import { setRequestLocale } from "next-intl/server";
import { Fragment } from "react";
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
import { formatCurrency, monthLabel } from "@/lib/utils";
import { MonthSelector } from "./month-selector";
import { UnpaidCard } from "./unpaid-card";
import { PendingExtensionsCard } from "./pending-extensions-card";

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
};

export default async function SuperAdminDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");
  const sp = await searchParams;

  const loc = locale as Locale;

  // Distinct months that actually have data, across all the month-bucketed
  // tables. Empty default ("All months") so the dashboard reads as a global
  // snapshot until the admin opts into a specific period.
  const [resMonths, expMonths, coMonths, payMonths] = await Promise.all([
    prisma.reservation.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
    prisma.expense.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
    prisma.companyExpense.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
    prisma.ownerPayment.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
  ]);
  const monthSet = new Set<string>();
  for (const r of resMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of expMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of coMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of payMonths) if (r.monthKey) monthSet.add(r.monthKey);
  const monthOpts = [...monthSet]
    .sort()
    .reverse()
    .map((k) => ({ key: k, label: monthLabel(k, loc) }));
  const selectedMonth =
    sp.month && monthSet.has(sp.month) ? sp.month : "";
  // Filter clause reused on every aggregation: empty selectedMonth means
  // "all months" so we drop the constraint entirely.
  const monthWhere = selectedMonth ? { monthKey: selectedMonth } : {};

  // === Aggregations (scoped to the selected month, or all months) ===
  const [
    propertyAggs,
    expenseAggs,
    paymentAggs,
    companyProfitAggs,
    extensionRows,
    properties,
  ] = await Promise.all([
    // Realized revenue / profit / payout only count paid reservations.
    // Unpaid rows still surface via the dedicated Unpaid card so admins
    // can chase them, but they don't inflate the KPIs.
    prisma.reservation.groupBy({
      by: ["propertyId"],
      where: { ...monthWhere, paid: true },
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
      where: monthWhere,
      _sum: { amount: true },
    }),
    prisma.ownerPayment.groupBy({
      by: ["propertyId"],
      where: monthWhere,
      _sum: { amount: true },
    }),
    prisma.companyExpense.groupBy({
      by: ["propertyId"],
      where: { kind: "PROFIT", ...monthWhere },
      _sum: { amount: true },
    }),
    // Extensions live on a side table — no `groupBy` because we need the
    // owning property via the relation. Aggregating in JS is fine since
    // monthly volumes are tiny.
    prisma.reservationExtension.findMany({
      where: monthWhere,
      include: {
        reservation: {
          select: {
            propertyId: true,
            guestName: true,
            property: { select: { name: true, color: true } },
          },
        },
      },
      orderBy: { checkIn: "desc" },
    }),
    prisma.property.findMany({
      include: { owner: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const realizedByProp = new Map(propertyAggs.map((a) => [a.propertyId, a]));
  const expenseByProp = new Map(
    expenseAggs.map((a) => [a.propertyId, a._sum.amount ?? 0]),
  );
  const profitByProp = new Map(
    companyProfitAggs.map((a) => [a.propertyId ?? "", a._sum.amount ?? 0]),
  );

  // Extension contributions, bucketed by owning property, so the rest of
  // the dashboard math (revenue / profit / owner payout) naturally
  // includes them — extensions are real revenue, just split off so the
  // original reservation window stays untouched.
  type ExtBucket = {
    total: number;
    agency: number;
    portal: number;
    payout: number;
    count: number;
    pending: number;
    unpaid: number;
  };
  const extByProp = new Map<string, ExtBucket>();
  for (const e of extensionRows) {
    const pid = e.reservation.propertyId;
    const cur = extByProp.get(pid) ?? {
      total: 0,
      agency: 0,
      portal: 0,
      payout: 0,
      count: 0,
      pending: 0,
      unpaid: 0,
    };
    // Same paid-only rule as reservations: KPIs reflect realized money,
    // unpaid extensions still appear in their dedicated drawers.
    if (e.paid) {
      cur.total += e.totalPrice;
      cur.agency += e.agencyCommission;
      cur.portal += e.portalCommission;
      cur.payout += e.payout;
    }
    cur.count += 1;
    if (!e.detailsFilled || e.totalPrice <= 0) cur.pending += 1;
    if (!e.paid && e.totalPrice > 0) cur.unpaid += 1;
    extByProp.set(pid, cur);
  }
  const directPaymentsByProp = new Map(
    paymentAggs
      .filter((a) => !!a.propertyId)
      .map((a) => [a.propertyId as string, a._sum.amount ?? 0]),
  );
  const crossOwnerPayments = await prisma.ownerPayment.groupBy({
    by: ["ownerId"],
    where: { propertyId: null, ...monthWhere },
    _sum: { amount: true },
  });
  const crossPaymentsByOwner = new Map(
    crossOwnerPayments.map((r) => [r.ownerId, r._sum.amount ?? 0]),
  );

  // Build the per-property base table (all of the owner's properties show
  // up, even ones with no activity in the period — easier to spot zeros).
  // Extensions roll into agency / portal / payout / revenue so the
  // dashboard KPIs reflect the full picture without a separate path.
  const baseTable = properties.map((p) => {
    const a = realizedByProp.get(p.id);
    const ext = extByProp.get(p.id);
    const expenses = expenseByProp.get(p.id) ?? 0;
    const payout = (a?._sum.payout ?? 0) + (ext?.payout ?? 0);
    const ownerNet = payout - expenses;
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      ownerId: p.owner.id,
      ownerName: p.owner.name ?? p.owner.email,
      bookings: a?._count._all ?? 0,
      totalRevenue: (a?._sum.totalPrice ?? 0) + (ext?.total ?? 0),
      agencyEarnings: (a?._sum.agencyCommission ?? 0) + (ext?.agency ?? 0),
      portalCommissions:
        (a?._sum.portalCommission ?? 0) + (ext?.portal ?? 0),
      ownerPayout: payout,
      propertyExpenses: expenses,
      ownerNet,
      paymentsToOwner: directPaymentsByProp.get(p.id) ?? 0,
      companyExtraProfit: profitByProp.get(p.id) ?? 0,
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
  const propertyTable: PropertyAgg[] = baseTable.map((p) => {
    const ownerNetTotal = ownerNetTotalsForCross.get(p.ownerId) ?? 0;
    const cross = crossPaymentsByOwner.get(p.ownerId) ?? 0;
    const share =
      ownerNetTotal > 0 && cross > 0
        ? (p.ownerNet / ownerNetTotal) * cross
        : 0;
    return { ...p, paymentsToOwner: p.paymentsToOwner + share };
  });

  // Company expense + profit totals (filtered). Stored together in
  // CompanyExpense with a `kind` discriminator. Net = profit − expenses
  // and feeds the company net-profit KPI.
  const [companyEntryAggs, activeDeposits] = await Promise.all([
    prisma.companyExpense.groupBy({
      by: ["kind"],
      where: { kind: { in: ["EXPENSE", "PROFIT"] }, ...monthWhere },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.companyExpense.aggregate({
      where: { kind: "DEPOSIT", refundedAt: null, ...monthWhere },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const expenseRow = companyEntryAggs.find((r) => r.kind === "EXPENSE");
  const profitRow = companyEntryAggs.find((r) => r.kind === "PROFIT");
  const totalCompanyExpenses = expenseRow?._sum.amount ?? 0;
  const totalCompanyExtraProfit = profitRow?._sum.amount ?? 0;
  const totalActiveDeposits = activeDeposits._sum.amount ?? 0;

  // Outstanding to owners (sum across every property where the company
  // still owes the owner money). Drops the table that used to render this
  // breakdown — we keep the running KPI total only.
  const totalOwnerOutstanding = propertyTable.reduce(
    (s, p) => s + (p.ownerNet - p.paymentsToOwner),
    0,
  );

  // Bookings (reservations + extensions) drive the period counts.
  // Extensions live in their own window since iCal no longer pushes
  // the reservation's checkOut forward, so each side is counted by
  // its own dates against `today`. Treating them as separate bookings
  // matches how the lists already render them.
  const today = new Date();
  const todayMs = today.getTime();
  const [
    reservationCount,
    reservationLiveCount,
    reservationDoneCount,
    unpaidReservationRows,
  ] = await Promise.all([
    prisma.reservation.count({ where: monthWhere }),
    prisma.reservation.count({
      where: {
        ...monthWhere,
        checkIn: { lte: today },
        checkOut: { gt: today },
      },
    }),
    prisma.reservation.count({
      where: { ...monthWhere, checkOut: { lte: today } },
    }),
    prisma.reservation.findMany({
      where: { ...monthWhere, paid: false, totalPrice: { gt: 0 } },
      include: {
        property: { select: { name: true, color: true } },
      },
      orderBy: { checkIn: "desc" },
    }),
  ]);
  // Extension contribution to Live / Done — already loaded above in
  // `extensionRows`, so we just bucket them in JS rather than firing
  // more queries.
  let extensionLiveCount = 0;
  let extensionDoneCount = 0;
  for (const e of extensionRows) {
    const ci = e.checkIn.getTime();
    const co = e.checkOut.getTime();
    if (ci <= todayMs && co > todayMs) extensionLiveCount += 1;
    else if (co <= todayMs) extensionDoneCount += 1;
  }
  const allReservationsCount = reservationCount + extensionRows.length;
  const activeReservationsCount = reservationLiveCount + extensionLiveCount;
  const doneReservationsCount = reservationDoneCount + extensionDoneCount;
  // Extensions are derived from the already-loaded `extensionRows` so we
  // don't issue duplicate queries.
  const unpaidReservations = [
    ...unpaidReservationRows.map((r) => ({
      id: r.id,
      kind: "reservation" as const,
      propertyName: r.property.name,
      propertyColor: r.property.color,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      totalPrice: r.totalPrice,
      currency: r.currency,
    })),
    ...extensionRows
      .filter((e) => !e.paid && e.totalPrice > 0)
      .map((e) => ({
        id: e.id,
        kind: "extension" as const,
        propertyName: e.reservation.property.name,
        propertyColor: e.reservation.property.color,
        guestName: e.reservation.guestName,
        checkIn: e.checkIn.toISOString(),
        checkOut: e.checkOut.toISOString(),
        totalPrice: e.totalPrice,
        currency: e.currency,
      })),
  ].sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
  const unpaidTotal = unpaidReservations.reduce(
    (s, r) => s + r.totalPrice,
    0,
  );
  const unpaidCount = unpaidReservations.length;

  // Extension stats — the count of extensions in the period and the
  // sub-set that still needs pricing (iCal placeholders).
  const totalExtensionsCount = extensionRows.length;
  const pendingExtensions = extensionRows
    .filter((e) => !e.detailsFilled || e.totalPrice <= 0)
    .map((e) => ({
      id: e.id,
      propertyName: e.reservation.property.name,
      propertyColor: e.reservation.property.color,
      guestName: e.reservation.guestName,
      checkIn: e.checkIn.toISOString(),
      checkOut: e.checkOut.toISOString(),
      nights: e.nights,
    }));
  const pendingExtensionsCount = pendingExtensions.length;

  // KPIs
  const totalAgency = propertyTable.reduce((s, p) => s + p.agencyEarnings, 0);
  const companyNet =
    totalAgency + totalCompanyExtraProfit - totalCompanyExpenses;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        right={
          <MonthSelector
            options={monthOpts}
            selected={selectedMonth}
            basePath={`/${loc}/admin/company`}
            allowAll
          />
        }
      />

      {/* Top row — 4 single-value tiles */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 *:h-full md:grid-cols-4">
        <KpiTile
          label="Company revenue"
          value={formatCurrency(
            totalAgency + totalCompanyExtraProfit,
            "AED",
            loc,
          )}
          accent="emerald"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiTile
          label="Company profit"
          value={formatCurrency(companyNet, "AED", loc)}
          accent={companyNet >= 0 ? "emerald" : "rose"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KpiTile
          label="Company expenses"
          value={formatCurrency(totalCompanyExpenses, "AED", loc)}
          accent="rose"
          icon={<Receipt className="h-4 w-4" />}
        />
        <KpiTile
          label="Active deposits"
          value={formatCurrency(totalActiveDeposits, "AED", loc)}
          accent="sky"
          icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      {/* Bottom row */}
      <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 *:h-full md:grid-cols-2 lg:grid-cols-4">
        <UnpaidCard
          locale={loc}
          total={unpaidTotal}
          count={unpaidCount}
          reservations={unpaidReservations}
        />
        <PendingExtensionsCard
          locale={loc}
          count={pendingExtensionsCount}
          extensions={pendingExtensions}
        />
        <KpiTile
          label="Owner payout"
          value={formatCurrency(totalOwnerOutstanding, "AED", loc)}
          accent="indigo"
          icon={<Users className="h-4 w-4" />}
        />
        <DualValueTile
          label="Reservations"
          icon={<CalendarDays className="h-4 w-4" />}
          accent="amber"
          values={[
            { label: "All", value: String(allReservationsCount) },
            { label: "Live", value: String(activeReservationsCount) },
            { label: "Done", value: String(doneReservationsCount) },
            { label: "Ext", value: String(totalExtensionsCount) },
          ]}
        />
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
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
    <Card className="h-full overflow-hidden">
      <CardBody
        className={`flex h-full flex-col gap-2 bg-gradient-to-br !p-3.5 ${accentMap[accent]}`}
      >
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {label}
          </div>
          <div className="opacity-80">{icon}</div>
        </div>
        <div className="text-lg font-bold tabular-nums text-[var(--color-foreground)]">
          {value}
        </div>
      </CardBody>
    </Card>
  );
}

// Multiple labelled values side by side, separated by thin vertical
// dividers. Header row hidden when label is omitted so the card stays
// compact (used for the Finance card).
function DualValueTile({
  label,
  icon,
  accent,
  values,
}: {
  label?: string;
  icon?: React.ReactNode;
  accent: "emerald" | "rose" | "indigo" | "amber" | "sky";
  values: { label: string; value: string; tone?: "emerald" | "rose" }[];
}) {
  const accentMap: Record<typeof accent, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/0 text-emerald-700",
    rose: "from-rose-500/15 to-rose-500/0 text-rose-600",
    indigo: "from-indigo-500/15 to-indigo-500/0 text-indigo-700",
    amber: "from-amber-500/15 to-amber-500/0 text-amber-700",
    sky: "from-sky-500/15 to-sky-500/0 text-sky-700",
  };
  const toneClass = (tone?: "emerald" | "rose") =>
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-600"
        : "text-[var(--color-foreground)]";
  return (
    <Card className="h-full overflow-hidden">
      <CardBody
        className={`flex h-full flex-col gap-2 bg-gradient-to-br !p-3.5 ${accentMap[accent]}`}
      >
        {(label || icon) && (
          <div className="flex items-center justify-between">
            {label && (
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                {label}
              </div>
            )}
            {icon && <div className="opacity-80">{icon}</div>}
          </div>
        )}
        <div className="flex items-end gap-3">
          {values.map((v, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span className="h-8 w-px self-center bg-current opacity-15" />
              )}
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  {v.label}
                </div>
                <div
                  className={`text-lg font-bold tabular-nums ${toneClass(v.tone)}`}
                >
                  {v.value}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
