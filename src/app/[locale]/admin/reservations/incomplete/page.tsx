import { setRequestLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { IncompleteReservationsView } from "./incomplete-view";

export default async function IncompleteReservationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const reservations = await prisma.reservation.findMany({
    where: { detailsFilled: false },
    include: {
      property: { select: { id: true, name: true, color: true } },
      extensions: { orderBy: { checkIn: "asc" } },
    },
    orderBy: { checkIn: "desc" },
  });

  const t = await getTranslations({ locale, namespace: "admin" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <IncompleteReservationsView
      locale={locale as Locale}
      backHref={`/${locale}/admin/reservations`}
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
        extensions: r.extensions.map((e) => ({
          id: e.id,
          reservationId: e.reservationId,
          checkIn: e.checkIn.toISOString(),
          checkOut: e.checkOut.toISOString(),
          nights: e.nights,
          totalPrice: e.totalPrice,
          agencyCommission: e.agencyCommission,
          portalCommission: e.portalCommission,
          payout: e.payout,
          currency: e.currency,
          notes: e.notes,
          paid: e.paid,
          monthKey: e.monthKey,
          detailsFilled: e.detailsFilled,
        })),
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
        fillDetails: t("fillDetails"),
        delete: tCommon("delete"),
        currency: tCommon("currency"),
      }}
    />
  );
}
