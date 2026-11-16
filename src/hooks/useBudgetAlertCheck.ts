import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, Currency } from "@/lib/data";
import { Budget } from "@/hooks/useBudgets";

/**
 * Returns a function that checks if the newly added expense
 * crosses 80% or 100% of any budget and shows a toast.
 */
export function useBudgetAlertCheck() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return (category: string, txType: string) => {
    if (txType !== "expense") return;

    // Read cached data (already invalidated by this point)
    setTimeout(() => {
      const budgets = qc.getQueryData<Budget[]>(
        qc.getQueryCache().findAll({ queryKey: ["budgets"] })[0]?.queryKey ?? ["budgets"]
      );
      const spendingKeys = qc.getQueryCache().findAll({ queryKey: ["category-spending"] });
      const spending = spendingKeys.length
        ? qc.getQueryData<Record<string, number>>(spendingKeys[0].queryKey) ?? {}
        : {};

      if (!budgets) return;

      const budget = budgets.find((b) => b.category === category);
      if (!budget) return;

      const spent = spending[category] || 0;
      const limit = Number(budget.monthly_limit);
      const percent = limit > 0 ? (spent / limit) * 100 : 0;

      if (percent >= 100) {
        toast({
          title: `🚨 ${category} budget exceeded!`,
          description: `You've spent ${formatCurrency(spent, budget.currency as Currency)} of your ${formatCurrency(limit, budget.currency as Currency)} limit.`,
          variant: "destructive",
        });
      } else if (percent >= 80) {
        toast({
          title: `⚠️ ${category} budget at ${Math.round(percent)}%`,
          description: `${formatCurrency(limit - spent, budget.currency as Currency)} remaining this month.`,
        });
      }
    }, 1500); // wait for query invalidation to refetch
  };
}
