import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
const THROTTLE_MS = 10_000; // don't write to sessionStorage on every single pixel of mouse movement
const CHECK_INTERVAL_MS = 30_000;

/**
 * Locks the app again after `timeoutMs` of no mouse/keyboard/touch activity —
 * a PIN that never re-locks on its own during a long-idle open tab (e.g. a
 * laptop left unattended for hours) is a real gap, not just theoretical.
 * Survives refreshes: the last-activity timestamp lives in sessionStorage,
 * the same place the unlock flag itself lives.
 */
export function useAutoLock(userId: string | undefined, timeoutMs: number, onLock: () => void) {
  const lastWriteRef = useRef(0);

  useEffect(() => {
    if (!userId) return;
    const key = `wealthflow_last_activity_${userId}`;

    const touch = () => {
      const now = Date.now();
      if (now - lastWriteRef.current < THROTTLE_MS) return;
      lastWriteRef.current = now;
      sessionStorage.setItem(key, String(now));
    };

    // Count mount itself as activity (covers the "just unlocked" moment).
    touch();
    lastWriteRef.current = 0; // allow the next real event through immediately too

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, touch, { passive: true }));

    const interval = setInterval(() => {
      const last = Number(sessionStorage.getItem(key) || Date.now());
      if (Date.now() - last >= timeoutMs) {
        onLock();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, touch));
      clearInterval(interval);
    };
  }, [userId, timeoutMs, onLock]);
}
