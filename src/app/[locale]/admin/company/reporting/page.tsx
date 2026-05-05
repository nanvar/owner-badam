import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency } from "@/lib/utils";
import { ReportingFilter } from "./reporting-filter";

export default async function ReportingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    ownerId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  const loc = locale as Locale;
  const sp = await searchParams;
  const filterOwnerId = sp.ownerId || "";
  const fromStr = sp.from || "";
  const toStr = sp.to || "";
  const fromDate = fromStr ? new Date(fromStr) : null;
  const toDate = toStr ? new Date(toStr) : null;
  const toEndOfDay =
    toDate && !Number.isNaN(toDate.getTime())
      ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1)
      : null;

  // Two date filters because reservations key off `checkIn` while expenses,
  // payments and CompanyExpense rows have their own `date` field.
  const reservationDateFilter =
    fromDate && toEndOfDay
      ? { checkIn: { gte: fromDate, lte: toEndOfDay } }
      : fromDate
        ? { checkIn: { gte: fromDate } }
        : toEndOfDay
          ? { checkIn: { lte: toEndOfDay } }
          : {};
  const dateFilter =
    fromDate && toEndOfDay
      ? { date: { gte: fromDate, lte: toEndOfDay } }
      : fromDate
        ? { date: { gte: fromDate } }
        : toEndOfDay
          ? { date: { lte: toEndOfDay } }
          : {};
  const propertyOwnerFilter = filterOwnerId
    ? { property: { ownerId: filterOwnerId } }
    : {};
  const propertyOwnerIdFilter = filterOwnerId ? { ownerId: filterOwnerId } : {};

  const [
    reservationAggs,
    expenseAggs,
    companyProfitAggs,
    properties,
    ownersList,
  ] = await Promise.all([
    prisma.reservation.groupBy({
      by: ["propertyId"],
      where: { upcoming: false, ...reservationDateFilter, ...propertyOwnerFilter },
      _sum: {
        totalPrice: true,
        agencyCommission: true,
        portalCommission: true,
        payout: true,
      },
    }),
    prisma.expense.groupBy({
      by: ["propertyId"],
      where: { ...dateFilter, ...propertyOwnerFilter },
      _sum: { amount: true },
    }),
    prisma.companyExpense.groupBy({
      by: ["propertyId"],
      where: { kind: "PROFIT", ...dateFilter, ...propertyOwnerFilter },
      _sum: { amount: true },
    }),
    prisma.property.findMany({
      where: propertyOwnerIdFilter,
      include: { owner: { select: { id: true, name: true, email: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "OWNER" },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  const reservationByProp = new Map(
    reservationAggs.map((a) => [a.propertyId, a]),
  );
  const expenseByProp = new Map(
    expenseAggs.map((a) => [a.propertyId, a._sum.amount ?? 0]),
  );
  const profitByProp = new Map(
    companyProfitAggs.map((a) => [a.propertyId ?? "", a._sum.amount ?? 0]),
  );

  // Per property:
  // - Owner profit  = payout − unit expense   (what the owner nets)
  // - Company profit = agency commission + extra company-profit entries
  // - Owner payout  = the same as owner profit (i.e. what we owe them)
  // The dashboard separately tracks how much of that has been paid; here
  // we focus on what's been earned in the period.
  const rows = properties
    .map((p) => {
      const r = reservationByProp.get(p.id);
      const unitExpense = expenseByProp.get(p.id) ?? 0;
      const totalPrice = r?._sum.totalPrice ?? 0;
      const payout = r?._sum.payout ?? 0;
      const agency = r?._sum.agencyCommission ?? 0;
      const extra = profitByProp.get(p.id) ?? 0;
      const ownerProfit = Math.max(0, payout - unitExpense);
      const companyProfit = agency + extra;
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        ownerId: p.owner.id,
        ownerName: p.owner.name ?? p.owner.email,
        totalPrice,
        unitExpense,
        ownerProfit,
        companyProfit,
        ownerPayout: ownerProfit,
      };
    })
    .filter(
      (r) =>
        r.totalPrice > 0 ||
        r.unitExpense > 0 ||
        r.companyProfit > 0,
    );

  const totals = rows.reduce(
    (acc, r) => ({
      ownerProfit: acc.ownerProfit + r.ownerProfit,
      companyProfit: acc.companyProfit + r.companyProfit,
      unitExpense: acc.unitExpense + r.unitExpense,
      ownerPayout: acc.ownerPayout + r.ownerPayout,
    }),
    { ownerProfit: 0, companyProfit: 0, unitExpense: 0, ownerPayout: 0 },
  );

  const basePath = `/${loc}/admin/company/reporting`;

  return (
    <div>
      <PageHeader title="Reporting" />

      <ReportingFilter
        owners={ownersList.map((o) => ({
          id: o.id,
          name: o.name ?? o.email,
        }))}
        ownerId={filterOwnerId}
        from={fromStr}
        to={toStr}
        basePath={basePath}
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Property</th>
                <th className="px-4 py-3 text-left font-semibold">Owner</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Owner profit
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Company profit
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Unit expenses
                </th>
                <th className="px-4 py-3 text-right font-semibold">
                  Owner payout
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
                  >
                    No activity in this period.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-1 shrink-0 rounded-full"
                          style={{ background: r.color }}
                        />
                        <span className="font-semibold">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${loc}/admin/owners/${r.ownerId}`}
                        className="text-[var(--color-muted)] underline-offset-4 hover:text-[var(--color-brand)] hover:underline"
                      >
                        {r.ownerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatCurrency(r.ownerProfit, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                      {formatCurrency(r.companyProfit, "AED", loc)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-rose-600">
                      {r.unitExpense > 0
                        ? `− ${formatCurrency(r.unitExpense, "AED", loc)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-bold">
                      {formatCurrency(r.ownerPayout, "AED", loc)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-[var(--color-surface-2)]/60 text-sm">
                <tr className="border-t border-[var(--color-border)]">
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]"
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    {formatCurrency(totals.ownerProfit, "AED", loc)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-700">
                    {formatCurrency(totals.companyProfit, "AED", loc)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-rose-600">
                    {formatCurrency(totals.unitExpense, "AED", loc)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    {formatCurrency(totals.ownerPayout, "AED", loc)}
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
