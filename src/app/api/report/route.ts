import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import {
  buildPropertySeries,
  computeKpis,
  periodFromRange,
  type Period,
} from "@/lib/metrics";

export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "this-month";
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const propertyId = url.searchParams.get("propertyId");

  let period: Period;
  if (range === "custom" && fromParam && toParam) {
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

  const [properties, reservations] = await Promise.all([
    prisma.property.findMany({ where: propertyFilter, select: { id: true, name: true, color: true } }),
    prisma.reservation.findMany({
      where: {
        property: propertyFilter,
        OR: [
          { checkIn: { gte: period.from, lt: period.to } },
          { checkOut: { gt: period.from, lte: period.to } },
          { AND: [{ checkIn: { lt: period.from } }, { checkOut: { gt: period.to } }] },
        ],
      },
      include: { property: { select: { name: true, color: true } } },
      orderBy: { checkIn: "asc" },
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
    cleaningFee: r.cleaningFee,
    serviceFee: r.serviceFee,
    taxes: r.taxes,
    payout: r.payout,
    currency: r.currency,
    detailsFilled: r.detailsFilled,
  }));

  const kpis = computeKpis(items, properties.length, period);
  const byProperty = buildPropertySeries(items, period);

  return NextResponse.json({
    period: { from: period.from.toISOString(), to: period.to.toISOString() },
    kpis,
    byProperty,
    reservations: items.map((r) => ({
      ...r,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
    })),
    propertyCount: properties.length,
  });
}
