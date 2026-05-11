import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  buildMonthlySeries,
  computeKpis,
  periodFromRange,
  type ReservationLite,
} from "@/lib/metrics";
import { OwnerDashboardView } from "./dashboard-view";

export default async function OwnerDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireSession();
  const sp = await searchParams;
  const range = sp.range ?? "this-month";
  const period = periodFromRange(range);

  const ownerFilter =
    session.role === "OWNER" ? { property: { ownerId: session.userId } } : undefined;
  const extensionOwnerFilter =
    session.role === "OWNER"
      ? { reservation: { property: { ownerId: session.userId } } }
      : undefined;
  const propertyWhere =
    session.role === "OWNER" ? { ownerId: session.userId } : undefined;

  // Reservations + extensions are pulled together and treated as separate
  // bookings by the KPI math — extensions have their own check-in/out and
  // payout since iCal no longer rolls them into the parent reservation.
  const [reservations, extensions, propertyCount] = await Promise.all([
    prisma.reservation.findMany({
      where: ownerFilter ?? {},
      select: {
        nights: true,
        totalPrice: true,
        payout: true,
        cleaningFee: true,
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.reservationExtension.findMany({
      where: extensionOwnerFilter ?? {},
      select: {
        nights: true,
        totalPrice: true,
        payout: true,
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.property.count({ where: propertyWhere }),
  ]);

  const items: ReservationLite[] = [
    ...reservations.map((r) => ({
      id: "",
      propertyId: "",
      propertyName: "",
      propertyColor: "",
      guestName: null,
      numGuests: null,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      pricePerNight: 0,
      totalPrice: r.totalPrice,
      cleaningFee: r.cleaningFee,
      payout: r.payout,
      currency: "AED",
      detailsFilled: false,
    })),
    ...extensions.map((e) => ({
      id: "",
      propertyId: "",
      propertyName: "",
      propertyColor: "",
      guestName: null,
      numGuests: null,
      checkIn: e.checkIn,
      checkOut: e.checkOut,
      nights: e.nights,
      pricePerNight: 0,
      totalPrice: e.totalPrice,
      cleaningFee: 0,
      payout: e.payout,
      currency: "AED",
      detailsFilled: false,
    })),
  ];

  const kpis = computeKpis(items, propertyCount, period);
  const monthly = buildMonthlySeries(items, propertyCount, 12);

  const t = await getTranslations({ locale, namespace: "owner" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <OwnerDashboardView
      locale={locale as Locale}
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
      monthly={monthly}
      labels={{
        kpiRevenue: t("kpiRevenue"),
        kpiNights: t("kpiNights"),
        kpiOccupancy: t("kpiOccupancy"),
        kpiAdr: t("kpiAdr"),
        kpiRevpar: t("kpiRevpar"),
        kpiBookings: t("kpiBookings"),
        thisMonth: t("thisMonth"),
        lastMonth: t("lastMonth"),
        ytd: t("ytd"),
        last30: t("last30"),
        last90: t("last90"),
        monthlyRevenue: t("monthlyRevenueAll"),
        noData: tCommon("noData"),
      }}
    />
  );
}
