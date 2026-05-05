import { setRequestLocale } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { CompanyFinancesView } from "./company-expenses-view";

export default async function SuperAdminFinancesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("SUPERADMIN");

  const [entries, properties] = await Promise.all([
    prisma.companyExpense.findMany({
      include: {
        property: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "desc" },
      take: 500,
    }),
    prisma.property.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <CompanyFinancesView
      locale={locale as Locale}
      properties={properties}
      entries={entries.map((e) => ({
        id: e.id,
        kind: e.kind,
        date: e.date.toISOString(),
        category: e.category,
        propertyId: e.propertyId,
        propertyName: e.property?.name ?? null,
        propertyColor: e.property?.color ?? null,
        description: e.description,
        amount: e.amount,
      }))}
    />
  );
}
