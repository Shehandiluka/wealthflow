import { motion } from "framer-motion";
import { HeartPulse, Loader2 } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useInvestments } from "@/hooks/useInvestments";
import { useDebts } from "@/hooks/useDebts";
import { useTransactions } from "@/hooks/useTransactions";
import { useBudgets, useCategorySpending } from "@/hooks/useBudgets";
import { useConvertToBase } from "@/hooks/useExchangeRates";
import { Currency } from "@/lib/data";
import { toLocalYearMonth } from "@/lib/utils";

/**
 * A single at-a-glance score (0-100) summarising overall financial health,
 * the way Monarch Money / Copilot-style apps surface a "financial health"
 * or "net worth trend" signal. Everything here is derived purely from data
 * the app already has (accounts, debts, investments, transactions, budgets)
 * — no new tables, no new writes, no change to any existing calculation.
 *
 * Score = 40% savings rate this month + 30% debt-to-asset ratio
 *        + 30% budget adherence this month (neutral if no budgets are set).
 */
export function FinancialHealthScore() {
  const { data: accounts = [], isLoading: l1 } = useAccounts();
  const { data: investments = [], isLoading: l2 } = useInvestments();
  const { data: debts = [], isLoading: l3 } = useDebts();
  const { data: transactions = [], isLoading: l4 } = useTransactions();
  const { data: budgets = [], isLoading: l5 } = useBudgets();
  const { data: spending = {} } = useCategorySpending();
  const convertToBase = useConvertToBase();

  const loading = l1 || l2 || l3 || l4 || l5;
  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center justify-center min-h-[140px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const thisMonth = toLocalYearMonth(new Date());
  const monthTx = transactions.filter((t) => t.date.slice(0, 7) === thisMonth);

  const income = monthTx
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + convertToBase(t.amount, t.currency as Currency), 0);
  const expense = monthTx
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + convertToBase(t.amount, t.currency as Currency), 0);

  const savingsRate = income > 0 ? (income - expense) / income : 0;
  const savingsScore = Math.max(0, Math.min(40, (savingsRate / 0.2) * 40));

  const totalAssets =
    accounts
      .filter((a) => a.type !== "credit_card")
      .reduce((sum, a) => sum + convertToBase(a.balance, a.currency as Currency), 0) +
    investments.reduce((sum, i) => sum + convertToBase(i.value, i.currency as Currency), 0);
  const totalDebt =
    debts.reduce((sum, d) => sum + convertToBase(d.remaining_amount, d.currency as Currency), 0) +
    Math.abs(
      accounts
        .filter((a) => a.type === "credit_card")
        .reduce((sum, a) => sum + convertToBase(a.balance, a.currency as Currency), 0)
    );
  const debtRatio = totalAssets > 0 ? Math.min(1, totalDebt / totalAssets) : totalDebt > 0 ? 1 : 0;
  const debtScore = Math.max(0, Math.min(30, (1 - debtRatio) * 30));

  let budgetScore = 20; // neutral default when no budgets are configured yet
  if (budgets.length > 0) {
    const onTrack = budgets.filter((b) => {
      const spent = spending[`${b.category}::${b.currency}`] || 0;
      return spent <= Number(b.monthly_limit);
    }).length;
    budgetScore = (onTrack / budgets.length) * 30;
  }

  const score = Math.round(savingsScore + debtScore + budgetScore);
  const grade =
    score >= 80
      ? { label: "Excellent", color: "text-success" }
      : score >= 60
        ? { label: "Good", color: "text-primary" }
        : score >= 40
          ? { label: "Fair", color: "text-warning" }
          : { label: "Needs Attention", color: "text-destructive" };

  const ringColor =
    score >= 80 ? "stroke-success" : score >= 60 ? "stroke-primary" : score >= 40 ? "stroke-warning" : "stroke-destructive";

  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.05 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-muted-foreground tracking-normal">
            Financial Health
          </h3>
        </div>
        <span className={`text-xs font-medium ${grade.color}`}>{grade.label}</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative h-24 w-24 shrink-0">
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" strokeWidth="8" fill="none" className="stroke-border" />
            <circle
              cx="48"
              cy="48"
              r="40"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              className={ringColor}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold font-mono">{score}</span>
          </div>
        </div>

        <div className="flex-1 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Savings rate this month</span>
            <span className="font-mono font-medium">{Math.round(savingsRate * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Debt-to-asset ratio</span>
            <span className="font-mono font-medium">{Math.round(debtRatio * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Budgets on track</span>
            <span className="font-mono font-medium">
              {budgets.length === 0 ? "Not set" : `${Math.round((budgetScore / 30) * budgets.length)}/${budgets.length}`}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
