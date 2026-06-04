"use client";

// Registers the service worker on mount, then handles Web Push
// subscription. Renders a small "Enable notifications" banner when
// permission is "default" so iOS standalone PWAs still get a chance
// (iOS only shows the prompt in response to a user gesture).
//
// Mount once per authenticated layout (admin + owner). Safe to mount
// multiple times — checks are idempotent.

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  await fetch("/api/v1/webpush/register", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
}

async function trySubscribe(reg: ServiceWorkerRegistration): Promise<boolean> {
  if (!("PushManager" in window) || !("Notification" in window)) return false;
  if (Notification.permission === "denied") return false;
  if (Notification.permission === "default") {
    const perm = await Notification.requestPermission().catch(() => "denied");
    if (perm !== "granted") return false;
  }

  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await postSubscription(existing);
    return true;
  }

  // Fetch the VAPID public key.
  let publicKey: string | undefined;
  try {
    const r = await fetch("/api/v1/webpush/key", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const j = (await r.json()) as { publicKey?: string };
    publicKey = j.publicKey;
  } catch {
    return false;
  }
  if (!publicKey) return false;

  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Pin to a plain Uint8Array — older lib.dom typings here use a
      // tighter BufferSource union that doesn't see Uint8Array as
      // assignable on its own.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
    });
    await postSubscription(sub);
    return true;
  } catch (err) {
    console.warn("[pwa-boot] subscribe failed", err);
    return false;
  }
}

export function PwaBoot() {
  const [bannerOpen, setBannerOpen] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    const run = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        if (cancelled) return;
        setReg(registration);

        // iOS: push only works in installed PWAs (standalone).
        const isStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as Navigator & { standalone?: boolean })
            .standalone === true;
        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIos && !isStandalone) return;

        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await postSubscription(existing);
          return;
        }

        if (Notification.permission === "granted") {
          await trySubscribe(registration);
        } else if (Notification.permission === "default") {
          setBannerOpen(true);
        }
      } catch (err) {
        console.warn("[pwa-boot] SW register failed", err);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bannerOpen) return null;
  return (
    <div className="fixed left-2 right-2 top-2 z-[9999] flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-white px-3 py-2.5 shadow-lg">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-700">
        <Bell className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        Turn on notifications to get instant alerts for new bookings, reports
        and updates.
      </div>
      <button
        type="button"
        onClick={async () => {
          if (reg) await trySubscribe(reg);
          setBannerOpen(false);
        }}
        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        Enable
      </button>
      <button
        type="button"
        onClick={() => setBannerOpen(false)}
        aria-label="Dismiss"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
