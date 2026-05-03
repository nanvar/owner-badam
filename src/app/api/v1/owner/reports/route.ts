import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const reports = await prisma.ownerReport.findMany({
    where: { ownerId: auth.session.userId },
    include: {
      property: { select: { id: true, name: true, color: true } },
      _count: { select: { reservations: true, expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({
    count: reports.length,
    items: reports.map((r) => ({
      id: r.id,
      name: r.name,
      property: r.property,
      totals: {
        income: r.totalIncome,
        expenses: r.totalExpenses,
        net: r.netPayout,
      },
      counts: {
        reservations: r._count.reservations,
        expenses: r._count.expenses,
      },
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
