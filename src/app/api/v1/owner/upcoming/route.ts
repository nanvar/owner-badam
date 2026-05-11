import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";

// GET /api/v1/owner/upcoming
// "Upcoming" = bookings the owner is still expecting (check-in is in
// the future). Reservations and extensions are both surfaced as
// separate items since each carries its own window + payout under the
// new model where iCal extensions don't move the parent reservation.
export async function GET(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const today = new Date();
  const [reservations, extensions] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        property: { ownerId: auth.session.userId },
        checkIn: { gt: today },
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        nights: true,
        guestName: true,
        numGuests: true,
        totalPrice: true,
        payout: true,
        currency: true,
        property: { select: { id: true, name: true, color: true } },
      },
      orderBy: { checkIn: "asc" },
    }),
    prisma.reservationExtension.findMany({
      where: {
        reservation: { property: { ownerId: auth.session.userId } },
        checkIn: { gt: today },
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        nights: true,
        totalPrice: true,
        payout: true,
        currency: true,
        reservation: {
          select: {
            guestName: true,
            numGuests: true,
            property: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { checkIn: "asc" },
    }),
  ]);
  const reservationItems = reservations.map((r) => ({
    id: r.id,
    kind: "reservation" as const,
    checkIn: r.checkIn.toISOString(),
    checkOut: r.checkOut.toISOString(),
    nights: r.nights,
    guestName: r.guestName,
    numGuests: r.numGuests,
    totalPrice: r.totalPrice,
    payout: r.payout,
    currency: r.currency,
    property: r.property,
  }));
  const extensionItems = extensions.map((e) => ({
    id: e.id,
    kind: "extension" as const,
    checkIn: e.checkIn.toISOString(),
    checkOut: e.checkOut.toISOString(),
    nights: e.nights,
    guestName: e.reservation.guestName,
    numGuests: e.reservation.numGuests,
    totalPrice: e.totalPrice,
    payout: e.payout,
    currency: e.currency,
    property: e.reservation.property,
  }));
  const items = [...reservationItems, ...extensionItems].sort((a, b) =>
    a.checkIn.localeCompare(b.checkIn),
  );
  const totalPayout = items.reduce((s, r) => s + r.payout, 0);
  return Response.json({
    count: items.length,
    totalPayout,
    items,
  });
}
