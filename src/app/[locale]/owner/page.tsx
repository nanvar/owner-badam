import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  buildMonthlySeries,
  buildPropertySeries,
  computeKpis,
  computeTrend,
  computeStreak,
  computeScore,
  computeAchievements,
  periodFromRange,
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

  const propertyWhere = session.role === "OWNER" ? { ownerId: session.userId } : undefined;
  const [reservations, properties] = await Promise.all([
    prisma.reservation.findMany({
      where: ownerFilter,
      include: { property: { select: { name: true, color: true } } },
      orderBy: { checkIn: "asc" },
    }),
    prisma.property.findMany({
      where: propertyWhere,
      include: { _count: { select: { reservations: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const propertyCount = properties.length;

  const items = reservations.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    propertyName: r.property.name,
    propertyColor: r.property.color,
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

  const kpis = computeKpis(items, propertyCount, period);
  const monthly = buildMonthlySeries(items, propertyCount, 12);
  const byProperty = buildPropertySeries(items, period);
  const trend = computeTrend(monthly);
  const streak = computeStreak(monthly);
  const score = computeScore(kpis, propertyCount);
  const lifetime = items.reduce(
    (acc, r) => {
      acc.nights += r.nights;
      acc.revenue += r.totalPrice;
      return acc;
    },
    { nights: 0, revenue: 0 },
  );
  const achievements = computeAchievements({
    totalNights: lifetime.nights,
    totalReservations: items.length,
    totalRevenue: lifetime.revenue,
    streakMonths: streak,
    topProperty: byProperty[0]
      ? { name: byProperty[0].propertyName, revenue: byProperty[0].revenue }
      : undefined,
  });

  const upcoming = items
    .filter((r) => r.checkIn >= new Date())
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      propertyName: r.propertyName,
      propertyColor: r.propertyColor,
      guestName: r.guestName,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      totalPrice: r.totalPrice,
      currency: r.currency,
    }));

  const t = await getTranslations({ locale, namespace: "owner" });
  const tCommon = await getTranslations({ locale, namespace: "common" });

  return (
    <OwnerDashboardView
      locale={locale as Locale}
      welcome={t("welcome", { name: session.name ?? session.email })}
      range={range}
      kpis={{
        revenue: kpis.revenue,
        payout: kpis.payout,
        bookings: kpis.bookings,
        nights: kpis.nights,
        availableNights: kpis.availableNights,
        occupancy: kpis.occupancy,
        adr: kpis.adr,
        revpar: kpis.revpar,
        avgStay: kpis.avgStay,
      }}
      monthly={monthly}
      byProperty={byProperty}
      upcoming={upcoming}
      trend={trend}
      streak={streak}
      score={score}
      achievements={achievements}
      lifetime={lifetime}
      properties={properties.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        color: p.color,
        basePrice: p.basePrice,
        cleaningFee: p.cleaningFee,
        reservationCount: p._count.reservations,
      }))}
      labels={{
        kpiRevenue: t("kpiRevenue"),
        kpiNights: t("kpiNights"),
        kpiOccupancy: t("kpiOccupancy"),
        kpiAdr: t("kpiAdr"),
        kpiAdrFull: t("kpiAdrFull"),
        kpiRevpar: t("kpiRevpar"),
        kpiRevparFull: t("kpiRevparFull"),
        kpiBookings: t("kpiBookings"),
        kpiAvgStay: t("kpiAvgStay"),
        filterRange: t("filterRange"),
        thisMonth: t("thisMonth"),
        lastMonth: t("lastMonth"),
        ytd: t("ytd"),
        last30: t("last30"),
        last90: t("last90"),
        monthlyRevenue: t("monthlyRevenue"),
        occupancyTrend: t("occupancyTrend"),
        byProperty: t("byProperty"),
        upcoming: t("upcoming"),
        noUpcoming: t("noUpcoming"),
        currency: tCommon("currency"),
        guest: t("guest"),
        checkinShort: t("checkinShort"),
        checkoutShort: t("checkoutShort"),
        noData: tCommon("noData"),
        properties: t("myProperties"),
        basePrice: t("basePrice"),
        cleaningFee: t("cleaningFee"),
        reservations: tCommon("reservations"),
        noProperties: t("noProperties"),
        viewAll: tCommon("viewAll"),
      }}
    />
  );
}
