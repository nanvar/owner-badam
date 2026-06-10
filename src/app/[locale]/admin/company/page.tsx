import { setRequestLocale } from "next-intl/server";
import { Fragment } from "react";
import Link from "next/link";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import {
  Wallet,
  Receipt,
  Users,
  TrendingUp,
  CalendarDays,
  Banknote,
  HandCoins,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency, monthLabel } from "@/lib/utils";
import { MonthSelector } from "./month-selector";
import { UnpaidCard } from "./unpaid-card";
import { PendingExtensionsCard } from "./pending-extensions-card";
import { PaidToOwnerCard } from "./paid-to-owner-card";
import { OwnerPayoutCard } from "./owner-payout-card";

type PropertyAgg = {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  ownerName: string;
  // Management-only units skip the Owner-payout KPI / drawer — the
  // company runs them end-to-end with no owner revenue share.
  managementOnly: boolean;
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
    //
    // No settlement filter here — Company revenue / profit MUST keep
    // agency commission from items already inside paid reports (those
    // are still company income; only the owner side closes when paid).
    // The owner-payout / ownerNet column is recomputed from a separate
    // "settle-aware" aggregation below.
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
    // Split by the "paid from company invest" flag so the owner-paid
    // bucket reduces owner payout (default behavior) and the
    // company-funded bucket is excluded from owner net — those rows
    // already have a matching Investment SPEND + OwnerDebt elsewhere.
    prisma.expense.groupBy({
      by: ["propertyId", "paidFromCompanyInvest"],
      where: monthWhere,
      _sum: { amount: true },
    }),
    // All OwnerPayments in the period — used downstream by the
    // realised "Payments to owner" column. The owner-payout outstanding
    // calculation only nets non-report payments to avoid double-counting
    // alongside the settlement filter; we apply that scope where needed.
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
    //
    // Don't apply the paid-report exclusion in the WHERE clause here —
    // the pending/unpaid drawer + the extension list need the full set;
    // we apply the settlement filter when bucketing into the
    // owner-payout math below.
    prisma.reservationExtension.findMany({
      where: monthWhere,
      include: {
        reservation: {
          select: {
            propertyId: true,
            guestName: true,
            // managementOnly needed for the unpaid card's owner/company
            // split — extensions on company-run units contribute fully
            // to the company side.
            property: {
              select: { name: true, color: true, managementOnly: true },
            },
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
  // Owner-paid expenses feed the owner-payout calculation.
  // paidFromCompanyInvest expenses are tracked separately: they
  // still appear in the per-property "Property expenses" total
  // column for visibility, but they don't reduce owner payout and
  // they're recorded as Investment SPEND + OwnerDebt elsewhere.
  const expenseByPropOwner = new Map<string, number>();
  const expenseByPropCompany = new Map<string, number>();
  for (const a of expenseAggs) {
    const sum = a._sum.amount ?? 0;
    if (a.paidFromCompanyInvest) {
      expenseByPropCompany.set(
        a.propertyId,
        (expenseByPropCompany.get(a.propertyId) ?? 0) + sum,
      );
    } else {
      expenseByPropOwner.set(
        a.propertyId,
        (expenseByPropOwner.get(a.propertyId) ?? 0) + sum,
      );
    }
  }
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
    // Owner net only subtracts the owner-paid bucket; company-paid
    // expenses are tracked separately and never reduce the owner's
    // share. Full realised numbers (including settled items) feed the
    // visible payout / revenue columns; the settled-aware variants below
    // power ONLY the outstanding owner-payout KPI.
    const ownerExpenses = expenseByPropOwner.get(p.id) ?? 0;
    const companyExpenses = expenseByPropCompany.get(p.id) ?? 0;
    const payout = (a?._sum.payout ?? 0) + (ext?.payout ?? 0);
    const ownerNet = payout - ownerExpenses;

    return {
      id: p.id,
      name: p.name,
      color: p.color,
      ownerId: p.owner.id,
      ownerName: p.owner.name ?? p.owner.email,
      managementOnly: p.managementOnly,
      bookings: a?._count._all ?? 0,
      totalRevenue: (a?._sum.totalPrice ?? 0) + (ext?.total ?? 0),
      agencyEarnings: (a?._sum.agencyCommission ?? 0) + (ext?.agency ?? 0),
      portalCommissions:
        (a?._sum.portalCommission ?? 0) + (ext?.portal ?? 0),
      ownerPayout: payout,
      // Visible column still rolls up everything attached to the
      // property — full transparency for the admin even though the
      // company-paid slice no longer hits the owner.
      propertyExpenses: ownerExpenses + companyExpenses,
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
  const [
    companyExpenseAgg,
    companyProfitAgg,
    activeDeposits,
    investmentsAgg,
  ] = await Promise.all([
    prisma.companyExpense.aggregate({
      where: { kind: "EXPENSE", ...monthWhere },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Only PAID profits feed the dashboard KPIs. Unpaid PROFIT rows
    // stay visible in the finance list but don't roll up into totals
    // until the cash actually arrives and the entry is marked paid.
    prisma.companyExpense.aggregate({
      where: { kind: "PROFIT", paid: true, ...monthWhere },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.companyExpense.aggregate({
      // Only PAID deposits that are still held — same rule as the
      // PROFIT KPI: unrecorded cash doesn't count toward the company's
      // current obligation totals.
      where: {
        kind: "DEPOSIT",
        paid: true,
        refundedAt: null,
        ...monthWhere,
      },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Investments are info-only and unfiltered by month — they roll up
    // the full lifetime total here and never feed any calculation.
    // INCOME = capital received, SPEND = capital paid out (most of
    // those are auto-created from "paid from company invest"
    // expenses).
    prisma.investment.groupBy({
      by: ["kind"],
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  const totalCompanyExpenses = companyExpenseAgg._sum.amount ?? 0;
  const totalCompanyExtraProfit = companyProfitAgg._sum.amount ?? 0;
  const totalActiveDeposits = activeDeposits._sum.amount ?? 0;
  const investmentIncomeRow = investmentsAgg.find((r) => r.kind === "INCOME");
  const investmentSpendRow = investmentsAgg.find((r) => r.kind === "SPEND");
  const totalInvestments = investmentIncomeRow?._sum.amount ?? 0;
  const totalInvestmentsCount = investmentIncomeRow?._count._all ?? 0;
  const totalInvestmentSpent = investmentSpendRow?._sum.amount ?? 0;
  const totalInvestmentSpentCount = investmentSpendRow?._count._all ?? 0;
  // Outstanding owner IOUs — unsettled debts from "paid from company
  // invest" expenses. Surfaced as its own dashboard tile.
  const ownerDebtsAgg = await prisma.ownerDebt.aggregate({
    where: { status: "PENDING" },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totalOwnerDebts = ownerDebtsAgg._sum.amount ?? 0;
  const totalOwnerDebtsCount = ownerDebtsAgg._count._all;

  // Outstanding to owners — pure cash-flow formula:
  //   realised owner net (paid reservations + paid extensions − owner
  //   expenses) MINUS every cent of cash that already left the company
  //   to the owner (all OwnerPayments, whether report-settled or
  //   manual).
  // Why not the prior settle-aware variant: it cancelled paid reports
  // by EXCLUDING their items AND their linked OwnerPayments, which
  // hides an over-payment when an admin settles a report containing an
  // unpaid reservation — the company actually paid out money it hasn't
  // earned yet. The cash-flow formula naturally surfaces that as a
  // negative outstanding ("we paid more than we owed"). Management-only
  // properties skip — the company runs them solo.
  const totalOwnerOutstanding = propertyTable.reduce(
    (s, p) =>
      p.managementOnly ? s : s + (p.ownerNet - p.paymentsToOwner),
    0,
  );

  // Per-owner breakdown for the Owner-payout drawer. Aggregates each
  // property's outstanding (ownerNet − paymentsToOwner) under its owner
  // and sorts by amount desc so the largest debts are top of the list.
  type OwnerOutstanding = {
    ownerId: string;
    ownerName: string;
    total: number;
    properties: {
      id: string;
      name: string;
      color: string;
      outstanding: number;
    }[];
  };
  const ownerOutstandingMap = new Map<string, OwnerOutstanding>();
  for (const p of propertyTable) {
    if (p.managementOnly) continue; // skip company-run units
    const outstanding = p.ownerNet - p.paymentsToOwner;
    if (Math.abs(outstanding) < 0.005) continue; // skip noise
    const bucket =
      ownerOutstandingMap.get(p.ownerId) ?? {
        ownerId: p.ownerId,
        ownerName: p.ownerName,
        total: 0,
        properties: [],
      };
    bucket.total += outstanding;
    bucket.properties.push({
      id: p.id,
      name: p.name,
      color: p.color,
      outstanding,
    });
    ownerOutstandingMap.set(p.ownerId, bucket);
  }
  const ownerOutstanding = Array.from(ownerOutstandingMap.values())
    .map((o) => ({
      ...o,
      properties: o.properties.sort((a, b) => b.outstanding - a.outstanding),
    }))
    .sort((a, b) => b.total - a.total);

  // "Paid to owner" KPI — money the company actually disbursed to
  // owners. Only POSITIVE OwnerPayments count: negative payments come
  // from settling expense-only reports and represent owner-owes-company
  // (those flow into Owner debts instead), not cash flowing to the
  // owner. Counting them here would deflate the headline incorrectly.
  const paidPayments = await prisma.ownerPayment.findMany({
    where: { ...monthWhere, amount: { gt: 0 } },
    select: {
      id: true,
      amount: true,
      date: true,
      method: true,
      reference: true,
      reportId: true,
      owner: { select: { id: true, name: true, email: true } },
      property: { select: { name: true, color: true } },
    },
    orderBy: { date: "desc" },
  });
  const totalPaidToOwners = paidPayments.reduce((s, p) => s + p.amount, 0);
  type OwnerPaymentBreakdown = {
    ownerId: string;
    ownerName: string;
    total: number;
    payments: {
      id: string;
      amount: number;
      date: string;
      method: string | null;
      reference: string | null;
      propertyName: string | null;
      propertyColor: string | null;
      reportId: string | null;
    }[];
  };
  const paidByOwnerMap = new Map<string, OwnerPaymentBreakdown>();
  for (const p of paidPayments) {
    const ownerId = p.owner.id;
    const ownerName = p.owner.name ?? p.owner.email;
    const bucket =
      paidByOwnerMap.get(ownerId) ?? {
        ownerId,
        ownerName,
        total: 0,
        payments: [],
      };
    bucket.total += p.amount;
    bucket.payments.push({
      id: p.id,
      amount: p.amount,
      date: p.date.toISOString(),
      method: p.method,
      reference: p.reference,
      propertyName: p.property?.name ?? null,
      propertyColor: p.property?.color ?? null,
      reportId: p.reportId,
    });
    paidByOwnerMap.set(ownerId, bucket);
  }
  const paidByOwner = Array.from(paidByOwnerMap.values()).sort(
    (a, b) => b.total - a.total,
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
        // managementOnly drives the owner/company split — company-run
        // units have no owner share, so the full unpaid amount sits on
        // the company side.
        property: {
          select: { name: true, color: true, managementOnly: true },
        },
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
  // Unpaid receivables list — each row carries the would-be owner
  // payout AND a managementOnly flag so the UnpaidCard can show the
  // company / owner split at the top of the tile and inside each
  // drawer row. For management-only units there is no owner share; the
  // full totalPrice sits with the company.
  const unpaidReservations = [
    ...unpaidReservationRows.map((r) => ({
      id: r.id,
      kind: "reservation" as const,
      propertyName: r.property.name,
      propertyColor: r.property.color,
      managementOnly: r.property.managementOnly,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      totalPrice: r.totalPrice,
      payout: r.property.managementOnly ? 0 : r.payout,
      currency: r.currency,
    })),
    ...extensionRows
      .filter((e) => !e.paid && e.totalPrice > 0)
      .map((e) => ({
        id: e.id,
        kind: "extension" as const,
        propertyName: e.reservation.property.name,
        propertyColor: e.reservation.property.color,
        managementOnly: e.reservation.property.managementOnly,
        guestName: e.reservation.guestName,
        checkIn: e.checkIn.toISOString(),
        checkOut: e.checkOut.toISOString(),
        totalPrice: e.totalPrice,
        payout: e.reservation.property.managementOnly ? 0 : e.payout,
        currency: e.currency,
      })),
  ].sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
  const unpaidTotal = unpaidReservations.reduce(
    (s, r) => s + r.totalPrice,
    0,
  );
  // Owner side = sum of would-be payouts (already zeroed for
  // management-only units above). Company side = whatever's left.
  const unpaidOwnerTotal = unpaidReservations.reduce(
    (s, r) => s + r.payout,
    0,
  );
  const unpaidCompanyTotal = unpaidTotal - unpaidOwnerTotal;
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
  // Company profit math is untouched by the new flag — the SPEND row
  // recorded in Investment is purely informational (it's a draw on
  // invested capital, not an expense), and the OwnerDebt row will
  // eventually be settled by the owner.
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
          ownerTotal={unpaidOwnerTotal}
          companyTotal={unpaidCompanyTotal}
          count={unpaidCount}
          reservations={unpaidReservations}
        />
        <PendingExtensionsCard
          locale={loc}
          count={pendingExtensionsCount}
          extensions={pendingExtensions}
        />
        <OwnerPayoutCard
          locale={loc}
          total={totalOwnerOutstanding}
          ownerCount={ownerOutstanding.length}
          breakdown={ownerOutstanding}
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

      {/* Investments + Owner debts — both info-only, never fed into
          any KPI calculation. Tiles are clickable: investments → the
          investment ledger (income + spend), owner debts → list of
          unsettled IOUs. */}
      <div className="mt-3 grid auto-rows-fr grid-cols-1 gap-3 *:h-full md:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/${loc}/admin/company/investments`}
          className="contents"
        >
          <KpiTile
            label={`Investments · ${totalInvestmentsCount} in · ${totalInvestmentSpentCount} out`}
            value={formatCurrency(
              totalInvestments - totalInvestmentSpent,
              "AED",
              loc,
            )}
            accent="emerald"
            icon={<Banknote className="h-4 w-4" />}
          />
        </Link>
        <Link
          href={`/${loc}/admin/company/owner-debts`}
          className="contents"
        >
          <KpiTile
            label={`Owner debts · ${totalOwnerDebtsCount} pending`}
            value={formatCurrency(totalOwnerDebts, "AED", loc)}
            accent={totalOwnerDebtsCount > 0 ? "amber" : "indigo"}
            icon={<HandCoins className="h-4 w-4" />}
          />
        </Link>
        <PaidToOwnerCard
          locale={loc}
          total={totalPaidToOwners}
          paymentCount={paidPayments.length}
          ownerCount={paidByOwner.length}
          breakdown={paidByOwner}
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
