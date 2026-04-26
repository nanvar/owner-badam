import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { CalendarView } from "./calendar-view";

export default async function OwnerCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireSession();

  const where =
    session.role === "OWNER" ? { property: { ownerId: session.userId } } : undefined;

  const reservations = await prisma.reservation.findMany({
    where,
    include: { property: { select: { id: true, name: true, color: true } } },
    orderBy: { checkIn: "asc" },
  });

  const events = reservations.map((r) => ({
    id: r.id,
    title: `${r.guestName ?? "Guest"} · ${r.property.name}`,
    start: r.checkIn.toISOString(),
    end: r.checkOut.toISOString(),
    color: r.property.color,
    extendedProps: {
      propertyName: r.property.name,
      propertyColor: r.property.color,
      guestName: r.guestName ?? "Guest",
      nights: r.nights,
      totalPrice: r.totalPrice,
      currency: r.currency,
      pricePerNight: r.pricePerNight,
    },
  }));

  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <CalendarView
      locale={locale as Locale}
      events={events}
      title={t("calendar")}
    />
  );
}
