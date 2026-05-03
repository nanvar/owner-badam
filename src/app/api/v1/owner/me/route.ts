import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireOwnerApi(req);
  if ("error" in auth) return auth.error;
  const user = await prisma.user.findUnique({
    where: { id: auth.session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      taxId: true,
      address: true,
      locale: true,
      _count: { select: { properties: true } },
    },
  });
  if (!user) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    taxId: user.taxId,
    address: user.address,
    locale: user.locale,
    propertyCount: user._count.properties,
  });
}
