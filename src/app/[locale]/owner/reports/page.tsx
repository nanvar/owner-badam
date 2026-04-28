import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ReportPropertyPicker } from "./report-property-picker";

export default async function OwnerReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const settings = await getSettings();

  const properties = await prisma.property.findMany({
    where: { ownerId: session.userId },
    select: {
      id: true,
      name: true,
      address: true,
      color: true,
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const t = await getTranslations({ locale, namespace: "owner" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });

  return (
    <ReportPropertyPicker
      locale={locale as Locale}
      ownerName={session.name ?? session.email}
      properties={properties.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        color: p.color,
        reservationCount: p._count.reservations,
      }))}
      brand={{
        name: settings.brandName,
        legalName: settings.legalName,
        email: settings.email,
        phone: settings.phone,
        website: settings.website,
      }}
      labels={{
        title: tCommon("reports"),
        allProperties: t("byProperty"),
        noProperties: t("noProperties"),
        reservations: tCommon("reservations"),
        thisMonth: t("thisMonth"),
        lastMonth: t("lastMonth"),
        last30: t("last30"),
        last90: t("last90"),
        ytd: t("ytd"),
        kpiRevenue: t("kpiRevenue"),
        kpiNights: t("kpiNights"),
        kpiOccupancy: t("kpiOccupancy"),
        kpiAdr: t("kpiAdr"),
        kpiRevpar: t("kpiRevpar"),
        kpiBookings: t("kpiBookings"),
        kpiAvgStay: t("kpiAvgStay"),
        guest: t("guest"),
        payout: tAdmin("payout"),
        loading: tCommon("loading"),
        noData: tCommon("noData"),
        excel: "Excel",
        pdf: "PDF",
      }}
    />
  );
}
