// GET  /api/v1/owner/stay-requests  — list the owner's requests
// POST /api/v1/owner/stay-requests  — file a new request
//   Body: { propertyId, checkIn, checkOut, notes? }

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBearerSession } from "@/lib/api-auth";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOwnerReservationRequestAction } from "@/app/actions/owner-stay";

const CreateSchema = z.object({
  propertyId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

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

  const rows = await prisma.ownerReservationRequest.findMany({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      property: { select: { id: true, name: true, color: true } },
    },
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      status: r.status,
      checkIn: r.checkIn.toISOString(),
      checkOut: r.checkOut.toISOString(),
      nights: r.nights,
      notes: r.notes,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      decisionNote: r.decisionNote,
      property: r.property,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const cookieSession = await readSession();
  const bearerSession = cookieSession ? null : await readBearerSession(req);
  const session = cookieSession ?? bearerSession;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.role !== "OWNER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "bad request" },
      { status: 400 },
    );
  }
  try {
    const r = await createOwnerReservationRequestAction({
      propertyId: parsed.data.propertyId,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ status: "ok", id: r.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 400 },
    );
  }
}
