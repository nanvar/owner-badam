// GET /api/v1/owner/activity?cursor=...&limit=20
// Returns the owner's activity feed in reverse-chronological order
// using opaque cursor pagination (cursor = the last row's id).
//
// Each row is a denormalised, presentation-ready event so the UI can
// render directly without secondary lookups.

import { NextRequest, NextResponse } from "next/server";
import { readBearerSession } from "@/lib/api-auth";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_LIMIT = 50;

export async function GET(req: NextRequest) {
  // Accept either bearer (RN app) or web cookie (PWA from /owner/*).
  const cookieSession = await readSession();
  const bearerSession = cookieSession ? null : await readBearerSession(req);
  const session = cookieSession ?? bearerSession;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") || null;
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20),
  );

  const rows = await prisma.activityEvent.findMany({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : {}),
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      data: r.data,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor,
  });
}
