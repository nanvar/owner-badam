import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LedgerView } from "./ledger-view";

export default async function AdminLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;
  const initialPropertyId = sp.propertyId ?? "";

  const [properties, expenses] = await Promise.all([
    prisma.property.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expense.findMany({
      include: { property: { select: { name: true, color: true } } },
      orderBy: { date: "desc" },
      take: 200,
    }),
  ]);

  const t = await getTranslations({ locale, namespace: "admin" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <LedgerView
      locale={locale as Locale}
      initialPropertyId={initialPropertyId}
      properties={properties}
      expenses={expenses.map((e) => ({
        id: e.id,
        propertyId: e.propertyId,
        propertyName: e.property.name,
        propertyColor: e.property.color,
        date: e.date.toISOString(),
        type: e.type,
        description: e.description,
        amount: e.amount,
      }))}
      labels={{
        title: t("navExpenses"),
        addExpense: t("addExpense"),
        editExpense: t("editExpense"),
        date: t("date"),
        property: t("property"),
        type: t("type"),
        description: t("description"),
        amount: t("amount"),
        save: tCommon("save"),
        cancel: tCommon("cancel"),
        delete: tCommon("delete"),
        deleteConfirm: t("deleteLedgerConfirm"),
        all: tCommon("all"),
        noEntries: t("noLedgerEntries"),
        currency: tCommon("currency"),
      }}
    />
  );
}
