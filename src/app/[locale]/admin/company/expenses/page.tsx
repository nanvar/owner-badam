import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { CompanyFinancesView } from "./company-expenses-view";

const PAGE_SIZE = 25;

export default async function SuperAdminFinancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  const sp = await searchParams;
  const tab =
    sp.tab === "PROFIT" || sp.tab === "DEPOSIT" ? sp.tab : "EXPENSE";
  const fromStr = sp.from || "";
  const toStr = sp.to || "";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);
  const fromDate = fromStr ? new Date(fromStr) : null;
  const toDate = toStr ? new Date(toStr) : null;
  const toEndOfDay =
    toDate && !Number.isNaN(toDate.getTime())
      ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1)
      : null;
  const dateFilter =
    fromDate && toEndOfDay
      ? { date: { gte: fromDate, lte: toEndOfDay } }
      : fromDate
        ? { date: { gte: fromDate } }
        : toEndOfDay
          ? { date: { lte: toEndOfDay } }
          : {};

  // Always read counts for all 3 kinds so the tab badges stay accurate
  // regardless of which tab is currently active.
  const [
    expenseCount,
    profitCount,
    depositCount,
    pageEntries,
    activeDeposits,
    properties,
  ] = await Promise.all([
    prisma.companyExpense.count({
      where: { kind: "EXPENSE", ...dateFilter },
    }),
    prisma.companyExpense.count({
      where: { kind: "PROFIT", ...dateFilter },
    }),
    prisma.companyExpense.count({
      where: { kind: "DEPOSIT", ...dateFilter },
    }),
    prisma.companyExpense.findMany({
      where: { kind: tab, ...dateFilter },
      include: {
        property: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.companyExpense.aggregate({
      where: { kind: "DEPOSIT", refundedAt: null },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.property.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const tabCount =
    tab === "EXPENSE"
      ? expenseCount
      : tab === "PROFIT"
        ? profitCount
        : depositCount;
  const totalPages = Math.max(1, Math.ceil(tabCount / PAGE_SIZE));

  return (
    <CompanyFinancesView
      locale={locale as Locale}
      tab={tab}
      from={fromStr}
      to={toStr}
      page={page}
      totalPages={totalPages}
      counts={{
        EXPENSE: expenseCount,
        PROFIT: profitCount,
        DEPOSIT: depositCount,
      }}
      activeDepositsTotal={activeDeposits._sum.amount ?? 0}
      activeDepositsCount={activeDeposits._count._all}
      properties={properties}
      entries={pageEntries.map((e) => ({
        id: e.id,
        kind: e.kind,
        date: e.date.toISOString(),
        category: e.category,
        propertyId: e.propertyId,
        propertyName: e.property?.name ?? null,
        propertyColor: e.property?.color ?? null,
        description: e.description,
        amount: e.amount,
        refundedAt: e.refundedAt?.toISOString() ?? null,
        refundedAmount: e.refundedAmount,
      }))}
    />
  );
}
