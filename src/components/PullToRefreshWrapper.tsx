import { ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface Props {
  children: ReactNode;
  className?: string;
}

export function PullToRefreshWrapper({ children, className = "" }: Props) {
  const { containerRef, pullDistance, refreshing, threshold } = usePullToRefresh();
  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div ref={containerRef} className={`relative overflow-y-auto ${className}`}>
      {showIndicator && (
        <div
          className="flex items-center justify-center transition-all duration-200 pointer-events-none"
          style={{ height: refreshing ? 48 : pullDistance }}
        >
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <ArrowDown
              className="h-5 w-5 text-muted-foreground transition-transform duration-200"
              style={{
                opacity: progress,
                transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
              }}
            />
          )}
        </div>
      )}
      {children}
    </div>
  );
}
