import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toLocalISODate, toLocalYearMonth } from "@/lib/utils";

export interface Budget {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: number;
  currency: string;
  rollover: boolean;
  created_at: string;
  updated_at: string;
}

export function useBudgets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["budgets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets" as any)
        .select("*")
        .order("category");
      if (error) throw error;
      return data as unknown as Budget[];
    },
    enabled: !!user,
  });
}

export function useUpsertBudget() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (budget: { category: string; monthly_limit: number; currency?: string; rollover?: boolean }) => {
      const { data, error } = await supabase
        .from("budgets" as any)
        .upsert(
          {
            user_id: user!.id,
            category: budget.category,
            monthly_limit: budget.monthly_limit,
            currency: budget.currency || "LKR",
            rollover: budget.rollover ?? false,
          } as any,
          { onConflict: "user_id,category" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

/**
 * Spend per category+currency for each of the last `monthsBack` months
 * (not including the current month) — used for month-over-month comparison,
 * rollover calculations, and suggesting a sensible budget amount from
 * actual recent history rather than a guess.
 */
export function useCategorySpendingHistory(monthsBack = 4) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["category-spending-history", user?.id, monthsBack],
    queryFn: async () => {
      const now = new Date();
      const earliestStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth() - monthsBack, 1));
      const thisMonthStart = toLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));

      const { data, error } = await supabase
        .from("transactions")
        .select("category, amount, currency, date")
        .eq("type", "expense")
        .gte("date", earliestStart)
        .lt("date", thisMonthStart);
      if (error) throw error;

      // Keyed by "YYYY-MM::category::currency"
      const byMonth: Record<string, number> = {};
      (data || []).forEach((tx) => {
        const month = tx.date.slice(0, 7);
        const key = `${month}::${tx.category}::${tx.currency}`;
        byMonth[key] = (byMonth[key] || 0) + Number(tx.amount);
      });
      return byMonth;
    },
    enabled: !!user,
  });
}

export function useCategorySpending(month?: string) {
  const { user } = useAuth();
  const currentMonth = month || toLocalYearMonth(new Date());
  return useQuery({
    queryKey: ["category-spending", user?.id, currentMonth],
    queryFn: async () => {
      const startDate = `${currentMonth}-01`;
      const endParts = currentMonth.split("-");
      const endDate = toLocalISODate(new Date(parseInt(endParts[0]), parseInt(endParts[1]), 0));

      const { data, error } = await supabase
        .from("transactions")
        .select("category, amount, currency")
        .eq("type", "expense")
        .gte("date", startDate)
        .lte("date", endDate);
      if (error) throw error;

      // Keyed by "category::currency" — a budget's spend should only count
      // transactions in the budget's own currency, not blend LKR and ILS
      // (say) into one misleading total.
      const spending: Record<string, number> = {};
      (data || []).forEach((tx) => {
        const key = `${tx.category}::${tx.currency}`;
        spending[key] = (spending[key] || 0) + Number(tx.amount);
      });
      return spending;
    },
    enabled: !!user,
  });
}
