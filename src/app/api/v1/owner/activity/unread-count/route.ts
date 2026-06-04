// GET /api/v1/owner/activity/unread-count
// Lightweight count for the bell badge — polled or fetched on every
// page load.

import { NextRequest, NextResponse } from "next/server";
import { readBearerSession } from "@/lib/api-auth";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const count = await prisma.activityEvent.count({
    where: { ownerId: session.userId, readAt: null },
  });
  return NextResponse.json({ count });
}
