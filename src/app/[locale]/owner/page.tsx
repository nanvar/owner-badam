import { setRequestLocale, getTranslations } from "next-intl/server";
import { isLocale, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import {
  buildMonthlySeries,
  computeKpis,
  type ReservationLite,
} from "@/lib/metrics";
import { monthLabel } from "@/lib/utils";
import { readMyEasyMode } from "@/lib/notification-prefs-server";
import { OwnerDashboardView } from "./dashboard-view";

export default async function OwnerDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const session = await requireSession();
  const sp = await searchParams;
  const loc = locale as Locale;

  const ownerFilter =
    session.role === "OWNER" ? { property: { ownerId: session.userId } } : undefined;
  const extensionOwnerFilter =
    session.role === "OWNER"
      ? { reservation: { property: { ownerId: session.userId } } }
      : undefined;
  const propertyWhere =
    session.role === "OWNER" ? { ownerId: session.userId } : undefined;

  // Reservations + extensions pulled in full (no month filter) — the
  // monthly chart needs the rolling 12-month context regardless of the
  // selected slice, and we filter for KPIs in JS to avoid duplicate
  // queries.
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
        monthKey: true,
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
        monthKey: true,
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.property.count({ where: propertyWhere }),
  ]);

  // Distinct months for the picker — union across both tables.
  const monthSet = new Set<string>();
  for (const r of reservations) if (r.monthKey) monthSet.add(r.monthKey);
  for (const e of extensions) if (e.monthKey) monthSet.add(e.monthKey);
  const monthOpts = [...monthSet]
    .sort()
    .reverse()
    .map((k) => ({ key: k, label: monthLabel(k, locale) }));
  const selectedMonth =
    sp.month && monthSet.has(sp.month) ? sp.month : "";

  // Unified booking feed with monthKey so we can filter in JS.
  type Booking = ReservationLite & { monthKey: string | null };
  const allBookings: Booking[] = [
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
      monthKey: r.monthKey,
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
      monthKey: e.monthKey,
    })),
  ];

  // KPI items: filtered by selectedMonth (or all when empty).
  const kpiItems: ReservationLite[] = selectedMonth
    ? allBookings.filter((b) => b.monthKey === selectedMonth)
    : allBookings;

  // Period: derive from selectedMonth for KPI math; for All, span the
  // booked range (or fall back to current month when there's no data).
  const now = new Date();
  let period: { from: Date; to: Date };
  if (selectedMonth) {
    const [yy, mm] = selectedMonth.split("-").map(Number);
    period = {
      from: new Date(Date.UTC(yy, mm - 1, 1)),
      to: new Date(Date.UTC(yy, mm, 1)),
    };
  } else if (allBookings.length > 0) {
    const fromMs = Math.min(
      ...allBookings.map((b) => b.checkIn.getTime()),
    );
    const toMs = Math.max(
      ...allBookings.map((b) => b.checkOut.getTime()),
    );
    period = { from: new Date(fromMs), to: new Date(toMs) };
  } else {
    period = {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    };
  }

  const kpis = computeKpis(kpiItems, propertyCount, period);
  // Monthly chart shows full 12-month context regardless of the filter
  // so trend remains readable when a single month is picked.
  const monthly = buildMonthlySeries(allBookings, propertyCount, 12);

  const t = await getTranslations({ locale, namespace: "owner" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const easyMode = session.role === "OWNER" ? await readMyEasyMode() : false;

  return (
    <OwnerDashboardView
      locale={loc}
      monthOptions={monthOpts}
      selectedMonth={selectedMonth}
      basePath={`/${locale}/owner`}
      periodLabel={selectedMonth ? monthLabel(selectedMonth, locale) : "All months"}
      easyMode={easyMode}
      userName={session.name ?? session.email ?? null}
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
        monthlyRevenue: t("monthlyRevenueAll"),
        noData: tCommon("noData"),
      }}
    />
  );
}
