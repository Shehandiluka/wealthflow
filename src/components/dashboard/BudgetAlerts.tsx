import { motion } from "framer-motion";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { formatCurrency, Currency } from "@/lib/data";
import { useBudgets, useCategorySpending, useCategorySpendingHistory } from "@/hooks/useBudgets";
import { toLocalISODate } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function lastMonthKey(): string {
  const now = new Date();
  return toLocalISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
}

export function BudgetAlerts() {
  const { data: budgets = [] } = useBudgets();
  const { data: spending = {} } = useCategorySpending();
  const { data: history = {} } = useCategorySpendingHistory(1);
  const navigate = useNavigate();

  const alerts = budgets
    .map((b) => {
      const spent = spending[`${b.category}::${b.currency}`] || 0;
      let limit = Number(b.monthly_limit);
      if (b.rollover) {
        const lastSpent = history[`${lastMonthKey()}::${b.category}::${b.currency}`] || 0;
        limit += Math.max(0, Number(b.monthly_limit) - lastSpent);
      }
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      return { ...b, spent, limit, percent };
    })
    .filter((b) => b.percent >= 80)
    .sort((a, b) => b.percent - a.percent);

  if (alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="glass-card p-5 cursor-pointer"
      onClick={() => navigate("/budgets")}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">
          Budget Alerts
        </h3>
      </div>

      <div className="space-y-2.5">
        {alerts.map((alert) => {
          const isOver = alert.percent >= 100;
          return (
            <div
              key={alert.id}
              className={`text-sm py-2 px-3 rounded-lg ${
                isOver ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {isOver ? "🚨" : "⚠️"} {alert.category}
                </span>
                <span className="font-mono text-xs">
                  {Math.round(alert.percent)}%
                </span>
              </div>
              <p className="text-xs mt-0.5 opacity-80">
                {isOver
                  ? `Over by ${formatCurrency(alert.spent - alert.limit, alert.currency as Currency)}`
                  : `${formatCurrency(alert.limit - alert.spent, alert.currency as Currency)} remaining`}
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
