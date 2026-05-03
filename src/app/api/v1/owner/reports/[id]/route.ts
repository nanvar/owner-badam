import { prisma } from "@/lib/prisma";
import { requireOwnerApi, jsonError } from "@/lib/api-auth";

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
      expenses: { orderBy: { date: "asc" } },
    },
  });
  if (!report || report.ownerId !== auth.session.userId) {
    return jsonError("not found", 404);
  }
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
    reservations: report.reservations.map((r) => ({
      id: r.id,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      guestName: r.guestName,
      totalPrice: r.totalPrice,
      payout: r.payout,
      currency: r.currency,
    })),
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
