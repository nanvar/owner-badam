"use server";

// User preference upserts. Currently exposes the notification opt-in
// map; future flags (easyMode, theme, locale override) layer on top
// of the same UserPreference row.
//
// Read helpers live in lib/notification-prefs-server.ts so client
// components that import this action don't transitively pull prisma
// into the client bundle.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";

const Schema = z.record(z.string(), z.boolean());

export async function updateNotificationPrefsAction(input: Record<string, boolean>) {
  const session = await readSession();
  if (!session) throw new Error("unauthorized");
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "invalid prefs");
  }
  // Whitelist the keys against the known categories so we never
  // persist garbage / typos.
  const allowed = new Set(NOTIFICATION_CATEGORIES.map((c) => c.type));
  const filtered: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (allowed.has(k as (typeof NOTIFICATION_CATEGORIES)[number]["type"])) {
      filtered[k] = !!v;
    }
  }
  // Merge with any existing prefs so we never drop unrelated keys
  // (future-proof against new categories landing while this user has
  // an old saved snapshot).
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
    create: {
      userId: session.userId,
      notificationPrefs: merged,
    },
    update: { notificationPrefs: merged },
  });
  return { status: "ok" as const };
}

// Easy mode — strips the owner dashboard down to a single hero card.
// Stored on UserPreference.easyMode so it persists across devices.
export async function setEasyModeAction(enabled: boolean) {
  const session = await readSession();
  if (!session) throw new Error("unauthorized");
  await prisma.userPreference.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, easyMode: enabled },
    update: { easyMode: enabled },
  });
  return { status: "ok" as const };
}
