import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ExtensionsView } from "./extensions-view";

export default async function ReservationExtensionsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireRole("ADMIN");

  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true, color: true } },
      extensions: { orderBy: { checkIn: "asc" } },
    },
  });
  if (!reservation) notFound();

  return (
    <ExtensionsView
      locale={locale as Locale}
      backHref={`/${locale}/admin/reservations`}
      reservation={{
        id: reservation.id,
        propertyName: reservation.property.name,
        propertyColor: reservation.property.color,
        guestName: reservation.guestName,
        checkIn: reservation.checkIn.toISOString(),
        checkOut: reservation.checkOut.toISOString(),
        nights: reservation.nights,
        totalPrice: reservation.totalPrice,
        currency: reservation.currency,
        paid: reservation.paid,
      }}
      extensions={reservation.extensions.map((e) => ({
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
      }))}
    />
  );
}
