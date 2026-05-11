import { prisma } from "@/lib/prisma";
import { requireOwnerApi, jsonError } from "@/lib/api-auth";
import { extractBookingRef } from "@/lib/utils";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const report = await prisma.ownerReport.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true, color: true } },
      reservations: { orderBy: { checkIn: "asc" } },
      extensions: {
        include: {
          reservation: {
            select: {
              externalId: true,
              guestName: true,
              rawDescription: true,
            },
          },
        },
        orderBy: { checkIn: "asc" },
      },
      expenses: { orderBy: { date: "asc" } },
    },
  });
  if (!report || report.ownerId !== auth.session.userId) {
    return jsonError("not found", 404);
  }
  // Reservations + extensions are returned as a single chronological
  // "bookings" feed — extension rows wear kind="extension" so the
  // client can tell them apart. Booking ref is parsed from Airbnb's
  // reservation URL embedded in rawDescription.
  const bookings = [
    ...report.reservations.map((r) => ({
      id: r.id,
      kind: "reservation" as const,
      bookingRef: extractBookingRef(r.rawDescription),
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      guestName: r.guestName,
      totalPrice: r.totalPrice,
      agencyCommission: r.agencyCommission,
      portalCommission: r.portalCommission,
      payout: r.payout,
      currency: r.currency,
    })),
    ...report.extensions.map((e) => ({
      id: e.id,
      kind: "extension" as const,
      bookingRef: extractBookingRef(e.reservation.rawDescription),
      checkIn: e.checkIn.toISOString(),
      checkOut: e.checkOut.toISOString(),
      nights: e.nights,
      guestName: e.reservation.guestName,
      totalPrice: e.totalPrice,
      agencyCommission: e.agencyCommission,
      portalCommission: e.portalCommission,
      payout: e.payout,
      currency: e.currency,
    })),
  ].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return Response.json({
    id: report.id,
    name: report.name,
    notes: report.notes,
    property: report.property,
    totals: {
      income: report.totalIncome,
      expenses: report.totalExpenses,
      net: report.netPayout,
    },
    bookings,
    // Legacy alias — older mobile builds still read `reservations`.
    // Kept as the same merged list so the totals line up.
    reservations: bookings,
    expenses: report.expenses.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      type: e.type,
      description: e.description,
      amount: e.amount,
    })),
    createdAt: report.createdAt.toISOString(),
  });
}
