import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2, Target, TrendingUp, TrendingDown, Minus, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, Currency } from "@/lib/data";
import { toLocalISODate } from "@/lib/utils";
import {
  useBudgets, useUpsertBudget, useDeleteBudget, useCategorySpending,
  useCategorySpendingHistory, Budget,
} from "@/hooks/useBudgets";
import { useToast } from "@/hooks/use-toast";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import { CategorySelect } from "@/components/CategorySelect";
import { cn } from "@/lib/utils";

/** How many months of the current month have elapsed, as a 0-1 fraction — used to
 * project "at this rate, you'll spend X by month end" partway through the month. */
function monthElapsedFraction(): number {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(1, now.getDate() / daysInMonth);
}

function lastMonthKey(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return toLocalISODate(d).slice(0, 7);
}

function last3MonthKeys(): string[] {
  const now = new Date();
  return [1, 2, 3].map((n) => toLocalISODate(new Date(now.getFullYear(), now.getMonth() - n, 1)).slice(0, 7));
}

const BudgetsPage = () => {
  const { data: budgets = [], isLoading } = useBudgets();
  const { data: spending = {} } = useCategorySpending();
  const { data: history = {} } = useCategorySpendingHistory(4);
  const upsertBudget = useUpsertBudget();
  const deleteBudget = useDeleteBudget();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);
  const [category, setCategory] = useState("Food");
  const [limit, setLimit] = useState("");
  const [rollover, setRollover] = useState(false);

  const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
  const elapsedFraction = monthElapsedFraction();

  // Suggest a starting budget from the average of the last 3 months' actual
  // spend in this category — far more useful than guessing from scratch.
  const suggestedAmount = useMemo(() => {
    const currency = editBudget?.currency || "LKR";
    const amounts = last3MonthKeys()
      .map((m) => history[`${m}::${category}::${currency}`] || 0)
      .filter((v) => v > 0);
    if (amounts.length === 0) return null;
    return amounts.reduce((s, v) => s + v, 0) / amounts.length;
  }, [category, history, editBudget]);

  const resetForm = () => { setCategory("Food"); setLimit(""); setRollover(false); };

  const openEdit = (b: Budget) => {
    setEditBudget(b);
    setCategory(b.category);
    setLimit(String(b.monthly_limit));
    setRollover(b.rollover);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(limit);
    if (!amount) return;
    try {
      await upsertBudget.mutateAsync({ category, monthly_limit: amount, rollover, currency: editBudget?.currency });
      setAddOpen(false);
      setEditBudget(null);
      resetForm();
      toast({ title: "Budget saved!" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget.mutateAsync(id);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // A budget's *effective* limit includes rolled-over unused amount from last
  // month, if that's turned on for this category.
  const effectiveLimit = (b: Budget): number => {
    if (!b.rollover) return Number(b.monthly_limit);
    const lastSpent = history[`${lastMonthKey()}::${b.category}::${b.currency}`] || 0;
    const leftover = Math.max(0, Number(b.monthly_limit) - lastSpent);
    return Number(b.monthly_limit) + leftover;
  };

  // Budgets can be in different currencies — group instead of blindly summing
  // raw numbers into one misleadingly-labeled total.
  const byCurrency = budgets.reduce((map, b) => {
    const spent = spending[`${b.category}::${b.currency}`] || 0;
    const entry = map.get(b.currency) || { spent: 0, budget: 0 };
    entry.spent += spent;
    entry.budget += effectiveLimit(b);
    map.set(b.currency, entry);
    return map;
  }, new Map<string, { spent: number; budget: number }>());
  const currencyProgress = Array.from(byCurrency.entries()).sort((a, b) => b[1].budget - a[1].budget);

  const formBody = (isEdit: boolean) => (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Category</Label>
        {isEdit ? (
          <div className="bg-secondary rounded-md px-3 py-2 text-sm text-muted-foreground">{category}</div>
        ) : (
          <CategorySelect value={category} onValueChange={setCategory} kind="expense" />
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Monthly Limit</Label>
        <Input
          type="number"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="0.00"
          className="bg-secondary"
          required
          min="1"
          step="0.01"
        />
        {suggestedAmount !== null && (
          <button
            type="button"
            onClick={() => setLimit(suggestedAmount.toFixed(0))}
            className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            Suggest {formatCurrency(suggestedAmount, (editBudget?.currency || "LKR") as Currency)}/mo — your last 3 months' average
          </button>
        )}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" /> Roll over unused budget</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            If you spend less than this limit, the leftover adds to next month's limit for this category.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={rollover}
          onClick={() => setRollover((r) => !r)}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", rollover ? "bg-primary" : "bg-secondary border border-border")}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform", rollover ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>
      <Button type="submit" className="w-full" disabled={upsertBudget.isPending}>
        {upsertBudget.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {isEdit ? "Save Changes" : "Save Budget"}
      </Button>
    </form>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Budget Goals</h1>
          <p className="text-sm text-muted-foreground">{currentMonth}</p>
        </div>
        <ResponsiveDialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <ResponsiveDialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Set Budget
            </Button>
          </ResponsiveDialogTrigger>
          <ResponsiveDialogContent className="glass-card border-glass-border">
            <ResponsiveDialogHeader><ResponsiveDialogTitle>Set Category Budget</ResponsiveDialogTitle></ResponsiveDialogHeader>
            {formBody(false)}
          </ResponsiveDialogContent>
        </ResponsiveDialog>
      </div>

      {budgets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Overall Progress</span>
          </div>
          {currencyProgress.map(([cur, { spent, budget }]) => {
            const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
            return (
              <div key={cur} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{cur}</span>
                  <span className="text-xs sm:text-sm font-mono text-muted-foreground">
                    {formatCurrency(spent, cur as Currency)} / {formatCurrency(budget, cur as Currency)}
                  </span>
                </div>
                <Progress
                  value={percent}
                  className={`h-3 ${percent >= 90 ? "[&>div]:bg-destructive" : percent >= 70 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
                />
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {Math.max(...currencyProgress.map(([, v]) => v.budget > 0 ? (v.spent / v.budget) * 100 : 0)) < 70
              ? "On track! Keep it up."
              : Math.max(...currencyProgress.map(([, v]) => v.budget > 0 ? (v.spent / v.budget) * 100 : 0)) < 90
              ? "Getting close to your limits."
              : "Over budget on at least one currency — review your spending."}
          </p>
        </motion.div>
      )}

      {budgets.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No budgets set yet. Add your first category budget!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget, i) => {
            const spent = spending[`${budget.category}::${budget.currency}`] || 0;
            const limitAmt = effectiveLimit(budget);
            const percent = limitAmt > 0 ? Math.min((spent / limitAmt) * 100, 100) : 0;
            const isOver = spent > limitAmt;
            const rolledOver = limitAmt - Number(budget.monthly_limit);

            const lastSpent = history[`${lastMonthKey()}::${budget.category}::${budget.currency}`] || 0;
            const monthDelta = lastSpent > 0 ? ((spent - lastSpent) / lastSpent) * 100 : null;

            // Pace: if spending continues at today's rate, project the month-end total.
            const projected = elapsedFraction > 0.05 ? spent / elapsedFraction : spent;
            const willExceed = !isOver && limitAmt > 0 && projected > limitAmt * 1.05;

            return (
              <SwipeToDelete
                key={budget.id}
                onDelete={() => handleDelete(budget.id)}
                itemLabel="Budget removed"
                className="glass-card rounded-xl"
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {budget.category}
                      {budget.rollover && rolledOver > 0 && (
                        <span className="text-[10px] text-primary border border-primary/30 rounded-full px-1.5 py-0.5">
                          +{formatCurrency(rolledOver, budget.currency as Currency)} rolled over
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs sm:text-sm font-mono ${isOver ? "text-destructive" : "text-foreground"}`}>
                        {formatCurrency(spent, budget.currency as Currency)}
                        <span className="text-muted-foreground"> / {formatCurrency(limitAmt, budget.currency as Currency)}</span>
                      </span>
                      <button onClick={() => openEdit(budget)} aria-label="Edit budget" className="text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <Progress
                    value={percent}
                    className={`h-2 ${percent >= 90 ? "[&>div]:bg-destructive" : percent >= 70 ? "[&>div]:bg-warning" : "[&>div]:bg-success"}`}
                  />
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    {isOver ? (
                      <p className="text-xs text-destructive">
                        Over by {formatCurrency(spent - limitAmt, budget.currency as Currency)}
                      </p>
                    ) : willExceed ? (
                      <p className="text-xs text-warning">
                        At this pace, ~{formatCurrency(projected, budget.currency as Currency)} by month end
                      </p>
                    ) : <span />}
                    {monthDelta !== null && (
                      <span className={cn(
                        "flex items-center gap-1 text-[11px]",
                        monthDelta > 5 ? "text-destructive" : monthDelta < -5 ? "text-success" : "text-muted-foreground"
                      )}>
                        {monthDelta > 5 ? <TrendingUp className="h-3 w-3" /> : monthDelta < -5 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {Math.abs(monthDelta).toFixed(0)}% vs last month
                      </span>
                    )}
                  </div>
                </motion.div>
              </SwipeToDelete>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <ResponsiveDialog open={!!editBudget} onOpenChange={(v) => { if (!v) { setEditBudget(null); resetForm(); } }}>
        <ResponsiveDialogContent className="glass-card border-glass-border">
          <ResponsiveDialogHeader><ResponsiveDialogTitle>Edit Budget</ResponsiveDialogTitle></ResponsiveDialogHeader>
          {formBody(true)}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
};

export default BudgetsPage;
