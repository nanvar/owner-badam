import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, MapPin, FileText } from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeKpis, periodFromRange } from "@/lib/metrics";
import { PeriodHero } from "./period-hero";
import { ReservationsTabs } from "./reservations-tabs";
import { CalendarView } from "@/app/[locale]/owner/calendar/calendar-view";
import { Calendar as CalendarIcon } from "lucide-react";

export default async function ApartmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireRole("OWNER");
  const sp = await searchParams;
  const range = sp.range ?? "this-month";
  const period = periodFromRange(range);

  const property = await prisma.property.findFirst({
    where: { id, ownerId: session.userId },
    include: {
      reservations: {
        orderBy: { checkIn: "asc" },
      },
    },
  });
  if (!property) notFound();

  const tCommon = await getTranslations({ locale, namespace: "common" });
  const tOwner = await getTranslations({ locale, namespace: "owner" });
  const loc = locale as Locale;
  const today = new Date();

  // KPIs scoped to this property + selected period
  const kpiItems = property.reservations.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    propertyName: property.name,
    propertyColor: property.color,
    guestName: r.guestName,
    numGuests: r.numGuests,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    nights: r.nights,
    pricePerNight: r.pricePerNight,
    totalPrice: r.totalPrice,
    cleaningFee: r.cleaningFee,
    payout: r.payout,
    currency: r.currency,
    detailsFilled: r.detailsFilled,
  }));
  const kpis = computeKpis(kpiItems, 1, period);

  const upcoming = property.reservations
    .filter((r) => r.checkOut >= today)
    .map((r) => ({
      id: r.id,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      pricePerNight: r.pricePerNight,
      totalPrice: r.totalPrice,
      currency: r.currency,
    }));
  const past = property.reservations
    .filter((r) => r.checkOut < today)
    .reverse()
    .map((r) => ({
      id: r.id,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      pricePerNight: r.pricePerNight,
      totalPrice: r.totalPrice,
      currency: r.currency,
    }));

  const calendarEvents = property.reservations.map((r) => ({
    id: r.id,
    title: `${r.guestName ?? tOwner("guest")}`,
    start: r.checkIn.toISOString(),
    end: r.checkOut.toISOString(),
    color: property.color,
    extendedProps: {
      propertyName: property.name,
      propertyColor: property.color,
      guestName: r.guestName ?? tOwner("guest"),
      nights: r.nights,
      totalPrice: r.totalPrice,
      currency: r.currency,
      pricePerNight: r.pricePerNight,
    },
  }));

  return (
    <div className="space-y-5">
      <Link
        href={`/${locale}/owner/apartments`}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {tOwner("myProperties")}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
            style={{ background: property.color }}
          >
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight md:text-xl">
              {property.name}
            </h1>
            {property.address && (
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--color-muted)]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{property.address}</span>
              </div>
            )}
          </div>
        </div>
        <Link
          href={`/${locale}/owner/reports?propertyId=${property.id}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--color-brand)] px-3 text-sm font-medium text-white shadow-sm shadow-emerald-700/25 hover:bg-[var(--color-brand-hover)]"
        >
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">{tCommon("reports")}</span>
        </Link>
      </div>

      <PeriodHero
        locale={loc}
        range={range}
        kpis={{
          revenue: kpis.revenue,
          bookings: kpis.bookings,
          nights: kpis.nights,
          availableNights: kpis.availableNights,
          occupancy: kpis.occupancy,
          adr: kpis.adr,
          revpar: kpis.revpar,
        }}
        labels={{
          revenue: tOwner("kpiRevenue"),
          bookings: tOwner("kpiBookings"),
          nights: tOwner("kpiNights"),
          occupancy: tOwner("kpiOccupancy"),
          adr: tOwner("kpiAdr"),
          revpar: tOwner("kpiRevpar"),
          thisMonth: tOwner("thisMonth"),
          lastMonth: tOwner("lastMonth"),
          last30: tOwner("last30"),
          last90: tOwner("last90"),
          ytd: tOwner("ytd"),
        }}
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-[var(--color-brand)]" />
          <h2 className="text-base font-bold tracking-tight">
            {tCommon("calendar")}
          </h2>
        </div>
        <CalendarView locale={loc} events={calendarEvents} embedded />
      </section>

      <ReservationsTabs
        upcoming={upcoming}
        past={past}
        locale={loc}
        labels={{
          upcoming: tOwner("upcoming"),
          past: tCommon("reservations"),
          noUpcoming: tOwner("noUpcoming"),
          noPast: tCommon("noData"),
          guest: tOwner("guest"),
          total: tCommon("total"),
        }}
      />
    </div>
  );
}
