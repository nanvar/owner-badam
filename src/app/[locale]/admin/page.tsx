import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { PropertiesView } from "./properties-view";

export default async function AdminPropertiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const [properties, owners] = await Promise.all([
    prisma.property.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { reservations: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      where: { role: "OWNER" },
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const t = await getTranslations({ locale, namespace: "admin" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <PropertiesView
      locale={locale as Locale}
      properties={properties.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        airbnbIcalUrl: p.airbnbIcalUrl,
        basePrice: p.basePrice,
        cleaningFee: p.cleaningFee,
        color: p.color,
        notes: p.notes,
        ownerId: p.ownerId,
        ownerName: p.owner.name ?? p.owner.email,
        reservationCount: p._count.reservations,
        lastSyncedAt: p.lastSyncedAt ? p.lastSyncedAt.toISOString() : null,
      }))}
      owners={owners.map((o) => ({ id: o.id, name: o.name, email: o.email }))}
      labels={{
        title: tCommon("properties"),
        addProperty: t("addProperty"),
        editProperty: t("editProperty"),
        deleteConfirm: t("deleteConfirm"),
        name: t("name"),
        address: t("address"),
        icalUrl: t("icalUrl"),
        basePrice: t("basePrice"),
        cleaningFee: t("cleaningFee"),
        color: t("color"),
        owner: t("owner"),
        notes: tCommon("notes"),
        save: tCommon("save"),
        cancel: tCommon("cancel"),
        edit: tCommon("edit"),
        delete: tCommon("delete"),
        noProperties: t("noProperties"),
        syncNow: tCommon("syncNow"),
        syncing: tCommon("syncing"),
        lastSynced: tCommon("lastSynced"),
        never: tCommon("never"),
        currency: tCommon("currency"),
        syncDescription: t("syncDescription"),
        reservations: tCommon("reservations"),
        actions: tCommon("actions"),
      }}
    />
  );
}
