import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions">;

export function useTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });
}

async function updateBalance(accountId: string, amount: number) {
  const { error } = await supabase.rpc("update_account_balance", {
    _account_id: accountId,
    _amount: amount,
  });
  if (error) throw error;
}

async function updateDebt(debtId: string, amount: number) {
  const { error } = await supabase.rpc("update_debt_remaining", {
    _debt_id: debtId,
    _amount: amount,
  });
  if (error) throw error;
}

async function updateDebtInterestPaid(debtId: string, amount: number) {
  const { error } = await supabase.rpc("update_debt_interest_paid", {
    _debt_id: debtId,
    _amount: amount,
  });
  if (error) throw error;
}

/** Reverse the balance effect of an existing transaction */
async function reverseTransactionBalance(tx: Transaction) {
  const sign = tx.type === "income" ? -1 : tx.type === "expense" ? 1 : 1;
  await updateBalance(tx.account_id, tx.amount * sign);
  if (tx.type === "transfer" && tx.to_account_id) {
    const rate = tx.exchange_rate || 1;
    const charge = tx.transfer_charge || 0;
    await updateBalance(tx.to_account_id, -(tx.amount * rate - charge));
  }
  if (tx.type === "expense" && tx.debt_id) {
    // Interest payments never touched the principal — only reverse what was
    // actually applied when this transaction was created.
    if (tx.is_interest_payment) {
      await updateDebtInterestPaid(tx.debt_id, -tx.amount);
    } else {
      await updateDebt(tx.debt_id, tx.amount);
    }
  }
}

/** Apply the balance effect of a transaction */
async function applyTransactionBalance(tx: Transaction) {
  const sign = tx.type === "income" ? 1 : tx.type === "expense" ? -1 : -1;
  await updateBalance(tx.account_id, tx.amount * sign);
  if (tx.type === "transfer" && tx.to_account_id) {
    const rate = tx.exchange_rate || 1;
    const charge = tx.transfer_charge || 0;
    await updateBalance(tx.to_account_id, tx.amount * rate - charge);
  }
  if (tx.type === "expense" && tx.debt_id) {
    // A loan's monthly interest is a real cost, but it isn't money that goes
    // toward what you borrowed — only a principal payment should reduce the
    // remaining loan balance. Interest payments just track against
    // debts.interest_paid instead, leaving remaining_amount untouched.
    if (tx.is_interest_payment) {
      await updateDebtInterestPaid(tx.debt_id, tx.amount);
    } else {
      await updateDebt(tx.debt_id, -tx.amount);
    }
  }
}

/** Fetch the current transaction from DB to avoid stale data */
async function fetchCurrentTransaction(id: string): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Transaction;
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (tx: Omit<TablesInsert<"transactions">, "user_id">) => {
      const { data, error } = await supabase
        .from("transactions")
        .insert({ ...tx, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Apply balance effect
      await applyTransactionBalance(data as Transaction);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ original, updates }: { original: Transaction; updates: Partial<Transaction> }) => {
      // Always fetch current state from DB to avoid stale cache issues
      const current = await fetchCurrentTransaction(original.id);

      // Reverse current balance effect
      await reverseTransactionBalance(current);

      // Apply update in DB
      const { error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", current.id);
      if (error) throw error;

      // Fetch the updated transaction to get accurate merged values
      const updated = await fetchCurrentTransaction(current.id);

      // Apply new balance effect
      await applyTransactionBalance(updated);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["category-spending"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: Transaction) => {
      // Fetch current state from DB to avoid stale data
      const current = await fetchCurrentTransaction(tx.id);

      // Reverse the balance
      await reverseTransactionBalance(current);

      const { error } = await supabase.from("transactions").delete().eq("id", current.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["debts"] });
      qc.invalidateQueries({ queryKey: ["category-spending"] });
    },
  });
}
