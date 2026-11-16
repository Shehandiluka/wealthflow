import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Debt = Tables<"debts">;

/** This month's interest owed, given the debt's interest settings and current outstanding balance. */
export function computeMonthlyInterest(debt: Pick<Debt, "interest_kind" | "interest_value" | "remaining_amount">): number {
  if (!debt.interest_kind || !debt.interest_value) return 0;
  if (debt.interest_kind === "percentage") return (debt.remaining_amount * debt.interest_value) / 100;
  return debt.interest_value; // fixed monthly amount
}

export function useDebts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["debts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Debt[];
    },
    enabled: !!user,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (debt: Omit<TablesInsert<"debts">, "user_id">) => {
      const { data, error } = await supabase
        .from("debts")
        .insert({ ...debt, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Debt, "id" | "user_id" | "created_at">> }) => {
      const { error } = await supabase
        .from("debts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });
}

export function useDeleteDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("debts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });
}
