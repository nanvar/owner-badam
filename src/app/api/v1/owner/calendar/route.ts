import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";

// GET /api/v1/owner/calendar
// Returns the owner's properties each with their reservations + iCal
// extensions flattened into event-shaped objects. Extensions surface
// as separate events (with kind="extension") because the original
// reservation window no longer shifts when a stay is extended.
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
          extensions: {
            select: {
              id: true,
              checkIn: true,
              checkOut: true,
              nights: true,
              totalPrice: true,
              currency: true,
            },
            orderBy: { checkIn: "asc" },
          },
        },
        orderBy: { checkIn: "asc" },
      },
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const now = Date.now();
  return Response.json({
    properties: properties.map((p) => {
      const reservationEvents = p.reservations.map((r) => ({
        id: r.id,
        kind: "reservation" as const,
        guestName: r.guestName,
        start: r.checkIn.toISOString(),
        end: r.checkOut.toISOString(),
        nights: r.nights,
        pricePerNight: r.pricePerNight,
        totalPrice: r.totalPrice,
        currency: r.currency,
      }));
      const extensionEvents = p.reservations.flatMap((r) =>
        r.extensions.map((e) => ({
          id: e.id,
          kind: "extension" as const,
          guestName: r.guestName,
          start: e.checkIn.toISOString(),
          end: e.checkOut.toISOString(),
          nights: e.nights,
          pricePerNight: e.nights > 0 ? e.totalPrice / e.nights : 0,
          totalPrice: e.totalPrice,
          currency: e.currency,
        })),
      );
      const events = [...reservationEvents, ...extensionEvents];
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        color: p.color,
        reservationCount: p._count.reservations,
        upcomingCount: events.filter(
          (ev) => new Date(ev.start).getTime() > now,
        ).length,
        events,
      };
    }),
  });
}
