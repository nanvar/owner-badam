// Web Push (VAPID) sender. Talks to the user's browser push service
// (FCM for Chrome/Android, Mozilla, Apple) using their subscription
// endpoint. Subscriptions live in the WebPushSubscription table —
// one row per browser per user.
//
// Best-effort: a failed send never aborts the action that triggered
// it; dead subscriptions are purged so we stop trying.

import webpush from "web-push";
import { prisma } from "./prisma";

const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@badam.ae";

let _initialised = false;
function ensureInit() {
  if (_initialised) return true;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  _initialised = true;
  return true;
}

export function webPushConfigured(): boolean {
  return Boolean(publicKey && privateKey);
}

export function vapidPublicKey(): string {
  return publicKey;
}

export type WebPushPayload = {
  title: string;
  body?: string;
  // Where to take the user when they tap the notification (the SW
  // reads this from notification.data.url on notificationclick).
  url?: string;
  // Free-form payload that lands in notification.data on the client.
  data?: Record<string, unknown>;
  // Optional icon override; defaults to /icons/icon-192.png.
  icon?: string;
  // Optional tag — re-using the same tag replaces an earlier
  // notification instead of stacking.
  tag?: string;
};

export async function sendWebPushToUser(
  userId: string,
  payload: WebPushPayload,
): Promise<void> {
  if (!ensureInit()) return;
  const subs = await prisma.webPushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url,
    data: payload.data ?? {},
    icon: payload.icon,
    tag: payload.tag,
  });

  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          body,
          { TTL: 60 * 60 * 24 }, // 1 day
        );
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        // 404/410 — subscription is gone. Anything else is logged
        // and the subscription is left alone (it may be a transient
        // network blip).
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("[webpush] send failed:", err);
      }
    }),
  );

  if (dead.length > 0) {
    await prisma.webPushSubscription.deleteMany({
      where: { id: { in: dead } },
    });
  }
}
