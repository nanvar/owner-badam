// Unified notification dispatcher. Fans a single semantic event out
// to every channel the recipient has wired up: Expo push (RN owner
// app), Web Push (PWA on phone/desktop). Activity-feed writes are
// also funnelled through here so every owner-visible event lands in
// one place.
//
// Future: layer in UserPreference.notificationPrefs to honour per-
// category opt-outs without changing call sites.

import { prisma } from "./prisma";
import { sendWebPushToUser } from "./webpush";
import { pushToOwner } from "./push";

// Stable category tags — the activity feed + notification settings
// share this enum so toggles map 1:1 to events.
export const NotificationType = {
  NEW_RESERVATION: "NEW_RESERVATION",
  RESERVATION_PAID: "RESERVATION_PAID",
  CHECK_IN_TODAY: "CHECK_IN_TODAY",
  CHECK_OUT_TODAY: "CHECK_OUT_TODAY",
  NEW_EXPENSE: "NEW_EXPENSE",
  PROPERTY_EVENT: "PROPERTY_EVENT",
  PROPERTY_DOCUMENT_UPLOADED: "PROPERTY_DOCUMENT_UPLOADED",
  NEW_REPORT: "NEW_REPORT",
  OWNER_PAYMENT_RECORDED: "OWNER_PAYMENT_RECORDED",
  SERVICE_CHARGE_DUE: "SERVICE_CHARGE_DUE",
  SERVICE_CHARGE_PAID: "SERVICE_CHARGE_PAID",
  OWNER_DEBT_CREATED: "OWNER_DEBT_CREATED",
  OWNER_DEBT_SETTLED: "OWNER_DEBT_SETTLED",
  STAY_REQUEST_APPROVED: "STAY_REQUEST_APPROVED",
  STAY_REQUEST_REJECTED: "STAY_REQUEST_REJECTED",
} as const;

export type NotificationTypeKey =
  (typeof NotificationType)[keyof typeof NotificationType];

export type NotifyInput = {
  userId: string;
  type: NotificationTypeKey;
  title: string;
  body?: string;
  /** Deep link path in the owner app (e.g. /owner/reports/abc). */
  url?: string;
  /** Free-form payload. Lands in ActivityEvent.data + notification.data. */
  data?: Record<string, unknown>;
  /** Skip writing to ActivityEvent. Use for fire-and-forget pings. */
  skipFeed?: boolean;
  /** Skip push channels. Use for back-fills / silent feed writes. */
  skipPush?: boolean;
};

// Pull the user's pref object once and check whether they opted out.
async function isMuted(
  userId: string,
  type: NotificationTypeKey,
): Promise<boolean> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { notificationPrefs: true },
  });
  if (!pref?.notificationPrefs) return false;
  const map = pref.notificationPrefs as Record<string, boolean>;
  // Explicit false = muted. Missing key = default to enabled.
  return map[type] === false;
}

/**
 * Best-effort notification dispatch. Never throws — failures are
 * logged so the originating mutation keeps going.
 *
 * - Writes ActivityEvent (unless skipFeed)
 * - Sends Web Push to every browser subscription (unless skipPush or muted)
 * - Sends Expo push to RN devices (unless skipPush or muted)
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const muted = input.skipPush ? true : await isMuted(input.userId, input.type);

    if (!input.skipFeed) {
      await prisma.activityEvent.create({
        data: {
          ownerId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body ?? null,
          data: input.data
            ? (input.data as Parameters<
                typeof prisma.activityEvent.create
              >[0]["data"]["data"])
            : undefined,
        },
      });
    }

    if (!muted) {
      // Fan out — both channels in parallel, don't let one failure
      // block the other.
      const tasks: Array<Promise<unknown>> = [];
      tasks.push(
        sendWebPushToUser(input.userId, {
          title: input.title,
          body: input.body,
          url: input.url,
          data: { type: input.type, ...(input.data ?? {}) },
          tag: input.type,
        }),
      );
      tasks.push(
        pushToOwner(input.userId, {
          title: input.title,
          body: input.body,
          data: { type: input.type, url: input.url, ...(input.data ?? {}) },
        }),
      );
      await Promise.allSettled(tasks);
    }
  } catch (err) {
    console.error("[notify]", err);
  }
}
