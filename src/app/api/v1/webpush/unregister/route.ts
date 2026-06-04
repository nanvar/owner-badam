// POST /api/v1/webpush/unregister
//
// Body: { endpoint }
// Resp: { status: "ok" }
//
// Called when the user toggles notifications off or when the browser
// reports the subscription was revoked. We only allow deleting the
// caller's own row.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { readBearerSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ endpoint: z.string().url().max(500) });

export async function POST(req: NextRequest) {
  const cookieSession = await readSession();
  const bearerSession = cookieSession ? null : await readBearerSession(req);
  const session = cookieSession ?? bearerSession;
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "bad request" },
      { status: 400 },
    );
  }

  await prisma.webPushSubscription.deleteMany({
    where: { endpoint: parsed.data.endpoint, userId: session.userId },
  });

  return NextResponse.json({ status: "ok" });
}
