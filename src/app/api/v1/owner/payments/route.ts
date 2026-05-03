import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const payments = await prisma.ownerPayment.findMany({
    where: { ownerId: auth.session.userId },
    orderBy: { date: "desc" },
  });
  const total = payments.reduce((s, p) => s + p.amount, 0);
  return Response.json({
    total,
    count: payments.length,
    items: payments.map((p) => ({
      id: p.id,
      date: p.date.toISOString(),
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
