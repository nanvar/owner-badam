import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
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

  const properties = await prisma.property.findMany({
    where: { ownerId: session.userId },
    select: {
      id: true,
      name: true,
      address: true,
      color: true,
      createdAt: true,
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const earliestCreatedAt = properties.length
    ? properties.reduce((m, p) => (p.createdAt < m ? p.createdAt : m), properties[0].createdAt)
    : null;

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
        createdAt: p.createdAt.toISOString(),
        reservationCount: p._count.reservations,
      }))}
      earliestCreatedAt={earliestCreatedAt ? earliestCreatedAt.toISOString() : null}
      labels={{
        title: tCommon("reports"),
        allProperties: t("allProperties"),
        noProperties: t("noProperties"),
        reservations: tCommon("reservations"),
        guest: t("guest"),
        payout: tAdmin("payout"),
        loading: tCommon("loading"),
        noData: tCommon("noData"),
        pdf: t("downloadPdf"),
        selectMonth: t("selectMonth"),
        noMonthsAvailable: t("noMonthsAvailable"),
      }}
    />
  );
}
