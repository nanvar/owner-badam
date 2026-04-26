import { prisma } from "./prisma";

export type ReservationLite = {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  guestName: string | null;
  numGuests: number | null;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  cleaningFee: number;
  payout: number;
  currency: string;
  detailsFilled: boolean;
};

export async function getOwnerReservations(ownerId: string): Promise<ReservationLite[]> {
  const rows = await prisma.reservation.findMany({
    where: { property: { ownerId } },
    include: { property: { select: { name: true, color: true } } },
    orderBy: { checkIn: "asc" },
  });
  return rows.map((r) => ({
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
}

export type Period = { from: Date; to: Date };

function overlapNights(r: { checkIn: Date; checkOut: Date }, p: Period): number {
  const start = r.checkIn > p.from ? r.checkIn : p.from;
  const end = r.checkOut < p.to ? r.checkOut : p.to;
  const diff = end.getTime() - start.getTime();
  if (diff <= 0) return 0;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export type Kpis = {
  revenue: number;
  payout: number;
  bookings: number;
  nights: number;
  availableNights: number;
  occupancy: number; // 0..1
  adr: number;
  revpar: number;
  avgStay: number;
  cleaningFees: number;
};

export function computeKpis(
  reservations: ReservationLite[],
  numProperties: number,
  period: Period,
): Kpis {
  let revenue = 0;
  let payout = 0;
  let nights = 0;
  let bookings = 0;
  let cleaningFees = 0;
  for (const r of reservations) {
    const overlap = overlapNights(r, period);
    if (overlap === 0) continue;
    bookings++;
    nights += overlap;
    const ratio = r.nights > 0 ? overlap / r.nights : 1;
    revenue += r.totalPrice * ratio;
    payout += (r.payout || r.totalPrice) * ratio;
    cleaningFees += r.cleaningFee * ratio;
  }
  const periodDays = Math.max(
    1,
    Math.round((period.to.getTime() - period.from.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const availableNights = periodDays * Math.max(1, numProperties);
  const occupancy = availableNights > 0 ? nights / availableNights : 0;
  const adr = nights > 0 ? revenue / nights : 0;
  const revpar = availableNights > 0 ? revenue / availableNights : 0;
  const avgStay = bookings > 0 ? nights / bookings : 0;
  return {
    revenue,
    payout,
    bookings,
    nights,
    availableNights,
    occupancy,
    adr,
    revpar,
    avgStay,
    cleaningFees,
  };
}

export type MonthlyBucket = {
  key: string;
  label: string;
  revenue: number;
  nights: number;
  bookings: number;
  occupancy: number;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildMonthlySeries(
  reservations: ReservationLite[],
  numProperties: number,
  months: number,
): MonthlyBucket[] {
  const today = new Date();
  const buckets: MonthlyBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    let revenue = 0;
    let nights = 0;
    let bookings = 0;
    for (const r of reservations) {
      const overlap = overlapNights(r, { from: start, to: end });
      if (overlap === 0) continue;
      bookings++;
      nights += overlap;
      const ratio = r.nights > 0 ? overlap / r.nights : 1;
      revenue += r.totalPrice * ratio;
    }
    const available = days * Math.max(1, numProperties);
    buckets.push({
      key: monthKey(d),
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      revenue,
      nights,
      bookings,
      occupancy: available > 0 ? nights / available : 0,
    });
  }
  return buckets;
}

export type PropertyBucket = {
  propertyId: string;
  propertyName: string;
  propertyColor: string;
  revenue: number;
  nights: number;
  bookings: number;
};

export function buildPropertySeries(
  reservations: ReservationLite[],
  period: Period,
): PropertyBucket[] {
  const map = new Map<string, PropertyBucket>();
  for (const r of reservations) {
    const overlap = overlapNights(r, period);
    if (overlap === 0) continue;
    const ratio = r.nights > 0 ? overlap / r.nights : 1;
    const existing = map.get(r.propertyId) ?? {
      propertyId: r.propertyId,
      propertyName: r.propertyName,
      propertyColor: r.propertyColor,
      revenue: 0,
      nights: 0,
      bookings: 0,
    };
    existing.revenue += r.totalPrice * ratio;
    existing.nights += overlap;
    existing.bookings += 1;
    map.set(r.propertyId, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function periodFromRange(range: string): Period {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
  switch (range) {
    case "this-month":
      return { from: startOfMonthDate, to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
    case "last-month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: start, to: end };
    }
    case "ytd":
      return { from: new Date(today.getFullYear(), 0, 1), to: new Date(today.getFullYear() + 1, 0, 1) };
    case "last-30":
      return { from: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    case "last-90":
      return { from: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000), to: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
    default:
      return { from: startOfMonthDate, to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  }
}
