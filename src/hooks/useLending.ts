import { toLocalISODate } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface LendingContact {
  id: string;
  user_id: string;
  person_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
  transactions: LendingTransaction[];
}

export interface LendingTransaction {
  id: string;
  user_id: string;
  contact_id: string;
  type: "lent" | "borrowed" | "repaid_to_me" | "repaid_by_me";
  amount: number;
  currency: string;
  exchange_rate: number | null;
  base_amount: number | null;
  description: string;
  date: string;
  account_id: string | null;
  created_at: string;
}

export function useLendingContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lending-contacts", user?.id],
    queryFn: async () => {
      const { data: contacts, error } = await supabase
        .from("lending_contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: txns, error: txErr } = await supabase
        .from("lending_transactions")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (txErr) throw txErr;

      return (contacts as any[]).map((c) => ({
        ...c,
        transactions: (txns as any[]).filter((t) => t.contact_id === c.id),
      })) as LendingContact[];
    },
    enabled: !!user,
  });
}

export function useCreateLendingContact() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { person_name: string; notes?: string }) => {
      const { error } = await supabase
        .from("lending_contacts")
        .insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lending-contacts"] }),
  });
}

export function useUpdateLendingContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; person_name?: string; notes?: string }) => {
      const { error } = await supabase
        .from("lending_contacts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lending-contacts"] }),
  });
}

export function useDeleteLendingContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lending_contacts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lending-contacts"] }),
  });
}

export function useAddLendingTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      contact_id: string;
      contact_name?: string;
      type: LendingTransaction["type"];
      amount: number;
      currency: string;
      exchange_rate?: number | null;
      base_amount?: number | null;
      description?: string;
      date?: string;
      account_id?: string | null;
    }) => {
      const { contact_name, ...insertData } = data;
      const { error } = await supabase
        .from("lending_transactions")
        .insert({ ...insertData, user_id: user!.id });
      if (error) throw error;

      // Update account balance
      if (data.account_id) {
        const sign =
          data.type === "lent" || data.type === "repaid_by_me" ? -1 : 1;
        await supabase.rpc("update_account_balance", {
          _account_id: data.account_id,
          _amount: data.amount * sign,
        });
      }

      // Also record in main transactions table
      if (data.account_id) {
        const txType = data.type === "lent" || data.type === "repaid_by_me" ? "expense" : "income";
        const typeLabel = data.type === "lent" ? "Lent" : data.type === "borrowed" ? "Borrowed" : data.type === "repaid_to_me" ? "Repaid to me" : "I repaid";
        const personLabel = contact_name || "";
        const desc = [typeLabel, personLabel, data.description].filter(Boolean).join(" — ");

        await supabase.from("transactions").insert({
          user_id: user!.id,
          account_id: data.account_id,
          type: txType,
          amount: data.amount,
          currency: data.currency,
          category: "Lend & Borrow",
          description: desc,
          date: data.date || toLocalISODate(new Date()),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lending-contacts"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

export function useDeleteLendingTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tx: LendingTransaction) => {
      // Reverse account balance if linked
      if (tx.account_id) {
        const sign =
          tx.type === "lent" || tx.type === "repaid_by_me" ? 1 : -1;
        await supabase.rpc("update_account_balance", {
          _account_id: tx.account_id,
          _amount: tx.amount * sign,
        });
      }
      const { error } = await supabase
        .from("lending_transactions")
        .delete()
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lending-contacts"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

/** Calculate net balance for a contact. Positive = they owe me, negative = I owe them */
export function calculateContactBalance(transactions: LendingTransaction[]): number {
  return transactions.reduce((sum, tx) => {
    const amount = tx.base_amount ?? tx.amount;
    switch (tx.type) {
      case "lent":
        return sum + amount; // they owe me
      case "borrowed":
        return sum - amount; // I owe them
      case "repaid_to_me":
        return sum - amount; // they paid back, reduce what they owe
      case "repaid_by_me":
        return sum + amount; // I paid back, reduce what I owe (add because balance is negative)
      default:
        return sum;
    }
  }, 0);
}

/**
 * The currency a contact's running balance is denominated in — the currency of their
 * first lent/borrowed transaction. Cross-currency repayments carry a base_amount already
 * converted into this currency, so the whole balance stays coherent in one unit.
 * Falls back to LKR only when there's no lent/borrowed transaction yet (fresh contact).
 */
export function getContactCurrency(transactions: LendingTransaction[]): string {
  const original = transactions.find((t) => t.type === "lent" || t.type === "borrowed");
  return original?.currency || "LKR";
}
