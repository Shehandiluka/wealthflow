import { CalendarClock, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";
import { useRecurringTransactions } from "@/hooks/useRecurring";
import { CURRENCY_SYMBOLS, Currency } from "@/lib/data";
import { format, differenceInDays, parseISO } from "date-fns";

export function UpcomingRecurring() {
  const { data: recurring, isLoading } = useRecurringTransactions();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = (recurring || [])
    .filter((r) => {
      if (!r.is_active) return false;
      const due = parseISO(r.next_due);
      const diff = differenceInDays(due, today);
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => parseISO(a.next_due).getTime() - parseISO(b.next_due).getTime());

  if (isLoading) {
    return (
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
            Upcoming
          </h2>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-secondary/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const typeIcon = (type: string) => {
    if (type === "income") return <ArrowDownLeft className="h-3.5 w-3.5 text-success" />;
    if (type === "transfer") return <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />;
    return <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />;
  };

  const dueLabel = (dateStr: string) => {
    const diff = differenceInDays(parseISO(dateStr), today);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return format(parseISO(dateStr), "EEE, MMM d");
  };

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-muted-foreground tracking-normal">
          Upcoming (7 days)
        </h2>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No upcoming transactions this week 🎉
        </p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">{typeIcon(r.type)}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.description || r.category}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {dueLabel(r.next_due)}
                  </p>
                </div>
              </div>
              <p className={`text-sm font-semibold shrink-0 ${
                r.type === "income" ? "text-success" : "text-foreground"
              }`}>
                {r.type === "income" ? "+" : "-"}
                {CURRENCY_SYMBOLS[r.currency as Currency] || r.currency}{" "}
                {r.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
