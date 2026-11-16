import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { PiggyBank, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar } from "lucide-react";
import { formatCurrency, Currency } from "@/lib/data";
import { Progress } from "@/components/ui/progress";
import { useSavingsGoals, computeGoalPace } from "@/hooks/useSavingsGoals";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { label: string; className: string; icon: typeof TrendingUp }> = {
  complete: { label: "Complete", className: "text-success", icon: CheckCircle2 },
  overdue: { label: "Overdue", className: "text-destructive", icon: AlertTriangle },
  behind: { label: "Behind schedule", className: "text-warning", icon: TrendingDown },
  "on-track": { label: "On track", className: "text-primary", icon: TrendingUp },
  ahead: { label: "Ahead of schedule", className: "text-success", icon: TrendingUp },
  "open-ended": { label: "No deadline", className: "text-muted-foreground", icon: Calendar },
};

export function SavingsGoalsWidget() {
  const { data: goals = [], isLoading } = useSavingsGoals();

  if (isLoading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[100px]">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (goals.length === 0) return null;

  // Pinned goals first, then whichever is closest to its deadline (most urgent)
  const featured = [...goals]
    .sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      if (a.target_date && b.target_date) return new Date(a.target_date).getTime() - new Date(b.target_date).getTime();
      return 0;
    })
    .slice(0, 2);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }} className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground font-medium">Savings Goals</span>
        </div>
        <Link to="/savings-goals" className="text-xs text-primary hover:underline">View all</Link>
      </div>

      <div className="space-y-4">
        {featured.map((goal) => {
          const pace = computeGoalPace(goal);
          const status = STATUS_STYLES[pace.status];
          const StatusIcon = status.icon;
          return (
            <Link to="/savings-goals" key={goal.id} className="block group">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{goal.name}</p>
                <div className={cn("flex items-center gap-1 text-[11px] font-medium shrink-0 ml-2", status.className)}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </div>
              </div>
              <Progress value={pace.percentComplete} className="h-1.5 mb-1.5" />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {formatCurrency(goal.current_amount, goal.currency as Currency)} / {formatCurrency(goal.target_amount, goal.currency as Currency)}
                </span>
                {!pace.isComplete && pace.monthlyRequired !== null && (
                  <span className="font-mono text-foreground">{formatCurrency(pace.monthlyRequired, goal.currency as Currency)}/mo needed</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
