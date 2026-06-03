import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { InvestmentsView } from "./investments-view";

const PAGE_SIZE = 25;

export default async function InvestmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  const sp = await searchParams;
  const tab = sp.tab === "SPEND" ? "SPEND" : "INCOME";
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const [incomeCount, spendCount, entries, agg] = await Promise.all([
    prisma.investment.count({ where: { kind: "INCOME" } }),
    prisma.investment.count({ where: { kind: "SPEND" } }),
    prisma.investment.findMany({
      where: { kind: tab },
      include: {
        property: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.investment.groupBy({
      by: ["kind"],
      _sum: { amount: true },
    }),
  ]);
  const tabCount = tab === "INCOME" ? incomeCount : spendCount;
  const totalPages = Math.max(1, Math.ceil(tabCount / PAGE_SIZE));
  const totalIncome =
    agg.find((r) => r.kind === "INCOME")?._sum.amount ?? 0;
  const totalSpent = agg.find((r) => r.kind === "SPEND")?._sum.amount ?? 0;

  return (
    <InvestmentsView
      locale={locale as Locale}
      basePath={`/${locale}/admin/company/investments`}
      tab={tab}
      page={page}
      totalPages={totalPages}
      counts={{ INCOME: incomeCount, SPEND: spendCount }}
      totals={{ income: totalIncome, spent: totalSpent }}
      entries={entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        amount: e.amount,
        source: e.source,
        description: e.description,
        date: e.date.toISOString(),
        propertyId: e.propertyId,
        propertyName: e.property?.name ?? null,
        propertyColor: e.property?.color ?? null,
        expenseId: e.expenseId,
      }))}
    />
  );
}
