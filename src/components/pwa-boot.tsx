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
  // Centered SweetAlert-style modal. Dimmed backdrop captures focus
  // so the prompt feels intentional rather than a corner banner the
  // user can ignore.
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={() => setBannerOpen(false)}
      />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white text-center shadow-2xl"
        style={{
          animation: "swalPop 0.22s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
      >
        <button
          type="button"
          onClick={() => setBannerOpen(false)}
          aria-label="Dismiss"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-6 pt-8">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-700">
            <Bell className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[var(--color-foreground)]">
            Enable notifications
          </h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Get instant alerts for new bookings, reports and important
            updates — even when the app is closed.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={async () => {
                if (reg) await trySubscribe(reg);
                setBannerOpen(false);
              }}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => setBannerOpen(false)}
              className="w-full rounded-xl px-4 py-2 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes swalPop {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
