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
          checkIn: { gte: period.from, lte: period.to },
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
    agencyCommission: r.agencyCommission,
    portalCommission: r.portalCommission,
    cleaningFee: r.cleaningFee,
    serviceFee: r.serviceFee,
    taxes: r.taxes,
    payout: r.payout,
    currency: r.currency,
    detailsFilled: r.detailsFilled,
  }));

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
