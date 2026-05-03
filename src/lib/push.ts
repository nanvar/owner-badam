// Owner-app push notifications via Expo's Push API. Free, no auth required
// for the sender — just POST a list of messages and Expo's infra fans them
// out to APNs/FCM. Tokens are sourced from `OwnerDevice` rows.
//
// Docs: https://docs.expo.dev/push-notifications/sending-notifications/

import { prisma } from "./prisma";

type ExpoMessage = {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
};

// Best-effort dispatch — we never want a notification failure to break the
// admin action that triggered it. All errors are swallowed and logged.
export async function pushToOwner(
  ownerId: string,
  message: Omit<ExpoMessage, "to">,
) {
  try {
    const devices = await prisma.ownerDevice.findMany({
      where: { userId: ownerId },
      select: { token: true },
    });
    if (devices.length === 0) return;
    const messages: ExpoMessage[] = devices.map((d) => ({
      to: d.token,
      sound: "default",
      priority: "high",
      ...message,
    }));
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "accept-encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      console.error("[push] Expo HTTP %d", res.status);
      return;
    }
    // Expo returns per-message tickets. `DeviceNotRegistered` means the
    // user uninstalled or revoked the token — purge those so we stop
    // sending to dead endpoints.
    const json = (await res.json()) as {
      data?: Array<{
        status: "ok" | "error";
        message?: string;
        details?: { error?: string };
      }>;
    };
    const dead: string[] = [];
    json.data?.forEach((ticket, i) => {
      if (
        ticket.status === "error" &&
        ticket.details?.error === "DeviceNotRegistered"
      ) {
        const token = messages[i]?.to;
        if (token) dead.push(token);
      }
    });
    if (dead.length > 0) {
      await prisma.ownerDevice.deleteMany({
        where: { token: { in: dead } },
      });
    }
  } catch (err) {
    console.error("[push] failed:", err);
  }
}
