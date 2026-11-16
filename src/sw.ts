/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// --- Standard PWA precaching (this replaces what `workbox.generateSW` used to do) ---
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    // Don't hijack Supabase's OAuth redirect callback with the SPA shell.
    denylist: [/^\/~oauth/],
  })
);

self.skipWaiting();
self.addEventListener("activate", () => self.clients.claim());

// --- Web Push: due-date reminders (see send-debt-reminders edge function) ---
interface ReminderPayload {
  title: string;
  body: string;
  url?: string;
}

self.addEventListener("push", (event: PushEvent) => {
  let payload: ReminderPayload = { title: "WealthFlow", body: "You have a new reminder." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => "focus" in c);
      if (existing) {
        await (existing as WindowClient).focus();
        if ("navigate" in existing) await (existing as WindowClient).navigate(targetUrl);
      } else {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
