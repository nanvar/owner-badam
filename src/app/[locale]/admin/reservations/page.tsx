import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { monthKeyFor, monthLabel } from "@/lib/utils";
import { ReservationsView } from "./reservations-view";

export default async function ReservationsAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const sp = await searchParams;

  // Union of every monthKey across the bookkeeping tables so the picker
  // matches the dashboard / finances pages exactly.
  const [resMonths, expMonths, coMonths, payMonths] = await Promise.all([
    prisma.reservation.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
    prisma.expense.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
    prisma.companyExpense.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
    prisma.ownerPayment.findMany({
      where: { monthKey: { not: null } },
      select: { monthKey: true },
      distinct: ["monthKey"],
    }),
  ]);
  const currentMonth = monthKeyFor(new Date());
  const monthSet = new Set<string>([currentMonth]);
  for (const r of resMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of expMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of coMonths) if (r.monthKey) monthSet.add(r.monthKey);
  for (const r of payMonths) if (r.monthKey) monthSet.add(r.monthKey);
  const monthOpts = [...monthSet]
    .sort()
    .reverse()
    .map((k) => ({ key: k, label: monthLabel(k, locale) }));
  const selectedMonth =
    sp.month && monthSet.has(sp.month) ? sp.month : currentMonth;

  const [reservations, propertyOptions] = await Promise.all([
    prisma.reservation.findMany({
      where: { monthKey: selectedMonth },
      include: { property: { select: { id: true, name: true, color: true } } },
      orderBy: { checkIn: "desc" },
    }),
    prisma.property.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const t = await getTranslations({ locale, namespace: "admin" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <ReservationsView
      locale={locale as Locale}
      properties={propertyOptions}
      monthOptions={monthOpts}
      selectedMonth={selectedMonth}
      basePath={`/${locale}/admin/reservations`}
      items={reservations.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.property.name,
        propertyColor: r.property.color,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        guestEmail: r.guestEmail,
        numGuests: r.numGuests,
        checkIn: r.checkIn.toISOString(),
        checkOut: r.checkOut.toISOString(),
        nights: r.nights,
        pricePerNight: r.pricePerNight,
        cleaningFee: r.cleaningFee,
        agencyCommission: r.agencyCommission,
        portalCommission: r.portalCommission,
        serviceFee: r.serviceFee,
        taxes: r.taxes,
        totalPrice: r.totalPrice,
        payout: r.payout,
        currency: r.currency,
        notes: r.notes,
        detailsFilled: r.detailsFilled,
        paid: r.paid,
        rawSummary: r.rawSummary,
      }))}
      labels={{
        title: tCommon("reservations"),
        property: tCommon("properties").replace(/s$/, ""),
        guestName: t("guestName"),
        numGuests: t("numGuests"),
        checkIn: t("checkIn"),
        checkOut: t("checkOut"),
        nights: t("nights"),
        pricePerNight: t("pricePerNight"),
        totalPrice: t("totalPrice"),
        cleaningFee: t("cleaningFee"),
        agencyCommission: t("agencyCommission"),
        portalCommission: t("portalCommission"),
        amountHint: t("amountHint"),
        advancedFees: t("advancedFees"),
        serviceFee: t("serviceFee"),
        taxes: t("taxes"),
        payout: t("payout"),
        notes: tCommon("notes"),
        save: t("saveDetails"),
        cancel: tCommon("cancel"),
        newReservation: t("newReservation"),
        newReservationHint: t("newReservationHint"),
        fillDetails: t("fillDetails"),
        delete: tCommon("delete"),
        currency: tCommon("currency"),
        all: tCommon("all"),
        syncNow: tCommon("syncNow"),
        syncing: tCommon("syncing"),
      }}
    />
  );
}
