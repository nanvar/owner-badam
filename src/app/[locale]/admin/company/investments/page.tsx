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
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const [count, entries, totals] = await Promise.all([
    prisma.investment.count(),
    prisma.investment.findMany({
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.investment.aggregate({ _sum: { amount: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <InvestmentsView
      locale={locale as Locale}
      basePath={`/${locale}/admin/company/investments`}
      page={page}
      totalPages={totalPages}
      totalCount={count}
      totalAmount={totals._sum.amount ?? 0}
      entries={entries.map((e) => ({
        id: e.id,
        amount: e.amount,
        source: e.source,
        description: e.description,
        date: e.date.toISOString(),
      }))}
    />
  );
}
