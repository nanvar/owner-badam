import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const reservations = await prisma.reservation.findMany({
    where: {
      property: { ownerId: auth.session.userId },
      upcoming: true,
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
  });
  const totalPayout = reservations.reduce((s, r) => s + r.payout, 0);
  return Response.json({
    count: reservations.length,
    totalPayout,
    items: reservations.map((r) => ({
      id: r.id,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      guestName: r.guestName,
      numGuests: r.numGuests,
      totalPrice: r.totalPrice,
      payout: r.payout,
      currency: r.currency,
      property: r.property,
    })),
  });
}
