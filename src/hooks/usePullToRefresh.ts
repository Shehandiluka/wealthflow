import { useRef, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function usePullToRefresh() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const threshold = 80;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    // Small delay so spinner is visible
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  }, [queryClient]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0 && !refreshing) {
        startY.current = e.touches[0].clientY;
        setPulling(true);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pulling || refreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        setPullDistance(Math.min(dy * 0.5, threshold * 1.5));
      }
    };

    const onTouchEnd = () => {
      if (pullDistance >= threshold && !refreshing) {
        handleRefresh();
      }
      setPulling(false);
      setPullDistance(0);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pulling, pullDistance, refreshing, handleRefresh]);

  return { containerRef, pullDistance, refreshing, threshold };
}
