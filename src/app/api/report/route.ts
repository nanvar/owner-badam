import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  buildPropertySeries,
  computeKpis,
  periodFromRange,
  type Period,
} from "@/lib/metrics";

async function fetchLogoAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  const range = url.searchParams.get("range") ?? "this-month";
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const propertyId = url.searchParams.get("propertyId");

  let period: Period;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const from = new Date(Date.UTC(y, m - 1, 1));
    const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    period = { from, to };
  } else if (range === "custom" && fromParam && toParam) {
    const from = new Date(fromParam);
    const to = new Date(toParam);
    to.setHours(23, 59, 59, 999);
    period = { from, to };
  } else {
    period = periodFromRange(range);
  }

  const propertyWhere =
    session.role === "OWNER" ? { ownerId: session.userId } : {};
  const propertyFilter = propertyId
    ? { ...propertyWhere, id: propertyId }
    : propertyWhere;

  const [owner, settings, properties, reservations, expenses, advances] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          name: true,
          email: true,
          phone: true,
          taxId: true,
          address: true,
        },
      }),
      getSettings(),
      prisma.property.findMany({
        where: propertyFilter,
        select: { id: true, name: true, color: true },
      }),
      prisma.reservation.findMany({
        where: {
          property: propertyFilter,
          // Any reservation that overlaps the period — its nights are then
          // pro-rated below so each month only sees the slice it owns.
          AND: [
            { checkIn: { lte: period.to } },
            { checkOut: { gt: period.from } },
          ],
        },
        include: { property: { select: { name: true, color: true } } },
        orderBy: { checkIn: "asc" },
      }),
      prisma.expense.findMany({
        where: {
          property: propertyFilter,
          date: { gte: period.from, lte: period.to },
        },
        include: { property: { select: { name: true, color: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.advance.findMany({
        where: {
          property: propertyFilter,
          date: { gte: period.from, lte: period.to },
        },
        include: { property: { select: { name: true, color: true } } },
        orderBy: { date: "asc" },
      }),
    ]);

  // Night-based proration. For each reservation that overlaps the period,
  // figure out which nights fall inside it and split totals accordingly.
  const ONE_DAY = 86_400_000;
  const periodStartMs = period.from.getTime();
  const periodEndExclusiveMs = period.to.getTime() + 1; // start of next month UTC
  const lastDayOfMonth = new Date(periodEndExclusiveMs - ONE_DAY); // UTC midnight of the last day
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const items = reservations
    .map((r) => {
      const checkInMs = r.checkIn.getTime();
      const checkOutMs = r.checkOut.getTime();
      const sliceStartMs = Math.max(checkInMs, periodStartMs);
      const sliceEndMs = Math.min(checkOutMs, periodEndExclusiveMs);
      const nightsInPeriod = Math.max(
        0,
        Math.round((sliceEndMs - sliceStartMs) / ONE_DAY),
      );
      const totalNights = r.nights || 1;
      const ratio = nightsInPeriod / totalNights;

      // Display dates: clamp into the month, so cross-month bookings
      // show "Feb 26 - Feb 28" in Feb and "Mar 1 - Mar 5" in Mar.
      const displayCheckIn =
        checkInMs < periodStartMs ? period.from : r.checkIn;
      const displayCheckOut =
        checkOutMs > periodEndExclusiveMs ? lastDayOfMonth : r.checkOut;

      return {
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.property.name,
        propertyColor: r.property.color,
        guestName: r.guestName,
        numGuests: r.numGuests,
        checkIn: displayCheckIn,
        checkOut: displayCheckOut,
        nights: nightsInPeriod,
        pricePerNight: r.pricePerNight,
        totalPrice: round2(r.totalPrice * ratio),
        agencyCommission: round2(r.agencyCommission * ratio),
        portalCommission: round2(r.portalCommission * ratio),
        cleaningFee: r.cleaningFee,
        serviceFee: r.serviceFee,
        taxes: r.taxes,
        payout: round2(r.payout * ratio),
        currency: r.currency,
        detailsFilled: r.detailsFilled,
      };
    })
    .filter((item) => item.nights > 0);

  const kpis = computeKpis(items, properties.length, period);
  const byProperty = buildPropertySeries(items, period);

  // Settlement totals (Vayk-style)
  const totalAmount = items.reduce((s, r) => s + r.totalPrice, 0);
  const totalAgency = items.reduce((s, r) => s + r.agencyCommission, 0);
  const totalPortal = items.reduce((s, r) => s + r.portalCommission, 0);
  const totalOwnerPayout = items.reduce((s, r) => s + r.payout, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalAdvances = advances.reduce((s, a) => s + a.amount, 0);
  const totalDeductions = totalExpenses + totalAdvances;
  const settlementTotal = totalOwnerPayout - totalDeductions;

  // Settlement number derived from period end (year * 1000 + day-of-year-ish)
  const periodEnd = new Date(period.to);
  const settlementNo =
    periodEnd.getFullYear() * 10000 +
    (periodEnd.getMonth() + 1) * 100 +
    periodEnd.getDate();

  return NextResponse.json({
    period: { from: period.from.toISOString(), to: period.to.toISOString() },
    settlementNo,
    settlementDate: new Date().toISOString(),
    issuingCompany: {
      brandName: settings.brandName,
      legalName: settings.legalName,
      logoUrl: settings.logoUrl,
      logoDataUrl: await fetchLogoAsDataUrl(settings.logoUrl),
      address: [settings.address, settings.city, settings.country]
        .filter(Boolean)
        .join(", "),
      email: settings.email,
      phone: settings.phone,
      website: settings.website,
    },
    recipient: owner
      ? {
          name: owner.name ?? owner.email,
          email: owner.email,
          phone: owner.phone,
          taxId: owner.taxId,
          address: owner.address,
        }
      : null,
    kpis,
    byProperty,
    reservations: items.map((r) => ({
      ...r,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      propertyId: e.propertyId,
      propertyName: e.property.name,
      date: e.date.toISOString(),
      type: e.type,
      description: e.description,
      amount: e.amount,
    })),
    advances: advances.map((a) => ({
      id: a.id,
      propertyId: a.propertyId,
      propertyName: a.property.name,
      date: a.date.toISOString(),
      concept: a.concept,
      amount: a.amount,
    })),
    settlement: {
      totalAmount,
      totalAgency,
      totalPortal,
      totalOwnerPayout,
      totalExpenses,
      totalAdvances,
      totalDeductions,
      settlementTotal,
    },
    propertyCount: properties.length,
    currency: settings.currency,
  });
}
