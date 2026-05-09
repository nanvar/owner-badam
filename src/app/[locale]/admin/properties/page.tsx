import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/app-shell";
import { PropertiesView } from "../properties-view";

export default async function AdminPropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");

  const [properties, owners] = await Promise.all([
    prisma.property.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { reservations: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "OWNER" },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
  ]);

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });
  const loc = locale as Locale;

  return (
    <div>
      <PageHeader title={tCommon("properties")} />

      <PropertiesView
        locale={loc}
        hideTitle
        forceTable
        searchable
        properties={properties.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          airbnbIcalUrl: p.airbnbIcalUrl,
          airbnbUrl: p.airbnbUrl,
          basePrice: p.basePrice,
          cleaningFee: p.cleaningFee,
          color: p.color,
          notes: p.notes,
          ownerId: p.owner.id,
          ownerName: p.owner.name ?? p.owner.email,
          reservationCount: p._count.reservations,
          lastSyncedAt: p.lastSyncedAt ? p.lastSyncedAt.toISOString() : null,
          createdAt: p.createdAt.toISOString(),
        }))}
        owners={owners}
        labels={{
          title: tCommon("properties"),
          addProperty: tAdmin("addProperty"),
          editProperty: tAdmin("editProperty"),
          deleteConfirm: tAdmin("deleteConfirm"),
          name: tAdmin("name"),
          address: tAdmin("address"),
          icalUrl: tAdmin("icalUrl"),
          basePrice: tAdmin("basePrice"),
          cleaningFee: tAdmin("cleaningFee"),
          color: tAdmin("color"),
          owner: tAdmin("owner"),
          notes: tCommon("notes"),
          save: tCommon("save"),
          cancel: tCommon("cancel"),
          edit: tCommon("edit"),
          delete: tCommon("delete"),
          noProperties: tAdmin("noProperties"),
          syncNow: tCommon("syncNow"),
          syncing: tCommon("syncing"),
          lastSynced: tCommon("lastSynced"),
          never: tCommon("never"),
          currency: tCommon("currency"),
          syncDescription: tAdmin("syncDescription"),
          reservations: tCommon("reservations"),
          actions: tCommon("actions"),
          expenses: tAdmin("navExpenses"),
          showExpenses: tAdmin("showExpenses"),
          addExpense: tAdmin("addExpense"),
          editExpense: tAdmin("editExpense"),
          noExpenses: tAdmin("noExpenses"),
          total: tAdmin("total"),
          date: tAdmin("date"),
          type: tAdmin("type"),
          description: tAdmin("description"),
          amount: tAdmin("amount"),
          deleteLedgerConfirm: tAdmin("deleteLedgerConfirm"),
          recordPayment: tAdmin("recordPayment"),
          payments: tAdmin("payments"),
          showProperty: tAdmin("showProperty"),
          paid: tAdmin("paid"),
          totalPaid: tAdmin("totalPaid"),
          noPayments: tAdmin("noPayments"),
          paymentMethod: tAdmin("paymentMethod"),
          paymentReference: tAdmin("paymentReference"),
          deletePaymentConfirm: tAdmin("deletePaymentConfirm"),
        }}
      />
    </div>
  );
}
