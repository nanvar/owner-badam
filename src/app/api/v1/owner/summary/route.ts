import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";
import {
  buildMonthlySeries,
  computeKpis,
  periodFromRange,
  type ReservationLite,
} from "@/lib/metrics";

// GET /api/v1/owner/summary?range=this-month
// Mirrors the web dashboard's KPI computation. Pulls reservations +
// extensions and treats each extension as its own booking so revenue,
// nights and bookings include them once iCal pushes a stay extension.
export async function GET(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "this-month";
  const period = periodFromRange(range);

  const [reservations, extensions, propertyCount] = await Promise.all([
    prisma.reservation.findMany({
      where: { property: { ownerId: auth.session.userId } },
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
      where: {
        reservation: { property: { ownerId: auth.session.userId } },
      },
      select: {
        nights: true,
        totalPrice: true,
        payout: true,
        checkIn: true,
        checkOut: true,
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.property.count({ where: { ownerId: auth.session.userId } }),
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

  return Response.json({
    range,
    period: {
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    propertyCount,
    kpis: {
      // Mobile owner KPI "revenue" = net owner payout, matching the
      // admin "Owner payout" definition (totalPrice minus portal +
      // company commissions).
      revenue: kpis.payout,
      bookings: kpis.bookings,
      nights: kpis.nights,
      availableNights: kpis.availableNights,
      occupancy: kpis.occupancy,
      adr: kpis.adr,
      revpar: kpis.revpar,
    },
    monthly,
  });
}
