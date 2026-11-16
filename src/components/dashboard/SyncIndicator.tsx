import { RefreshCw } from "lucide-react";
import { useIsFetching } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { format } from "date-fns";

export function SyncIndicator() {
  const isFetching = useIsFetching();
  const [lastSync, setLastSync] = useState<Date>(new Date());

  useEffect(() => {
    if (isFetching === 0) {
      setLastSync(new Date());
    }
  }, [isFetching]);

  const syncing = isFetching > 0;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin text-primary" : ""}`} />
      {syncing ? (
        <span>Syncing…</span>
      ) : (
        <span>Synced {format(lastSync, "h:mm a")}</span>
      )}
    </div>
  );
}
