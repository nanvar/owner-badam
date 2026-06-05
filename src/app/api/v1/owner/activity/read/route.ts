// POST /api/v1/owner/activity/read
// Body: { ids?: string[] } — when omitted, marks ALL unread events read.
//
// Returns { updated: number }.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBearerSession } from "@/lib/api-auth";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  ids: z.array(z.string().min(1)).optional(),
});

export async function POST(req: NextRequest) {
  const cookieSession = await readSession();
  const bearerSession = cookieSession ? null : await readBearerSession(req);
  const session = cookieSession ?? bearerSession;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // OWNER + ADMIN/SUPERADMIN all read their own feed.

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body = mark-all
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "bad request" },
      { status: 400 },
    );
  }

  const now = new Date();
  const result = await prisma.activityEvent.updateMany({
    where: {
      ownerId: session.userId,
      readAt: null,
      ...(parsed.data.ids?.length ? { id: { in: parsed.data.ids } } : {}),
    },
    data: { readAt: now },
  });

  return NextResponse.json({ updated: result.count });
}
