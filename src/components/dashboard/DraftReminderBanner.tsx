import { BellRing, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { useSmsImports } from "@/hooks/useSmsImports";
import {
  DAY_NAMES,
  nextCutoff,
  useDraftReminderSettings,
} from "@/hooks/useDraftReminders";

export function DraftReminderBanner() {
  const { data: settings } = useDraftReminderSettings();
  const { data: drafts = [] } = useSmsImports();

  const pending = drafts.filter(d => !d.transaction_id);
  if (!settings?.enabled || pending.length === 0) return null;

  const cutoff = nextCutoff(settings);
  if (!cutoff) return null;

  const hoursLeft = (cutoff.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft > settings.reminder_lead_hours) return null;

  const autoCount = pending.filter((d: any) => d.auto_post).length;

  return (
    <Link
      to="/sms-imports"
      className="glass-card p-3 flex items-center gap-3 border border-primary/30 hover:border-primary/60 transition-colors"
    >
      <span className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
        <BellRing className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {pending.length} draft{pending.length > 1 ? "s" : ""} to review
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Cutoff {DAY_NAMES[settings.cutoff_dow]} {settings.cutoff_time.slice(0, 5)} · in{" "}
          {formatDistanceToNowStrict(cutoff)}
          {settings.auto_post && autoCount > 0 ? ` · ${autoCount} will auto-post` : ""}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
