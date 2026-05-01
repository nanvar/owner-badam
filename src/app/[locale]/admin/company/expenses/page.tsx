import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { CompanyExpensesView } from "./company-expenses-view";

export default async function SuperAdminExpensesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  const expenses = await prisma.companyExpense.findMany({
    orderBy: { date: "desc" },
    take: 500,
  });
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <CompanyExpensesView
      locale={locale as Locale}
      expenses={expenses.map((e) => ({
        id: e.id,
        date: e.date.toISOString(),
        category: e.category,
        description: e.description,
        amount: e.amount,
      }))}
      total={total}
    />
  );
}
