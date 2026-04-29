import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarCheck, Coins, User, Mail } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell";
import { formatCurrency } from "@/lib/utils";
import { PropertiesView } from "../../properties-view";

export default async function OwnerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const owner = await prisma.user.findUnique({
    where: { id },
    include: {
      properties: {
        include: {
          _count: { select: { reservations: true } },
          reservations: {
            select: { totalPrice: true, nights: true, checkIn: true, checkOut: true, currency: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!owner || owner.role !== "OWNER") notFound();

  const propertyIds = owner.properties.map((p) => p.id);
  const expenses = await prisma.expense.findMany({
    where: { propertyId: { in: propertyIds } },
    orderBy: { date: "desc" },
  });

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });

  const totalReservations = owner.properties.reduce((s, p) => s + p._count.reservations, 0);
  const totalRevenue = owner.properties
    .flatMap((p) => p.reservations)
    .reduce((s, r) => s + r.totalPrice, 0);
  const totalNights = owner.properties
    .flatMap((p) => p.reservations)
    .reduce((s, r) => s + r.nights, 0);

  const loc = locale as Locale;

  return (
    <div>
      <Link
        href={`/${locale}/admin/owners`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {tAdmin("navOwners")}
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-brand-soft)] text-[var(--color-brand)]">
              <User className="h-5 w-5" />
            </span>
            {owner.name ?? owner.email}
          </span>
        }
        subtitle={
          <span className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
            <Mail className="h-3.5 w-3.5" />
            {owner.email}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label={tCommon("properties")}
          value={owner.properties.length}
          icon={<Building2 className="h-4 w-4" />}
          accent="indigo"
        />
        <StatCard
          label={tCommon("reservations")}
          value={totalReservations}
          icon={<CalendarCheck className="h-4 w-4" />}
          accent="sky"
        />
        <StatCard
          label={tOwner("kpiNights")}
          value={totalNights}
          accent="emerald"
        />
        <StatCard
          label={tOwner("kpiRevenue")}
          value={formatCurrency(totalRevenue, "AED", loc)}
          icon={<Coins className="h-4 w-4" />}
          accent="amber"
        />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight">
          <Building2 className="h-4 w-4 text-[var(--color-brand)]" />
          {tCommon("properties")}
        </h2>
        <PropertiesView
          locale={loc}
          hideTitle
          lockedOwnerId={owner.id}
          properties={owner.properties.map((p) => ({
            id: p.id,
            name: p.name,
            address: p.address,
            airbnbIcalUrl: p.airbnbIcalUrl,
            basePrice: p.basePrice,
            cleaningFee: p.cleaningFee,
            color: p.color,
            notes: p.notes,
            ownerId: owner.id,
            ownerName: owner.name ?? owner.email,
            reservationCount: p._count.reservations,
            lastSyncedAt: p.lastSyncedAt ? p.lastSyncedAt.toISOString() : null,
          }))}
          owners={[{ id: owner.id, name: owner.name, email: owner.email }]}
          expenses={expenses.map((e) => ({
            id: e.id,
            propertyId: e.propertyId,
            date: e.date.toISOString(),
            type: e.type,
            description: e.description,
            amount: e.amount,
          }))}
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
          }}
        />
      </div>
    </div>
  );
}
