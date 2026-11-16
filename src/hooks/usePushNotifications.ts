import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) { setLoading(false); return; }
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setSubscribed(!!sub);
    } catch {
      setSubscribed(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!user || !isPushSupported()) return { ok: false, reason: "unsupported" as const };

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" as const };

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!) as BufferSource,
    });

    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions" as any).upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      } as any,
      { onConflict: "user_id,endpoint" }
    );
    if (error) return { ok: false, reason: "save_failed" as const, error };

    setSubscribed(true);
    return { ok: true as const };
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!isPushSupported()) return;
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions" as any).delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, []);

  return { subscribed, loading, subscribe, unsubscribe, supported: isPushSupported() };
}
