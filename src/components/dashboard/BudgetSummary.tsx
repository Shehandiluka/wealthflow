import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, Currency } from "@/lib/data";
import { useBudgets, useCategorySpending, useCategorySpendingHistory } from "@/hooks/useBudgets";
import { toLocalISODate } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function lastMonthKey(): string {
  const now = new Date();
  return toLocalISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
}

export function BudgetSummary() {
  const { data: budgets = [] } = useBudgets();
  const { data: spending = {} } = useCategorySpending();
  const { data: history = {} } = useCategorySpendingHistory(1);
  const navigate = useNavigate();

  if (budgets.length === 0) return null;

  const items = budgets
    .map((b) => {
      const spent = spending[`${b.category}::${b.currency}`] || 0;
      let limit = Number(b.monthly_limit);
      if (b.rollover) {
        const lastSpent = history[`${lastMonthKey()}::${b.category}::${b.currency}`] || 0;
        limit += Math.max(0, Number(b.monthly_limit) - lastSpent);
      }
      const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
      return { ...b, spent, limit, percent };
    })
    .sort((a, b) => b.percent - a.percent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      className="glass-card p-5 cursor-pointer"
      onClick={() => navigate("/budgets")}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">
            Budget Summary
          </h3>
        </div>
        <span className="text-xs text-primary hover:underline">View All</span>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{item.category}</span>
              <span className="font-mono text-muted-foreground">
                {formatCurrency(item.spent, item.currency as Currency)}
                {" / "}
                {formatCurrency(item.limit, item.currency as Currency)}
              </span>
            </div>
            <Progress
              value={item.percent}
              className={`h-1.5 ${
                item.percent >= 100
                  ? "[&>div]:bg-destructive"
                  : item.percent >= 80
                    ? "[&>div]:bg-warning"
                    : "[&>div]:bg-success"
              }`}
            />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
