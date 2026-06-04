// GET /api/v1/owner/properties
// Lists the authenticated owner's properties along with their stay-
// quota status (used / pending / remaining) so the owner UI can
// surface remaining nights without doing the math client-side.

import { NextRequest, NextResponse } from "next/server";
import { readBearerSession } from "@/lib/api-auth";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeQuotaStatus } from "@/lib/stay-quota";

export async function GET(req: NextRequest) {
  const cookieSession = await readSession();
  const bearerSession = cookieSession ? null : await readBearerSession(req);
  const session = cookieSession ?? bearerSession;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const properties = await prisma.property.findMany({
    where: { ownerId: session.userId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      color: true,
      managementOnly: true,
      coverPhotoUrl: true,
      photos: true,
      bedrooms: true,
      bathrooms: true,
      beds: true,
      maxGuests: true,
    },
  });

  const withQuota = await Promise.all(
    properties.map(async (p) => {
      const status = await computeQuotaStatus(p.id);
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        color: p.color,
        managementOnly: p.managementOnly,
        coverPhotoUrl: p.coverPhotoUrl,
        airbnbPhotoCount:
          Array.isArray(p.photos) ? (p.photos as unknown[]).length : 0,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        beds: p.beds,
        maxGuests: p.maxGuests,
        stayQuota: status
          ? {
              daysPerYear: status.daysPerYear,
              cycleStart: status.cycleStart.toISOString(),
              cycleEnd: status.cycleEnd.toISOString(),
              usedNights: status.usedNights,
              pendingNights: status.pendingNights,
              remainingNights: status.remainingNights,
            }
          : null,
      };
    }),
  );

  return NextResponse.json({ items: withQuota });
}
