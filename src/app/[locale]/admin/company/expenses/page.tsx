import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { monthLabel } from "@/lib/utils";
import { CompanyFinancesView } from "./company-expenses-view";

const PAGE_SIZE = 25;

export default async function SuperAdminFinancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    tab?: string;
    month?: string;
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
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  // Distinct months CompanyExpense rows are bucketed into so the picker
  // only ever surfaces real periods. Current month is always included so
  // a fresh DB still has a sensible default.
  // Same union the dashboard surfaces, so the picker reads identically
  // across the admin section regardless of which table actually holds
  // the data for a given month.
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
    .map((k) => ({ key: k, label: monthLabel(k, locale) }));
  const selectedMonth =
    sp.month && monthSet.has(sp.month) ? sp.month : "";
  // Empty selectedMonth = "All months" — drop the monthKey constraint
  // so every period rolls into the visible list.
  const monthWhere = selectedMonth ? { monthKey: selectedMonth } : {};

  // All counts/lists scoped to the selected billing month (or all when
  // no month is selected). Active-deposit tile obeys the same filter so
  // the page reads consistently.
  const [
    expenseCount,
    profitCount,
    depositCount,
    pageEntries,
    activeDeposits,
    properties,
  ] = await Promise.all([
    prisma.companyExpense.count({
      where: { kind: "EXPENSE", ...monthWhere },
    }),
    prisma.companyExpense.count({
      where: { kind: "PROFIT", ...monthWhere },
    }),
    prisma.companyExpense.count({
      where: { kind: "DEPOSIT", ...monthWhere },
    }),
    prisma.companyExpense.findMany({
      where: { kind: tab, ...monthWhere },
      include: {
        property: { select: { id: true, name: true, color: true } },
      },
      // PROFIT lists unpaid entries first so admins immediately see
      // what still needs collecting. EXPENSE/DEPOSIT keep the simple
      // date-desc order since their "paid" column never varies.
      orderBy:
        tab === "PROFIT"
          ? [{ paid: "asc" }, { date: "desc" }]
          : { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.companyExpense.aggregate({
      where: { kind: "DEPOSIT", refundedAt: null, ...monthWhere },
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
      monthOptions={monthOpts}
      selectedMonth={selectedMonth}
      basePath={`/${locale}/admin/company/expenses`}
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
        paid: e.paid,
        refundedAt: e.refundedAt?.toISOString() ?? null,
        refundedAmount: e.refundedAmount,
      }))}
    />
  );
}
