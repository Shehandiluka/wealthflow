import { motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { useMemo } from "react";
import { formatCurrency, Currency } from "@/lib/data";

export function SmartInsights() {
  const { data: transactions = [] } = useTransactions();

  const insights = useMemo(() => {
    const results: string[] = [];
    const expenses = transactions.filter(t => t.type === "expense");
    const income = transactions.filter(t => t.type === "income");

    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
    const totalIncome = income.reduce((s, t) => s + t.amount, 0);

    if (totalIncome > 0 && totalExpense > 0) {
      const savingsRate = ((totalIncome - totalExpense) / totalIncome * 100).toFixed(0);
      results.push(`💡 Your savings rate is ${savingsRate}% — ${Number(savingsRate) > 20 ? "great job!" : "try to save more!"}`);
    }

    // Top spending category
    const catMap = new Map<string, number>();
    expenses.forEach(t => catMap.set(t.category, (catMap.get(t.category) || 0) + t.amount));
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const pct = totalExpense > 0 ? Math.round((sorted[0][1] / totalExpense) * 100) : 0;
      results.push(`📊 ${sorted[0][0]} is your top expense (${pct}% of total spending)`);
    }

    if (transactions.length === 0) {
      results.push("📝 Add your accounts and transactions to see smart insights here!");
    }

    if (totalExpense > totalIncome && totalIncome > 0) {
      results.push("⚠️ You're spending more than you earn this period");
    }

    return results.slice(0, 3);
  }, [transactions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-4 w-4 text-warning" />
        <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">
          Smart Insights
        </h3>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="text-sm py-2 px-3 rounded-lg bg-secondary/50 text-secondary-foreground"
          >
            {insight}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
