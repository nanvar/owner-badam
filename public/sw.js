// Badam service worker — push notifications + minimal shell cache.
// Keep this file tiny and dependency-free; it's served as-is from
// the origin and parsed by the browser as soon as the page loads.

const SW_VERSION = "v1";

self.addEventListener("install", () => {
  // Take over as soon as installed; no aggressive precaching yet.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ---------- Push ----------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) payload = event.data.json();
  } catch (_) {
    // Plain text fallback so we still show something useful.
    payload = { title: "Badam", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Badam";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || undefined,
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------- Click ----------
// When the user taps the notification: focus an existing client at
// the same path, or open a new one if none match.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          // If a tab is already open in this origin, focus + navigate it.
          if ("focus" in client) {
            const url = new URL(client.url);
            if (url.origin === self.location.origin) {
              client.focus();
              if (
                client.url !== self.location.origin + targetUrl &&
                "navigate" in client
              ) {
                client.navigate(targetUrl);
              }
              return;
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
