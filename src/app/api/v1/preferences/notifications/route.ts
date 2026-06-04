// GET  /api/v1/preferences/notifications  — current resolved map
// PATCH /api/v1/preferences/notifications  — { type: bool } partial update
//
// Works for any authenticated user (owner via bearer, admin via cookie).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBearerSession } from "@/lib/api-auth";
import { readSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  NOTIFICATION_CATEGORIES,
  resolveNotificationPrefs,
} from "@/lib/notification-categories";

const PatchSchema = z.record(z.string(), z.boolean());

async function getSession(req: NextRequest) {
  const cookie = await readSession();
  if (cookie) return cookie;
  return readBearerSession(req);
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const row = await prisma.userPreference.findUnique({
    where: { userId: session.userId },
    select: { notificationPrefs: true },
  });
  return NextResponse.json({
    prefs: resolveNotificationPrefs(row?.notificationPrefs),
    categories: NOTIFICATION_CATEGORIES,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "bad request" },
      { status: 400 },
    );
  }
  // Whitelist + merge — same pattern as the server action.
  const allowed = new Set(NOTIFICATION_CATEGORIES.map((c) => c.type));
  const filtered: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (allowed.has(k as (typeof NOTIFICATION_CATEGORIES)[number]["type"])) {
      filtered[k] = !!v;
    }
  }
  const existing = await prisma.userPreference.findUnique({
    where: { userId: session.userId },
    select: { notificationPrefs: true },
  });
  const merged = {
    ...((existing?.notificationPrefs as Record<string, boolean> | null) ?? {}),
    ...filtered,
  };
  await prisma.userPreference.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, notificationPrefs: merged },
    update: { notificationPrefs: merged },
  });
  return NextResponse.json({
    status: "ok",
    prefs: resolveNotificationPrefs(merged),
  });
}
