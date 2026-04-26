import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ReportsView } from "./reports-view";

export default async function OwnerReportsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireSession();
  const settings = await getSettings();

  const where = session.role === "OWNER" ? { ownerId: session.userId } : undefined;
  const properties = await prisma.property.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const t = await getTranslations({ locale, namespace: "owner" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tAdmin = await getTranslations({ locale, namespace: "admin" });

  return (
    <ReportsView
      locale={locale as Locale}
      ownerName={session.name ?? session.email}
      properties={properties}
      brand={{
        name: settings.brandName,
        legalName: settings.legalName,
        email: settings.email,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        website: settings.website,
        address: settings.address,
      }}
      labels={{
        title: tCommon("reports"),
        period: t("reportPeriod"),
        property: t("reportProperty"),
        all: tCommon("all"),
        from: tCommon("from"),
        to: tCommon("to"),
        thisMonth: t("thisMonth"),
        lastMonth: t("lastMonth"),
        last30: t("last30"),
        last90: t("last90"),
        ytd: t("ytd"),
        custom: t("custom"),
        summary: t("reportSummary"),
        reservationsLabel: t("reportReservations"),
        kpiRevenue: t("kpiRevenue"),
        kpiNights: t("kpiNights"),
        kpiOccupancy: t("kpiOccupancy"),
        kpiAdr: t("kpiAdr"),
        kpiRevpar: t("kpiRevpar"),
        kpiBookings: t("kpiBookings"),
        kpiAvgStay: t("kpiAvgStay"),
        kpiAdrFull: t("kpiAdrFull"),
        kpiRevparFull: t("kpiRevparFull"),
        payout: tAdmin("payout"),
        guest: t("guest"),
        currency: tCommon("currency"),
        exportPdf: tCommon("exportPdf"),
        exportExcel: tCommon("exportExcel"),
        exportLabel: tCommon("export"),
        exportHint: tCommon("exportHint"),
        noData: tCommon("noData"),
        tabOverview: t("tabOverview"),
        byProperty: t("byProperty"),
      }}
    />
  );
}
