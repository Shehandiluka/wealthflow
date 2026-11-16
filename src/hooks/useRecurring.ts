import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  type: string;
  amount: number;
  currency: string;
  category: string;
  description: string;
  frequency: string;
  next_due: string;
  is_active: boolean;
  debt_id?: string | null;
  created_at: string;
  updated_at: string;
}

export function useRecurringTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["recurring-transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_transactions" as any)
        .select("*")
        .order("next_due");
      if (error) throw error;
      return data as unknown as RecurringTransaction[];
    },
    enabled: !!user,
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (
      item: Omit<RecurringTransaction, "id" | "user_id" | "created_at" | "updated_at" | "is_active">
    ) => {
      // Just schedule the rule — do NOT create a transaction or touch any
      // balance here. The scheduled process-recurring function is what
      // actually fires a payment, and only once next_due has genuinely
      // arrived. Firing immediately on creation double-charged every debt's
      // first EMI (and any other recurring rule) the moment it was added,
      // regardless of how far away its real due date was.
      const { data, error } = await supabase
        .from("recurring_transactions" as any)
        .insert({ ...item, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-transactions"] });
    },
  });
}

export function useToggleRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("recurring_transactions" as any)
        .update({ is_active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_transactions" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring-transactions"] }),
  });
}
