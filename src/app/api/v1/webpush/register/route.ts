// POST /api/v1/webpush/register
//
// Body: { endpoint, keys: { p256dh, auth } }
// Resp: { status: "ok" }
//
// Stores a PushSubscription. Idempotent — re-registering the same
// endpoint updates the keys + user binding (e.g. handed-off device).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { readBearerSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  endpoint: z.string().url().max(500),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(120),
  }),
});

export async function POST(req: NextRequest) {
  // Either auth path works — admin from cookie, owner from bearer.
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
  const { endpoint, keys } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;

  await prisma.webPushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: session.userId,
      userAgent,
    },
    update: {
      p256dh: keys.p256dh,
      auth: keys.auth,
      userId: session.userId,
      userAgent,
    },
  });

  return NextResponse.json({ status: "ok" });
}
