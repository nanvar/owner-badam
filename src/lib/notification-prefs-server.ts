// Server-only read helper for the current user's resolved
// notification prefs. Kept out of any "use server" file so the
// Turbopack client bundler doesn't accidentally pick up its prisma
// transitive imports when the settings form (client component) just
// wants to call the action.

import { prisma } from "./prisma";
import { readSession } from "./auth";
import {
  resolveNotificationPrefs,
} from "./notification-categories";

export async function readMyNotificationPrefs() {
  const session = await readSession();
  // Resolve even when unauthenticated so callers can always render
  // the form (defaults). Page-level role guards block access first.
  const raw = session
    ? (await prisma.userPreference.findUnique({
        where: { userId: session.userId },
        select: { notificationPrefs: true },
      }))?.notificationPrefs
    : null;
  return resolveNotificationPrefs(raw);
}

// Easy-mode flag — drives the owner dashboard's single-card layout.
export async function readMyEasyMode(): Promise<boolean> {
  const session = await readSession();
  if (!session) return false;
  const row = await prisma.userPreference.findUnique({
    where: { userId: session.userId },
    select: { easyMode: true },
  });
  return row?.easyMode ?? false;
}
