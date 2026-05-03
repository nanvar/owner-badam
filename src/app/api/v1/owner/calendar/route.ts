import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";

// GET /api/v1/owner/calendar
// Returns the owner's properties each with their reservations flattened
// into event-shaped objects, mirroring what the web calendar consumes.
export async function GET(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const properties = await prisma.property.findMany({
    where: { ownerId: auth.session.userId },
    include: {
      reservations: {
        select: {
          id: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          nights: true,
          pricePerNight: true,
          totalPrice: true,
          currency: true,
          upcoming: true,
        },
        orderBy: { checkIn: "asc" },
      },
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  return Response.json({
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      color: p.color,
      reservationCount: p._count.reservations,
      upcomingCount: p.reservations.filter(
        (r) => r.checkOut.getTime() >= now,
      ).length,
      events: p.reservations.map((r) => ({
        id: r.id,
        guestName: r.guestName,
        start: r.checkIn.toISOString(),
        end: r.checkOut.toISOString(),
        nights: r.nights,
        pricePerNight: r.pricePerNight,
        totalPrice: r.totalPrice,
        currency: r.currency,
        upcoming: r.upcoming,
      })),
    })),
  });
}
