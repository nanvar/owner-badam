import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PropertyCalendarPicker } from "./property-calendar-picker";

export default async function OwnerCalendarPage({
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
    include: {
      reservations: {
        select: {
          id: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          nights: true,
          pricePerNight: true,
          totalPrice: true,
          currency: true,
        },
        orderBy: { checkIn: "asc" },
      },
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });

  const items = properties.map((p) => {
    const upcomingCount = p.reservations.filter(
      (r) => new Date(r.checkOut) >= new Date(),
    ).length;
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      color: p.color,
      reservationCount: p._count.reservations,
      upcomingCount,
      events: p.reservations.map((r) => ({
        id: r.id,
        title: r.guestName ?? "Guest",
        start: r.checkIn.toISOString(),
        end: r.checkOut.toISOString(),
        color: p.color,
        extendedProps: {
          propertyName: p.name,
          propertyColor: p.color,
          guestName: r.guestName ?? "Guest",
          nights: r.nights,
          totalPrice: r.totalPrice,
          currency: r.currency,
          pricePerNight: r.pricePerNight,
        },
      })),
    };
  });

  return (
    <PropertyCalendarPicker
      locale={locale as Locale}
      properties={items}
      labels={{
        title: tCommon("calendar"),
        noProperties: tOwner("noProperties"),
        upcoming: tOwner("upcoming"),
        reservations: tCommon("reservations"),
      }}
    />
  );
}
