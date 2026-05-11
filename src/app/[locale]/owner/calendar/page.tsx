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

  // Pull each property's reservations + their extensions in a single
  // round-trip. Extensions render as their own calendar events so the
  // owner can see the full stay (original window + any add-on nights).
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
          extensions: {
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              nights: true,
              totalPrice: true,
              currency: true,
            },
            orderBy: { checkIn: "asc" },
          },
        },
        orderBy: { checkIn: "asc" },
      },
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });

  const today = Date.now();
  const items = properties.map((p) => {
    const reservationEvents = p.reservations.map((r) => ({
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
        kind: "reservation" as const,
      },
    }));
    const extensionEvents = p.reservations.flatMap((r) =>
      r.extensions.map((e) => ({
        id: e.id,
        title: `${r.guestName ?? "Guest"} (Ext)`,
        start: e.checkIn.toISOString(),
        end: e.checkOut.toISOString(),
        color: p.color,
        extendedProps: {
          propertyName: p.name,
          propertyColor: p.color,
          guestName: r.guestName ?? "Guest",
          nights: e.nights,
          totalPrice: e.totalPrice,
          currency: e.currency,
          pricePerNight: e.nights > 0 ? e.totalPrice / e.nights : 0,
          kind: "extension" as const,
        },
      })),
    );
    const events = [...reservationEvents, ...extensionEvents];
    // Future bookings = reservations or extensions whose check-in is
    // still ahead. Extensions count as their own booking.
    const futureCount = events.filter(
      (ev) => new Date(ev.start).getTime() > today,
    ).length;
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      color: p.color,
      reservationCount: p._count.reservations,
      upcomingCount: futureCount,
      events,
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
